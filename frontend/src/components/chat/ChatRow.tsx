import { motion } from 'framer-motion';
import { Check, CheckCheck, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Chat } from '@shared/types/chat';
import Avatar from '../ui/Avatar';
import { usePeer } from '../../hooks/usePeer';
import { useAuthStore } from '../../stores/authStore';

interface ChatRowProps {
  chat: Chat;
  active: boolean;
  index: number;
  onClick: () => void;
}

/** One conversation row in the chat list. Resolves peer profile + preview. */
export default function ChatRow({ chat, active, index, onClick }: ChatRowProps) {
  const myUid = useAuthStore((s) => s.user?.uid);
  const { peer } = usePeer(chat);

  const name = peer?.username || 'Loading…';
  const last = chat.lastMessage;
  const ts = chat.lastMessageTimestamp || chat.updatedAt;
  const isOwnLast = last?.senderUid === myUid;

  // lastMessage content is still ciphertext at the list level (we don't hold
  // every chat's session key eagerly), so show a neutral encrypted preview.
  const preview = last
    ? isOwnLast
      ? 'You: 🔒 Encrypted message'
      : '🔒 Encrypted message'
    : 'No messages yet';

  return (
    <motion.button
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition border-b border-slate-100 dark:border-slate-700/50 ${
        active ? 'bg-primary/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
      }`}
    >
      <Avatar name={name} photoURL={peer?.photoURL} size={48} online={peer?.online} />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-medium text-slate-900 dark:text-white truncate">{name}</h3>
          {ts && (
            <time className="text-xs text-slate-400 flex-shrink-0">
              {formatDistanceToNow(ts.toDate(), { addSuffix: false })}
            </time>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {isOwnLast &&
            (last?.type ? (
              <CheckCheck size={14} className="text-slate-400 flex-shrink-0" />
            ) : (
              <Check size={14} className="text-slate-400 flex-shrink-0" />
            ))}
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{preview}</p>
        </div>
      </div>

      {chat.unreadCount ? (
        <span className="flex-shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-secondary flex items-center justify-center text-xs text-white font-bold">
          {chat.unreadCount}
        </span>
      ) : (
        <Lock size={12} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />
      )}
    </motion.button>
  );
}
