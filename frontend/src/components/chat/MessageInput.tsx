import { useState, useRef, FormEvent, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Send, Paperclip, Mic, Smile, X } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';

interface MessageInputProps {
  chatId: string;
}

export default function MessageInput({ chatId }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, activeChat } = useChatStore();
  const { user } = useAuthStore();

  const handleCommand = async (text: string): Promise<boolean> => {
    const trimmed = text.trim();

    // Hidden chat commands
    if (trimmed === '/hide') {
      if (activeChat) {
        await useChatStore.getState().hideChat(chatId);
        setMessage('');
        return true;
      }
    }

    if (trimmed.startsWith('/open')) {
      const pin = trimmed.split(' ')[1];
      if (pin) {
        await useChatStore.getState().openHiddenChats(pin);
        setMessage('');
        return true;
      }
    }

    return false;
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    if (!message.trim() || !user) return;

    // Check for commands
    const isCommand = await handleCommand(message);
    if (isCommand) return;

    const text = message;
    setMessage('');
    setShowEmojiPicker(false);
    setShowAttachments(false);

    try {
      // Encryption (ECDH session key → AES-256-GCM) happens inside the store.
      await sendMessage(chatId, text);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessage(text); // restore on failure
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTyping = () => {
    setIsTyping(true);
    // Send typing indicator via WebSocket
    setTimeout(() => setIsTyping(false), 1000);
  };

  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-3">
      {/* Emoji Picker */}
      {showEmojiPicker && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3"
        >
          <EmojiPicker
            width="100%"
            height={320}
            theme={(document.documentElement.classList.contains('dark') ? 'dark' : 'light') as Theme}
            onEmojiClick={(emoji) => {
              setMessage((m) => m + emoji.emoji);
              inputRef.current?.focus();
            }}
          />
        </motion.div>
      )}

      {/* Attachment Menu */}
      {showAttachments && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="mb-3"
        >
          <div className="flex gap-2">
            <button className="flex-1 flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
              <span className="text-2xl">📷</span>
              <span className="text-xs">Image</span>
            </button>
            <button className="flex-1 flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
              <span className="text-2xl">📄</span>
              <span className="text-xs">Document</span>
            </button>
            <button className="flex-1 flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
              <span className="text-2xl">📍</span>
              <span className="text-xs">Location</span>
            </button>
            <button className="flex-1 flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
              <span className="text-2xl">👤</span>
              <span className="text-xs">Contact</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        {/* Attachments Button */}
        <button
          type="button"
          onClick={() => setShowAttachments(!showAttachments)}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition text-slate-600 dark:text-slate-300"
          aria-label={showAttachments ? 'Close attachments' : 'Add attachment'}
        >
          {showAttachments ? <X size={20} /> : <Paperclip size={20} />}
        </button>

        {/* Message Input */}
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              adjustTextareaHeight();
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="w-full px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary transition"
            style={{ maxHeight: '120px' }}
          />

          {/* Emoji Button */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition"
            aria-label="Emoji picker"
          >
            <Smile size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        {/* Send/Voice Button */}
        {message.trim() ? (
          <motion.button
            type="submit"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="p-3 bg-secondary hover:bg-secondary-dark text-white rounded-full transition shadow-md"
            aria-label="Send message"
          >
            <Send size={20} />
          </motion.button>
        ) : (
          <button
            type="button"
            onMouseDown={() => setIsRecording(true)}
            onMouseUp={() => setIsRecording(false)}
            onMouseLeave={() => setIsRecording(false)}
            className={`p-3 rounded-full transition shadow-md ${
              isRecording
                ? 'bg-red-500 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
            aria-label="Hold to record voice message"
          >
            <Mic size={20} />
          </button>
        )}
      </form>

      {/* Recording Indicator */}
      {isRecording && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300"
        >
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm">Recording...</span>
        </motion.div>
      )}

      {/* Command Hints */}
      {message.startsWith('/') && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-xs text-slate-500 dark:text-slate-400"
        >
          <p>
            <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">/hide</code> - Hide this chat
          </p>
          <p>
            <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">/open {'<PIN>'}</code> - Open hidden chats
          </p>
        </motion.div>
      )}
    </div>
  );
}
