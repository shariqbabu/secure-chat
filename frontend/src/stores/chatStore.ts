/**
 * Chat store — Firestore-backed, E2E-encrypted.
 *
 * Realtime chats + messages via onSnapshot. Messages are decrypted on arrival
 * using the per-chat session key (sessionManager). Sending encrypts before
 * the ciphertext ever leaves the device.
 */

import { create } from 'zustand';
import type { Chat, Message, MessageWithDecrypted } from '@shared/types/chat';
import {
  listenToChats,
  listenToMessages,
  sendMessage as fsSendMessage,
  createDirectChat,
  markChatRead,
  deleteMessage as fsDeleteMessage,
} from '../lib/firestore';
import {
  encryptForChat,
  decryptForChat,
  invalidateSession,
} from '../lib/crypto/sessionManager';
import { storeHiddenChat, getAllHiddenChats } from '../lib/crypto/keyStorage';
import { toast } from './toastStore';
import type { Unsubscribe } from 'firebase/firestore';

/** Resolve the "other" participant in a 1:1 chat. */
function peerOf(chat: Chat | undefined, myUid: string): string | null {
  if (!chat) return null;
  return chat.participants.find((p) => p !== myUid) ?? null;
}

export interface ChatState {
  chats: Map<string, Chat>;
  messages: Map<string, MessageWithDecrypted[]>;
  activeChat: string | null;
  isLoading: boolean;
  error: string | null;
  hasHiddenChats: boolean;
  hiddenChats: Map<string, Chat>;

  // internal listener handles
  _chatsUnsub: Unsubscribe | null;
  _msgUnsub: Unsubscribe | null;
  _myUid: string | null;

  // Actions
  init: (uid: string) => void;
  teardown: () => void;
  setActiveChat: (chatId: string | null) => void;
  openChat: (chatId: string) => void;
  sendMessage: (chatId: string, content: string, replyTo?: string) => Promise<void>;
  deleteMessage: (messageId: string, chatId: string) => Promise<void>;
  createChat: (participantUid: string) => Promise<Chat>;
  hideChat: (chatId: string) => Promise<void>;
  openHiddenChats: (pin: string) => Promise<void>;
  setError: (error: string | null) => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  chats: new Map(),
  messages: new Map(),
  activeChat: null,
  isLoading: false,
  error: null,
  hasHiddenChats: false,
  hiddenChats: new Map(),
  _chatsUnsub: null,
  _msgUnsub: null,
  _myUid: null,

  /** Start realtime chat listener for the logged-in user. */
  init: (uid: string) => {
    const prev = get()._chatsUnsub;
    if (prev) prev();

    set({ _myUid: uid, isLoading: true });

    const unsub = listenToChats(
      uid,
      (chats) => {
        const map = new Map<string, Chat>();
        for (const c of chats) map.set(c.chatId, c);
        set({ chats: map, isLoading: false });
      },
      (err) => set({ error: err.message, isLoading: false }),
    );

    set({ _chatsUnsub: unsub });
  },

  /** Stop all listeners (call on logout). */
  teardown: () => {
    get()._chatsUnsub?.();
    get()._msgUnsub?.();
    set({
      _chatsUnsub: null,
      _msgUnsub: null,
      chats: new Map(),
      messages: new Map(),
      activeChat: null,
      _myUid: null,
    });
  },

  setActiveChat: (chatId: string | null) => {
    set({ activeChat: chatId });
    if (chatId) get().openChat(chatId);
  },

  /** Subscribe to a chat's messages and decrypt them as they arrive. */
  openChat: (chatId: string) => {
    const { _msgUnsub, _myUid, chats } = get();
    if (_msgUnsub) _msgUnsub();
    if (!_myUid) return;

    const peer = peerOf(chats.get(chatId), _myUid);

    const unsub = listenToMessages(chatId, async (raw: Message[]) => {
      // Decrypt each message; own + peer both use the same session key.
      const decrypted: MessageWithDecrypted[] = await Promise.all(
        raw.map(async (m) => {
          let text = '';
          if (m.type === 'text' && peer) {
            text = await decryptForChat(chatId, peer, m.encryptedContent, m.iv);
          } else if (m.type !== 'text') {
            text = ''; // media handled separately
          }
          return { ...m, decryptedContent: text };
        }),
      );
      set((state) => ({
        messages: new Map(state.messages).set(chatId, decrypted),
      }));
    });

    set({ _msgUnsub: unsub });

    // Mark read (best-effort).
    markChatRead(chatId, _myUid).catch(() => {});
  },

  sendMessage: async (chatId: string, content: string, replyTo?: string) => {
    const { _myUid, chats } = get();
    if (!_myUid) {
      set({ error: 'Not authenticated' });
      return;
    }
    const trimmed = content.trim();
    if (!trimmed) return;

    const peer = peerOf(chats.get(chatId), _myUid);
    if (!peer) {
      set({ error: 'Cannot resolve chat recipient' });
      return;
    }

    try {
      const { ciphertext, iv } = await encryptForChat(chatId, peer, trimmed);
      await fsSendMessage({
        chatId,
        senderUid: _myUid,
        encryptedContent: ciphertext,
        iv,
        type: 'text',
        replyTo,
      });
      // No manual state push — the onSnapshot listener reflects it.
    } catch (error: any) {
      const msg = error.message || 'Failed to send message';
      set({ error: msg });
      toast.error(msg);
    }
  },

  deleteMessage: async (messageId: string, chatId: string) => {
    try {
      await fsDeleteMessage(chatId, messageId);
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  createChat: async (participantUid: string) => {
    const { _myUid } = get();
    if (!_myUid) throw new Error('Not authenticated');
    const chat = await createDirectChat(_myUid, participantUid);
    set((state) => ({ chats: new Map(state.chats).set(chat.chatId, chat) }));
    return chat;
  },

  hideChat: async (chatId: string) => {
    try {
      const state = get();
      const chat = state.chats.get(chatId);
      if (!chat) throw new Error('Chat not found');

      await storeHiddenChat(chatId, {
        chatId,
        participants: chat.participants,
        hiddenAt: new Date(),
      });

      const newChats = new Map(state.chats);
      newChats.delete(chatId);
      set({
        chats: newChats,
        hasHiddenChats: true,
        activeChat: state.activeChat === chatId ? null : state.activeChat,
      });
      invalidateSession(chatId);
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  openHiddenChats: async (_pin: string) => {
    try {
      set({ isLoading: true });
      const list = await getAllHiddenChats();
      const map = new Map<string, Chat>();
      (list || []).forEach((c: any) => map.set(c.chatId, c));
      set({ hiddenChats: map, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  setError: (error: string | null) => set({ error }),
}));
