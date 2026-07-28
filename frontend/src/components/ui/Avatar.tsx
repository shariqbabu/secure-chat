import { useMemo } from 'react';

interface AvatarProps {
  name?: string | null;
  photoURL?: string | null;
  size?: number;
  online?: boolean;
  className?: string;
}

// Deterministic gradient from a string so each user keeps a stable color.
const GRADIENTS = [
  'from-emerald-400 to-teal-600',
  'from-sky-400 to-indigo-600',
  'from-fuchsia-400 to-purple-600',
  'from-amber-400 to-orange-600',
  'from-rose-400 to-pink-600',
  'from-lime-400 to-green-600',
  'from-cyan-400 to-blue-600',
  'from-violet-400 to-indigo-700',
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

/**
 * Consistent avatar used everywhere: real photo when available, otherwise a
 * gradient circle with the initial. Replaces the via.placeholder.com images.
 */
export default function Avatar({ name, photoURL, size = 40, online, className = '' }: AvatarProps) {
  const label = (name || '?').trim();
  const initial = label.charAt(0).toUpperCase() || '?';
  const gradient = useMemo(() => GRADIENTS[hashString(label) % GRADIENTS.length], [label]);
  const dot = Math.max(8, Math.round(size * 0.28));

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      {photoURL ? (
        <img
          src={photoURL}
          alt={label}
          className="w-full h-full rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className={`w-full h-full rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-semibold`}
          style={{ width: size, height: size, fontSize: size * 0.42 }}
        >
          {initial}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-white dark:ring-slate-800 ${
            online ? 'bg-secondary' : 'bg-slate-400'
          }`}
          style={{ width: dot, height: dot }}
          aria-label={online ? 'online' : 'offline'}
        />
      )}
    </div>
  );
}
