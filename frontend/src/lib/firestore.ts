/**
 * Firestore data layer — the app's real backend.
 *
 * Replaces the empty Cloudflare Worker (api.ts / websocket.ts) with direct
 * Firestore reads/writes + realtime onSnapshot listeners. All message content
 * stored here is already E2E-encrypted client-side (see lib/crypto).
 *
 * Collections:
 *   users/{uid}                       → User profile + public key
 *   chats/{chatId}                    → participants, lastMessage, unread map
 *   chats/{chatId}/messages/{msgId}   → encrypted messages
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  Timestamp,
  type Unsubscribe,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Chat, Message } from '@shared/types/chat';
import type { User, UserProfile } from '@shared/types/user';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Deterministic chat id for a 1:1 conversation (order-independent). */
export function directChatId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('__');
}

function mapChat(snap: QueryDocumentSnapshot<DocumentData>): Chat {
  const d = snap.data();
  return {
    chatId: snap.id,
    participants: d.participants || [],
    encryptedMetadata: d.encryptedMetadata,
    lastMessage: d.lastMessage,
    lastMessageTimestamp: d.lastMessageTimestamp,
    updatedAt: d.updatedAt ?? Timestamp.now(),
    isHidden: d.isHidden,
    unreadCount: d.unread?.[d._forUid] ?? 0,
  };
}

function mapMessage(snap: QueryDocumentSnapshot<DocumentData>): Message {
  const d = snap.data();
  return {
    messageId: snap.id,
    chatId: d.chatId,
    senderUid: d.senderUid,
    encryptedContent: d.encryptedContent,
    iv: d.iv,
    timestamp: d.timestamp ?? Timestamp.now(),
    status: d.status ?? 'sent',
    replyTo: d.replyTo,
    type: d.type ?? 'text',
    metadata: d.metadata,
    deviceFingerprint: d.deviceFingerprint,
  };
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as User) : null;
}

/** Recipient's public key for ECDH. Returns null if not found. */
export async function getPublicKey(uid: string): Promise<string | null> {
  const user = await getUserProfile(uid);
  return user?.publicKey ?? null;
}

/**
 * Search users by username or email prefix. Firestore has no substring search,
 * so we use a range query on a lowercased username field.
 */
export async function searchUsers(
  queryText: string,
  currentUid: string,
  max = 20,
): Promise<UserProfile[]> {
  const term = queryText.trim().toLowerCase();
  if (!term) return [];

  const usersRef = collection(db, 'users');
  // Prefix range trick: [term, term + ]
  const q = query(
    usersRef,
    where('usernameLower', '>=', term),
    where('usernameLower', '<=', term + ''),
    fbLimit(max),
  );

  const snaps = await getDocs(q);
  const results: UserProfile[] = [];
  snaps.forEach((s) => {
    const u = s.data() as User;
    if (u.uid !== currentUid) results.push(u as UserProfile);
  });

  // Fallback: exact email match if username search came up short.
  if (results.length === 0 && term.includes('@')) {
    const eq = query(usersRef, where('email', '==', term), fbLimit(max));
    const esnaps = await getDocs(eq);
    esnaps.forEach((s) => {
      const u = s.data() as User;
      if (u.uid !== currentUid) results.push(u as UserProfile);
    });
  }

  return results;
}

/** Set the user's online flag + lastSeen. Best-effort (ignores errors). */
export async function setOnlineStatus(uid: string, online: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      online,
      lastSeen: serverTimestamp(),
    });
  } catch {
    /* profile may not exist yet — ignore */
  }
}

// ─── Chats ──────────────────────────────────────────────────────────────────

/**
 * Create (or return existing) a 1:1 chat between two users.
 * Uses a deterministic id so the same pair never creates duplicates.
 */
export async function createDirectChat(uid: string, otherUid: string): Promise<Chat> {
  const chatId = directChatId(uid, otherUid);
  const ref = doc(db, 'chats', chatId);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    const d = existing.data();
    return {
      chatId,
      participants: d.participants,
      updatedAt: d.updatedAt ?? Timestamp.now(),
      lastMessage: d.lastMessage,
      unreadCount: d.unread?.[uid] ?? 0,
    };
  }

  const participants = [uid, otherUid];
  await setDoc(ref, {
    participants,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    unread: { [uid]: 0, [otherUid]: 0 },
  });

  return { chatId, participants, updatedAt: Timestamp.now(), unreadCount: 0 };
}

/**
 * Realtime listener for a user's chats, newest first.
 * Returns an unsubscribe function — call it on unmount.
 */
export function listenToChats(
  uid: string,
  onChats: (chats: Chat[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', uid),
    orderBy('updatedAt', 'desc'),
  );

  return onSnapshot(
    q,
    (snap) => {
      const chats: Chat[] = [];
      snap.forEach((s) => {
        const d = s.data();
        chats.push({
          chatId: s.id,
          participants: d.participants || [],
          lastMessage: d.lastMessage,
          lastMessageTimestamp: d.lastMessageTimestamp,
          updatedAt: d.updatedAt ?? Timestamp.now(),
          isHidden: d.isHidden,
          unreadCount: d.unread?.[uid] ?? 0,
        });
      });
      onChats(chats);
    },
    (err) => onError?.(err),
  );
}

// ─── Messages ─────────────────────────────────────────────────────────────

export interface SendMessageInput {
  chatId: string;
  senderUid: string;
  encryptedContent: string;
  iv: string;
  type?: Message['type'];
  replyTo?: string;
  metadata?: Message['metadata'];
  /** Plaintext preview for the chat-list lastMessage (already re-encrypted by caller if needed). */
  previewCiphertext?: string;
  previewIv?: string;
}

/**
 * Write an encrypted message + bump the parent chat's lastMessage/unread.
 * Returns the created message id.
 */
export async function sendMessage(input: SendMessageInput): Promise<Message> {
  const messagesRef = collection(db, 'chats', input.chatId, 'messages');

  const payload: Record<string, unknown> = {
    chatId: input.chatId,
    senderUid: input.senderUid,
    encryptedContent: input.encryptedContent,
    iv: input.iv,
    type: input.type ?? 'text',
    status: 'sent',
    timestamp: serverTimestamp(),
  };
  if (input.replyTo) payload.replyTo = input.replyTo;
  if (input.metadata) payload.metadata = input.metadata;

  const created = await addDoc(messagesRef, payload);

  // Update parent chat: lastMessage snapshot + increment unread for others.
  const chatRef = doc(db, 'chats', input.chatId);
  const chatSnap = await getDoc(chatRef);
  const participants: string[] = chatSnap.data()?.participants || [];
  const unread: Record<string, number> = { ...(chatSnap.data()?.unread || {}) };
  for (const p of participants) {
    if (p !== input.senderUid) unread[p] = (unread[p] || 0) + 1;
  }

  await updateDoc(chatRef, {
    updatedAt: serverTimestamp(),
    lastMessageTimestamp: serverTimestamp(),
    unread,
    lastMessage: {
      messageId: created.id,
      senderUid: input.senderUid,
      encryptedContent: input.encryptedContent,
      iv: input.iv,
      type: input.type ?? 'text',
    },
  });

  return {
    messageId: created.id,
    chatId: input.chatId,
    senderUid: input.senderUid,
    encryptedContent: input.encryptedContent,
    iv: input.iv,
    timestamp: Timestamp.now(),
    status: 'sent',
    type: input.type ?? 'text',
    replyTo: input.replyTo,
    metadata: input.metadata,
  };
}

/**
 * Realtime listener for a chat's messages, oldest first.
 * Returns an unsubscribe function.
 */
export function listenToMessages(
  chatId: string,
  onMessages: (messages: Message[]) => void,
  max = 100,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('timestamp', 'asc'),
    fbLimit(max),
  );

  return onSnapshot(
    q,
    (snap) => onMessages(snap.docs.map(mapMessage)),
    (err) => onError?.(err),
  );
}

/**
 * Mark all messages in a chat (not sent by me) as read, and reset my unread.
 */
export async function markChatRead(chatId: string, uid: string): Promise<void> {
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  const unread: Record<string, number> = { ...(chatSnap.data()?.unread || {}) };
  unread[uid] = 0;
  await updateDoc(chatRef, { unread });

  // Flip status on unread inbound messages.
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    where('senderUid', '!=', uid),
    where('status', 'in', ['sent', 'delivered']),
  );
  try {
    const snaps = await getDocs(q);
    if (snaps.empty) return;
    const batch = writeBatch(db);
    snaps.forEach((s) => batch.update(s.ref, { status: 'read' }));
    await batch.commit();
  } catch {
    /* composite index may be missing in dev — non-fatal */
  }
}

export async function deleteMessage(chatId: string, messageId: string): Promise<void> {
  await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
}

export { mapChat };
