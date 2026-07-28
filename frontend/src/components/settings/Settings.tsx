import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Moon, Sun, ShieldCheck, Copy, Check } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import { generateKeyFingerprint } from '../../lib/crypto/keyExchange';
import { toast } from '../../stores/toastStore';
import Avatar from '../ui/Avatar';

/** User settings: profile, appearance, security (key fingerprint), sign out. */
export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggle } = useTheme();
  const [fingerprint, setFingerprint] = useState<string>('…');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.publicKey) {
      generateKeyFingerprint(user.publicKey)
        .then(setFingerprint)
        .catch(() => setFingerprint('unavailable'));
    }
  }, [user?.publicKey]);

  const copyFingerprint = async () => {
    try {
      await navigator.clipboard.writeText(fingerprint);
      setCopied(true);
      toast.success('Fingerprint copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 h-full">
      <div className="bg-primary text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/chat')} className="p-1 hover:bg-white/15 rounded-full transition" aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-lg w-full mx-auto">
        {/* Profile */}
        <section className="flex items-center gap-4">
          <Avatar name={user?.username} photoURL={user?.photoURL} size={64} online={user?.online} />
          <div className="min-w-0">
            <p className="text-lg font-semibold text-slate-900 dark:text-white truncate">{user?.username}</p>
            <p className="text-sm text-slate-500 truncate">{user?.email}</p>
          </div>
        </section>

        {/* Appearance */}
        <section className="card">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Appearance</h2>
          <button
            onClick={toggle}
            className="w-full flex items-center justify-between py-2"
          >
            <span className="flex items-center gap-3 text-slate-700 dark:text-slate-200">
              {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
              Theme
            </span>
            <span className="text-sm text-slate-500 capitalize">{theme}</span>
          </button>
        </section>

        {/* Security */}
        <section className="card">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <ShieldCheck size={16} /> Security
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
            Your safety number. Compare it with a contact (in person or over another channel) to
            verify no one is intercepting your messages.
          </p>
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2">
            <code className="flex-1 font-mono text-sm tracking-widest text-slate-800 dark:text-slate-200">
              {fingerprint}
            </code>
            <button onClick={copyFingerprint} className="p-1.5 text-slate-500 hover:text-primary transition" aria-label="Copy fingerprint">
              {copied ? <Check size={16} className="text-secondary" /> : <Copy size={16} />}
            </button>
          </div>
        </section>

        {/* Danger */}
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 py-3 rounded-lg transition font-medium"
        >
          <LogOut size={18} /> Sign out
        </button>
      </div>
    </div>
  );
}
