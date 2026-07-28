import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ChatLayout from './components/layout/ChatLayout';
import UnlockKeys from './components/auth/UnlockKeys';
import ToastContainer from './components/ui/ToastContainer';

function App() {
  const { isAuthenticated, needsKeyUnlock, restoreSession } = useAuthStore();

  // Re-sync with Firebase auth + resume E2EE session on load.
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <>
      <ToastContainer />
      {isAuthenticated && needsKeyUnlock ? (
        <UnlockKeys />
      ) : (
        <Routes>
          {!isAuthenticated ? (
            <>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : (
            <>
              <Route path="/chat/*" element={<ChatLayout />} />
              <Route path="*" element={<Navigate to="/chat" replace />} />
            </>
          )}
        </Routes>
      )}
    </>
  );
}

export default App;
