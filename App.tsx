
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { db } from './firebase.ts';
import { doc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import Header from './components/Header.tsx';
import Sidebar from './components/Sidebar.tsx';
import ChatWindow from './components/ChatWindow.tsx';
import VideoConference from './components/VideoConference.tsx';
import AuthScreen from './components/AuthScreen.tsx';
import Dashboard from './components/Dashboard.tsx';
import Settings from './components/Settings.tsx';
import { Friend } from './types.ts';

const AppContent: React.FC<{ 
  user: any,
  onLogout: () => void
}> = ({ user, onLogout }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!user?.id) return;

    // Heartbeat & Sync
    const userRef = doc(db, "users", user.id);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      // Logic to sync profile data if needed
    });

    const updateHeartbeat = async () => {
      try {
        await updateDoc(userRef, {
          lastSeen: Date.now(),
          status: 'online'
        });
      } catch (e) {
        console.error("Heartbeat error", e);
      }
    };

    updateHeartbeat();
    const interval = setInterval(updateHeartbeat, 20000); 
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [user.id]);

  return (
    <div className="flex h-screen h-[100dvh] bg-[#FFF9E6] overflow-hidden relative w-full">
      <div 
        className={`
          fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out 
          md:relative md:translate-x-0 md:w-80 lg:w-96
          ${isSidebarOpen ? 'translate-x-0 w-[85vw]' : '-translate-x-full w-0'}
          ${!isSidebarOpen ? 'pointer-events-none md:pointer-events-auto overflow-hidden' : 'pointer-events-auto'}
        `}
      >
        <Sidebar 
          isOpen={isSidebarOpen || window.innerWidth >= 768} 
          toggle={() => setSidebarOpen(!isSidebarOpen)} 
          userId={user.id}
          hasUnread={hasUnread}
        />
      </div>

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 w-full h-full overflow-hidden relative">
        <Header onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)} userName={user.name} />
        
        <main className="flex-1 overflow-hidden p-2 md:p-8 bg-gradient-to-br from-yellow-50 via-pink-50 to-blue-50 relative w-full">
          <div className="h-full w-full max-w-[1400px] mx-auto overflow-hidden relative">
            <Routes>
              <Route path="/" element={<Dashboard onOpenSearch={() => setSidebarOpen(true)} />} />
              <Route path="/room/:id" element={<ChatWindow user={user} />} />
              <Route path="/video" element={<VideoConference userName={user.name} />} />
              <Route path="/settings" element={<Settings user={user} onLogout={onLogout} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>

        <nav className="md:hidden h-24 bg-white border-t-4 border-yellow-200 flex items-center justify-around shrink-0 z-30 px-4 rounded-t-[3rem] shadow-lg">
          <Link to="/" className="text-4xl p-3">🏠</Link>
          <Link to="/room/main" className="text-4xl p-3 relative">
            💬
            {hasUnread && <span className="absolute top-2 right-2 w-4 h-4 bg-pink-500 border-2 border-white rounded-full"></span>}
          </Link>
          <Link to="/settings" className="text-4xl p-3">⚙️</Link>
          <button onClick={() => setSidebarOpen(true)} className="text-4xl p-3">🔍</button>
        </nav>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('wagachat_session');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData: any, remember: boolean) => {
    setUser(userData);
    if (remember) {
      localStorage.setItem('wagachat_session', JSON.stringify(userData));
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('wagachat_session');
  };

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-yellow-50 font-kids text-3xl text-blue-500">Loading... 🎈</div>;

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <Router>
      <AppContent user={user} onLogout={handleLogout} />
    </Router>
  );
};

export default App;
