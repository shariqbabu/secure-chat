import { Routes, Route, useLocation } from 'react-router-dom';
import NavRail from './NavRail';
import ChatList from '../chat/ChatList';
import ChatWindow from '../chat/ChatWindow';
import NewChat from '../chat/NewChat';
import Settings from '../settings/Settings';

/**
 * WhatsApp-style master-detail layout.
 *  - Desktop (md+): NavRail | ChatList (380px) | detail pane, all visible.
 *  - Mobile: single column — list at /chat, detail at /chat/:id | /new | /settings.
 */
export default function ChatLayout() {
  const location = useLocation();
  // Anything deeper than "/chat" is a detail view on mobile.
  const isListRoot = location.pathname === '/chat' || location.pathname === '/chat/';

  return (
    <div className="flex h-screen bg-white dark:bg-slate-900 overflow-hidden">
      <NavRail />

      {/* List pane */}
      <aside
        className={`w-full md:w-[380px] md:border-r border-slate-200 dark:border-slate-700 flex-col ${
          isListRoot ? 'flex' : 'hidden'
        } md:flex`}
      >
        <ChatList />
      </aside>

      {/* Detail pane */}
      <main className={`flex-1 ${isListRoot ? 'hidden' : 'flex'} md:flex`}>
        <Routes>
          <Route path="/" element={<ChatWindow />} />
          <Route path="/new" element={<NewChat />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/:chatId" element={<ChatWindow />} />
        </Routes>
      </main>
    </div>
  );
}
