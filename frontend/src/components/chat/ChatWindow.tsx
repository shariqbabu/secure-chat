import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import Avatar from '../ui/Avatar';
import { usePeer } from '../../hooks/usePeer';
import { Phone, Video, MoreVertical, ArrowLeft, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ChatWindow() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { messages, chats, setActiveChat } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { peer } = usePeer(chatId ? chats.get(chatId) : undefined);

  useEffect(() => {
    if (chatId) setActiveChat(chatId);
  }, [chatId, setActiveChat]);

  const chatMessages = chatId ? messages.get(chatId) || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  if (!chatId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-chat-bg dark:bg-chat-dark-bg">
        <div className="text-center px-6">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck size={40} className="text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-2">Secure Chat</h2>
          <p className="text-slate-500 max-w-xs">
            Select a conversation to start messaging. Every message is end-to-end encrypted.
          </p>
        </div>
      </div>
    );
  }

  const name = peer?.username || 'Loading…';
  const status = peer?.online
    ? 'online'
    : peer?.lastSeen
    ? `last seen ${formatDistanceToNow(new Date((peer.lastSeen as any).toDate?.() ?? peer.lastSeen), { addSuffix: true })}`
    : 'offline';

  return (
    <div className="flex-1 flex flex-col bg-chat-bg dark:bg-chat-dark-bg h-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => navigate('/chat')}
            className="md:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <Avatar name={name} photoURL={peer?.photoURL} size={40} online={peer?.online} />
          <div className="min-w-0">
            <p className="font-medium truncate text-slate-900 dark:text-white">{name}</p>
            <p className="text-xs text-slate-500 truncate">{status}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition" aria-label="Voice call">
            <Phone size={19} />
          </button>
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition" aria-label="Video call">
            <Video size={19} />
          </button>
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition" aria-label="More options">
            <MoreVertical size={19} />
          </button>
        </div>
      </div>

      {/* Encryption notice */}
      <div className="flex justify-center py-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full">
          <ShieldCheck size={12} />
          Messages are end-to-end encrypted
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {chatMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400 text-sm">No messages yet. Say hello 👋</p>
          </div>
        ) : (
          chatMessages.map((message) => (
            <MessageBubble
              key={message.messageId}
              message={message}
              isOwn={message.senderUid === user?.uid}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput chatId={chatId} />
    </div>
  );
}
