/**
 * Authentication store using Zustand
 * Manages user authentication state and profile
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@shared/types/user';
import { auth, db } from '../lib/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { generateAndStoreKeyPair, getStoredPublicKey, hasStoredKeyPair } from '../lib/crypto/keyStorage';
import { unlockPrivateKey, lockSession, isUnlocked } from '../lib/crypto/sessionManager';
import { setOnlineStatus } from '../lib/firestore';
import { useChatStore } from './chatStore';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  jwt: string | null;
  error: string | null;
  /** True when session is restored but the password-encrypted key needs re-unlocking. */
  needsKeyUnlock: boolean;

  // Actions
  register: (email: string, password: string, username: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => void;
  unlockWithPassword: (password: string) => Promise<void>;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      jwt: null,
      error: null,
      needsKeyUnlock: false,

      register: async (email: string, password: string, username: string) => {
        set({ isLoading: true, error: null });
        try {
          // Create Firebase user
          const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);

          // Generate encryption key pair
          const { publicKey, deviceFingerprint } = await generateAndStoreKeyPair(
            firebaseUser.uid,
            password
          );

          // Create user profile in Firestore. usernameLower powers search.
          const userProfile: Partial<User> & { usernameLower: string } = {
            uid: firebaseUser.uid,
            email: email.toLowerCase(),
            username,
            usernameLower: username.toLowerCase(),
            publicKey,
            deviceFingerprint,
            friends: [],
            blocked: [],
            online: true,
            lastSeen: new Date(),
            createdAt: new Date(),
            privacySettings: {
              searchVisibility: 'everyone',
              friendRequestsFrom: 'everyone',
              profilePhotoVisibility: 'everyone',
              lastSeenVisibility: 'everyone',
              onlineStatusVisibility: 'everyone',
              bioVisibility: 'everyone',
            },
          };

          await setDoc(doc(db, 'users', firebaseUser.uid), userProfile);

          // Unlock private key for this session (password-derived) and start chats.
          await unlockPrivateKey(firebaseUser.uid, password);
          useChatStore.getState().init(firebaseUser.uid);

          set({
            user: userProfile as User,
            isAuthenticated: true,
            jwt: null,
            isLoading: false,
          });
        } catch (error: any) {
          const message = error.message || 'Registration failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password);

          // Ensure this device has a key pair; if not (new device), generate one
          // and publish the new public key so peers can re-establish sessions.
          if (!(await hasStoredKeyPair(firebaseUser.uid))) {
            const { publicKey } = await generateAndStoreKeyPair(firebaseUser.uid, password);
            await setDoc(
              doc(db, 'users', firebaseUser.uid),
              { publicKey },
              { merge: true },
            );
          }

          // Unlock private key for this session.
          await unlockPrivateKey(firebaseUser.uid, password);

          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          const userData = userDoc.data() as User | undefined;

          await setOnlineStatus(firebaseUser.uid, true);
          useChatStore.getState().init(firebaseUser.uid);

          set({
            user: userData || null,
            isAuthenticated: true,
            jwt: null,
            isLoading: false,
          });
        } catch (error: any) {
          const message = error.message || 'Login failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      loginWithGoogle: async () => {
        set({ isLoading: true, error: null });
        try {
          const provider = new GoogleAuthProvider();
          const { user: firebaseUser } = await signInWithPopup(auth, provider);

          // Google users have no password, so the ECDH private key is stored
          // without password encryption (device-bound). Generate on first use.
          let publicKey: string;
          if (await hasStoredKeyPair(firebaseUser.uid)) {
            publicKey = await getStoredPublicKey(firebaseUser.uid);
          } else {
            const gen = await generateAndStoreKeyPair(firebaseUser.uid);
            publicKey = gen.publicKey;
          }

          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          let userData = userDoc.data() as User | undefined;
          if (!userData) {
            const username = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'user';
            userData = {
              uid: firebaseUser.uid,
              email: (firebaseUser.email || '').toLowerCase(),
              username,
              publicKey,
              photoURL: firebaseUser.photoURL || undefined,
              friends: [],
              blocked: [],
              online: true,
              lastSeen: new Date(),
              createdAt: new Date(),
              privacySettings: {
                searchVisibility: 'everyone',
                friendRequestsFrom: 'everyone',
                profilePhotoVisibility: 'everyone',
                lastSeenVisibility: 'everyone',
                onlineStatusVisibility: 'everyone',
                bioVisibility: 'everyone',
              },
            };
            await setDoc(userDocRef, { ...userData, usernameLower: username.toLowerCase() });
          }

          // Unlock (no password) + start realtime.
          await unlockPrivateKey(firebaseUser.uid);
          await setOnlineStatus(firebaseUser.uid, true);
          useChatStore.getState().init(firebaseUser.uid);

          set({
            user: userData,
            isAuthenticated: true,
            jwt: null,
            isLoading: false,
          });
        } catch (error: any) {
          const message = error.message || 'Google login failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      /**
       * Re-sync with Firebase auth on app load. Persisted zustand state marks
       * us authenticated, but the in-memory ECDH private key is gone after a
       * reload. If the key can be unlocked without a password (Google / dev),
       * we resume silently; otherwise we flag needsKeyUnlock for a PIN prompt.
       */
      restoreSession: () => {
        onAuthStateChanged(auth, async (fbUser) => {
          if (!fbUser) {
            useChatStore.getState().teardown();
            lockSession();
            set({ user: null, isAuthenticated: false, needsKeyUnlock: false });
            return;
          }

          const uid = fbUser.uid;
          if (isUnlocked()) {
            useChatStore.getState().init(uid);
            return;
          }

          try {
            // Works when the key was stored without password encryption.
            await unlockPrivateKey(uid);
            await setOnlineStatus(uid, true);
            useChatStore.getState().init(uid);
            set({ isAuthenticated: true, needsKeyUnlock: false });
          } catch {
            // Password-encrypted key — need the user to re-enter it.
            set({ isAuthenticated: true, needsKeyUnlock: true });
          }
        });
      },

      /** Unlock a password-encrypted private key after a session restore. */
      unlockWithPassword: async (password: string) => {
        const uid = get().user?.uid;
        if (!uid) throw new Error('No session to unlock');
        set({ isLoading: true, error: null });
        try {
          await unlockPrivateKey(uid, password);
          await setOnlineStatus(uid, true);
          useChatStore.getState().init(uid);
          set({ needsKeyUnlock: false, isLoading: false });
        } catch (error: any) {
          set({ error: 'Wrong password — could not unlock your keys.', isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true, error: null });
        try {
          const uid = get().user?.uid;
          if (uid) await setOnlineStatus(uid, false).catch(() => {});

          useChatStore.getState().teardown();
          lockSession();
          await signOut(auth);

          set({
            user: null,
            isAuthenticated: false,
            jwt: null,
            isLoading: false,
          });
        } catch (error: any) {
          const message = error.message || 'Logout failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      setError: (error: string | null) => set({ error }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        jwt: state.jwt,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
