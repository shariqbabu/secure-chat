import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, Moon, Sun, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import Avatar from '../ui/Avatar';

/** Slim desktop navigation rail — replaces the old duplicated Sidebar list. */
export default function NavRail() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggle } = useTheme();

  return (
    <nav className="hidden md:flex flex-col items-center justify-between w-16 bg-sidebar-light dark:bg-sidebar-dark border-r border-slate-200 dark:border-slate-700 py-4">
      <div className="flex flex-col items-center gap-4">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white" title="Secure Chat">
          <ShieldCheck size={20} />
        </div>
        <button
          onClick={() => navigate('/chat/settings')}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>
        <button
          onClick={toggle}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => logout()}
          className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          aria-label="Logout"
        >
          <LogOut size={20} />
        </button>
        <button onClick={() => navigate('/chat/settings')} aria-label="Profile">
          <Avatar name={user?.username} photoURL={user?.photoURL} size={36} />
        </button>
      </div>
    </nav>
  );
}
