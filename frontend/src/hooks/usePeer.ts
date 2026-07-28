import { useEffect } from 'react';
import type { Chat } from '@shared/types/chat';
import type { User } from '@shared/types/user';
import { useAuthStore } from '../stores/authStore';
import { useUserStore } from '../stores/userStore';

/**
 * Resolve the "other" participant of a 1:1 chat to a full profile (name, photo,
 * online). Fetches + caches on demand. Returns { peerUid, peer }.
 */
export function usePeer(chat: Chat | undefined): { peerUid: string | null; peer: User | undefined } {
  const myUid = useAuthStore((s) => s.user?.uid);
  const fetch = useUserStore((s) => s.fetch);
  const profiles = useUserStore((s) => s.profiles);

  const peerUid = chat && myUid ? chat.participants.find((p) => p !== myUid) ?? null : null;

  useEffect(() => {
    if (peerUid && !profiles.get(peerUid)) {
      fetch(peerUid);
    }
  }, [peerUid, profiles, fetch]);

  return { peerUid, peer: peerUid ? profiles.get(peerUid) : undefined };
}
