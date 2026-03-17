import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { db, auth } from './firebase.ts';
import { doc, onSnapshot, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import Header from './components/Header.tsx';
import Sidebar from './components/Sidebar.tsx';
import ChatWindow from './components/ChatWindow.tsx';
import VideoConference from './components/VideoConference.tsx';
import AuthScreen from './components/AuthScreen.tsx';
import Dashboard from './components/Dashboard.tsx';
import Settings from './components/Settings.tsx';

// 4 Hour Inactivity Timeout
const INACTIVITY_LIMIT = 4 * 60 * 60 * 1000; 

const AppContent: React.FC<{ 
  user: any,
  setUser: (user: any) => void,
  onLogout: () => void
}> = ({ user, setUser, onLogout }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [dmFriend, setDmFriend] = useState<any>(null);
  const location = useLocation();

  // Clear dmFriend when navigating away from DM routes
  useEffect(() => {
    if (!location.pathname.startsWith('/dm/')) {
      setDmFriend(null);
    }
  }, [location.pathname]);

  // Activity Tracking
  useEffect(() => {
    const handleActivity = () => {
      localStorage.setItem('wagachat_last_activity', Date.now().toString());
    };

    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('mousemove', handleActivity);

    const checkInactivity = setInterval(() => {
      const lastActivity = parseInt(localStorage.getItem('wagachat_last_activity') || '0');
      if (lastActivity && (Date.now() - lastActivity > INACTIVITY_LIMIT)) {
        console.log("Session expired due to inactivity.");
        onLogout();
      }
    }, 60000); // Check every minute

    return () => {
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      clearInterval(checkInactivity);
    };
  }, [onLogout]);

  useEffect(() => {
    if (!user?.id) return;

    const userRef = doc(db, "users", user.id);
    
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const newData = docSnap.data();
        setUser(newData);
        localStorage.setItem('wagachat_session', JSON.stringify(newData));
      }
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
  }, [user.id, setUser]);

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
          onSelectFriend={(friend) => {
            setDmFriend(friend);
            setSidebarOpen(false);
          }}
        />
      </div>

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 w-full h-full overflow-hidden relative">
        <Header onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)} user={user} />
        
        <main className="flex-1 overflow-hidden p-2 md:p-8 bg-gradient-to-br from-yellow-50 via-pink-50 to-blue-50 relative w-full">
          <div className="h-full w-full max-w-[1400px] mx-auto overflow-hidden relative">
            <Routes>
              <Route path="/" element={<Dashboard onOpenSearch={() => setSidebarOpen(true)} />} />
              <Route path="/room/:id" element={<ChatWindow user={user} />} />
              <Route path="/dm/:friendId" element={<ChatWindow user={user} dmFriend={dmFriend} />} />
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Check inactivity — sign out if session is too old
        const lastActivity = parseInt(localStorage.getItem('wagachat_last_activity') || '0');
        if (lastActivity && (Date.now() - lastActivity > INACTIVITY_LIMIT)) {
          await signOut(auth);
          localStorage.removeItem('wagachat_last_activity');
          setUser(null);
          setLoading(false);
          return;
        }

        // Derive username from internal Firebase Auth email
        const username = firebaseUser.email!.replace('@wagachat.app', '');
        const snap = await getDoc(doc(db, "users", username));
        if (snap.exists()) {
          setUser(snap.data());
          localStorage.setItem('wagachat_last_activity', Date.now().toString());
        } else {
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem('wagachat_last_activity', Date.now().toString());
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    localStorage.removeItem('wagachat_last_activity');
  };

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-yellow-50 font-kids text-3xl text-blue-500">Loading... 🎈</div>;

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <Router>
      <AppContent user={user} setUser={setUser} onLogout={handleLogout} />
    </Router>
  );
};

export default App;