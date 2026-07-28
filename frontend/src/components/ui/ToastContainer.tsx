import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore } from '../../stores/toastStore';

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const ACCENT = {
  success: 'border-l-secondary',
  error: 'border-l-red-500',
  info: 'border-l-primary',
};

/** Fixed toast stack, bottom-right. Mount once near the app root. */
export default function ToastContainer() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              className={`pointer-events-auto flex items-start gap-3 bg-white dark:bg-slate-800 shadow-lg rounded-lg border-l-4 ${ACCENT[t.kind]} px-4 py-3`}
            >
              <Icon
                size={20}
                className={
                  t.kind === 'success'
                    ? 'text-secondary'
                    : t.kind === 'error'
                    ? 'text-red-500'
                    : 'text-primary'
                }
              />
              <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
