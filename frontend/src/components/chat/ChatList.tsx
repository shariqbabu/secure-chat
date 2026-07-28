import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Plus, Lock, MessageCircle } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import ChatRow from './ChatRow';
import ChatListSkeleton from './ChatListSkeleton';

/**
 * The conversation list. On mobile this is the master pane; tapping a row
 * navigates to /chat/:id (the detail pane).
 */
export default function ChatList() {
  const navigate = useNavigate();
  const { chatId: activeId } = useParams<{ chatId: string }>();
  const { chats, isLoading, hasHiddenChats, openHiddenChats } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');

  const list = Array.from(chats.values());
  const filtered = searchQuery
    ? list.filter((c) => c.chatId.toLowerCase().includes(searchQuery.toLowerCase()))
    : list;

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 h-full">
      {/* Header */}
      <div className="bg-primary text-white px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">Chats</h1>
          <button
            onClick={() => navigate('/chat/new')}
            className="p-2 hover:bg-white/15 rounded-full transition"
            aria-label="New chat"
          >
            <Plus size={22} />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats…"
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/15 text-white placeholder-white/60 focus:outline-none focus:bg-white/25 transition"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && list.length === 0 ? (
          <ChatListSkeleton />
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-center p-8"
          >
            <div className="w-20 h-20 mb-4 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <MessageCircle size={36} className="text-slate-400" />
            </div>
            <h2 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-1">
              {searchQuery ? 'No chats found' : 'No conversations yet'}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {searchQuery ? 'Try a different search' : 'Start a new encrypted conversation'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => navigate('/chat/new')}
                className="px-6 py-2 bg-primary text-white rounded-full hover:bg-primary-dark transition"
              >
                Start chatting
              </button>
            )}
          </motion.div>
        ) : (
          filtered.map((chat, i) => (
            <ChatRow
              key={chat.chatId}
              chat={chat}
              index={i}
              active={chat.chatId === activeId}
              onClick={() => navigate(`/chat/${chat.chatId}`)}
            />
          ))
        )}
      </div>

      {/* Hidden chats unlock */}
      {hasHiddenChats && (
        <button
          onClick={() => {
            const pin = prompt('Enter PIN to unlock hidden chats');
            if (pin) openHiddenChats(pin);
          }}
          className="m-3 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
        >
          <Lock size={18} />
          <span className="text-sm font-medium">Unlock Hidden Chats</span>
        </button>
      )}
    </div>
  );
}
