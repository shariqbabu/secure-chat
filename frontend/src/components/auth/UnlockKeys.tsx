import { useState, FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

/**
 * Shown after a session restore (page reload) when the user's ECDH private key
 * is password-encrypted and must be re-entered to decrypt messages this session.
 */
export default function UnlockKeys() {
  const { user, unlockWithPassword, logout, isLoading, error } = useAuthStore();
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await unlockWithPassword(password);
    } catch {
      /* error surfaced via store */
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-light p-4">
      <div className="card w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-primary mb-1">Unlock your chats</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Welcome back{user?.username ? `, ${user.username}` : ''}. Enter your password to
            decrypt your messages on this device.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-base"
            placeholder="Your password"
            autoFocus
            required
            disabled={isLoading}
          />
          <button type="submit" className="btn-primary w-full" disabled={isLoading}>
            {isLoading ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>

        <button
          onClick={() => logout()}
          className="w-full text-center text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mt-4 transition"
        >
          Sign out instead
        </button>
      </div>
    </div>
  );
}
