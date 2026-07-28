import { create } from 'zustand';
import type { User } from '@shared/types/user';
import { getUserProfile } from '../lib/firestore';

interface UserCacheState {
  profiles: Map<string, User>;
  /** Fetch a profile (cached). Returns null if not found. */
  fetch: (uid: string) => Promise<User | null>;
  get: (uid: string) => User | undefined;
}

// De-dupe concurrent fetches for the same uid.
const inflight = new Map<string, Promise<User | null>>();

export const useUserStore = create<UserCacheState>()((set, getState) => ({
  profiles: new Map(),

  fetch: async (uid: string) => {
    const cached = getState().profiles.get(uid);
    if (cached) return cached;
    if (inflight.has(uid)) return inflight.get(uid)!;

    const p = getUserProfile(uid)
      .then((user) => {
        if (user) {
          set((s) => ({ profiles: new Map(s.profiles).set(uid, user) }));
        }
        inflight.delete(uid);
        return user;
      })
      .catch(() => {
        inflight.delete(uid);
        return null;
      });

    inflight.set(uid, p);
    return p;
  },

  get: (uid: string) => getState().profiles.get(uid),
}));
