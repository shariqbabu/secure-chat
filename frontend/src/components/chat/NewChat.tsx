import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Loader2 } from 'lucide-react';
import type { UserProfile } from '@shared/types/user';
import { searchUsers } from '../../lib/firestore';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { toast } from '../../stores/toastStore';
import Avatar from '../ui/Avatar';

/** Search users by name/email and start (or open) an encrypted 1:1 chat. */
export default function NewChat() {
  const navigate = useNavigate();
  const myUid = useAuthStore((s) => s.user?.uid);
  const createChat = useChatStore((s) => s.createChat);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<number | null>(null);

  useEffect(() => {
    if (!myUid) return;
    if (debounce.current) window.clearTimeout(debounce.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounce.current = window.setTimeout(async () => {
      try {
        setResults(await searchUsers(q, myUid));
      } catch (e: any) {
        toast.error(e.message || 'Search failed');
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current);
    };
  }, [q, myUid]);

  const startChat = async (uid: string) => {
    try {
      const chat = await createChat(uid);
      navigate(`/chat/${chat.chatId}`);
    } catch (e: any) {
      toast.error(e.message || 'Could not start chat');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 h-full">
      <div className="bg-primary text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/chat')} className="p-1 hover:bg-white/15 rounded-full transition" aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-semibold">New chat</h1>
      </div>

      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary transition"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {searching && (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 className="animate-spin" size={22} />
          </div>
        )}

        {!searching && q.trim().length >= 2 && results.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8">No users found for “{q}”.</p>
        )}

        {!searching && q.trim().length < 2 && (
          <p className="text-center text-sm text-slate-400 py-8">Type at least 2 characters to search.</p>
        )}

        {results.map((u, i) => (
          <motion.button
            key={u.uid}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => startChat(u.uid)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition border-b border-slate-100 dark:border-slate-700/50"
          >
            <Avatar name={u.username} photoURL={u.photoURL} size={44} online={u.online} />
            <div className="min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate">{u.username}</p>
              <p className="text-xs text-slate-500 truncate">{u.email}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
