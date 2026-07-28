import { motion } from 'framer-motion';
import { Message, MessageWithDecrypted } from '@shared/types/chat';
import { Check, CheckCheck, Clock, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MessageBubbleProps {
  message: MessageWithDecrypted;
  isOwn: boolean;
  showTimestamp?: boolean;
}

export default function MessageBubble({ message, isOwn, showTimestamp = true }: MessageBubbleProps) {
  const getStatusIcon = () => {
    switch (message.status) {
      case 'sent':
        return <Check size={14} className="text-slate-400" />;
      case 'delivered':
        return <CheckCheck size={14} className="text-slate-400" />;
      case 'read':
        return <CheckCheck size={14} className="text-secondary" />;
      default:
        return <Clock size={14} className="text-slate-400" />;
    }
  };

  const bubbleClass = isOwn
    ? 'bg-chat-sent text-white'
    : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white';

  const alignmentClass = isOwn ? 'justify-end' : 'justify-start';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex ${alignmentClass} mb-2`}
    >
      <div
        className={`${bubbleClass} max-w-[70%] md:max-w-[60%] rounded-2xl px-4 py-2 ${
          isOwn ? 'rounded-br-md' : 'rounded-bl-md'
        } shadow-sm`}
      >
        {/* Message Content */}
        <div className="break-words">
          {message.type === 'text' && (
            <p className="text-sm md:text-base leading-relaxed">{message.decryptedContent}</p>
          )}

          {message.type === 'image' && (
            <div className="mb-2">
              <img
                src={message.metadata?.url}
                alt="Shared image"
                className="rounded-lg max-w-full"
                loading="lazy"
              />
              {message.decryptedContent && message.decryptedContent !== '🖼️ Image' && (
                <p className="text-sm mt-2">{message.decryptedContent}</p>
              )}
            </div>
          )}

          {message.type === 'file' && (
            <div className="flex items-center gap-2 py-1">
              <div className="w-10 h-10 rounded bg-white/20 flex items-center justify-center">
                <span className="text-lg">📄</span>
              </div>
              <div>
                <p className="text-sm font-medium">{message.metadata?.fileName}</p>
                <p className="text-xs opacity-70">{message.metadata?.fileSize}</p>
              </div>
            </div>
          )}

          {message.type === 'voice' && (
            <div className="flex items-center gap-3 py-1">
              <button className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <div className="flex-1">
                <div className="h-1 bg-white/30 rounded-full overflow-hidden">
                  <div className="h-full bg-white/60 w-1/3 rounded-full" />
                </div>
                <p className="text-xs mt-1 opacity-70">{message.metadata?.duration}</p>
              </div>
            </div>
          )}
        </div>

        {/* Timestamp and Status */}
        {showTimestamp && (
          <div
            className={`flex items-center justify-end gap-1 mt-1 ${
              isOwn ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {isOwn && (
              <span className="flex items-center gap-1" aria-label={`Message ${message.status}`}>
                {getStatusIcon()}
              </span>
            )}
            <time className="text-xs" dateTime={message.timestamp.toDate().toISOString()}>
              {formatDistanceToNow(message.timestamp.toDate(), { addSuffix: false })}
            </time>
            <Lock size={12} className="opacity-50" aria-label="End-to-end encrypted" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
