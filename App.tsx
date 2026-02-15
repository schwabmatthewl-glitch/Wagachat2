
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { db } from './firebase.ts';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import Header from './components/Header.tsx';
import Sidebar from './components/Sidebar.tsx';
import ChatWindow from './components/ChatWindow.tsx';
import VideoConference from './components/VideoConference.tsx';
import WelcomeScreen from './components/WelcomeScreen.tsx';
import Dashboard from './components/Dashboard.tsx';
import { INITIAL_FRIENDS } from './constants.ts';
import { Friend } from './types.ts';

const AppContent: React.FC<{ 
  userName: string, 
  friends: Friend[], 
  onAddFriend: (f: Friend) => void 
}> = ({ userName, friends, onAddFriend }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const location = useLocation();

  // 1. Global Heartbeat to eliminate "Ghost Users" in the sidebar
  useEffect(() => {
    const userId = localStorage.getItem('wagachat_userId');
    if (!userId) return;

    const updateHeartbeat = async () => {
      try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          lastSeen: Date.now(),
          status: 'online'
        });
      } catch (e) {
        console.error("Heartbeat error", e);
      }
    };

    updateHeartbeat();
    const interval = setInterval(updateHeartbeat, 20000); // Every 20s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (location.pathname === '/room/main') {
      setHasUnread(false);
    }
  }, [location]);

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) return;
      
      const latestMsg = snapshot.docs[0].data();
      const currentUserId = localStorage.getItem('wagachat_userId');
      
      if (latestMsg.senderId !== currentUserId && location.pathname !== '/room/main') {
        setHasUnread(true);
      }
    });
    return () => unsubscribe();
  }, [location]);

  return (
    <div className="flex h-screen h-[100dvh] bg-[#FFF9E6] overflow-hidden relative w-full">
      {/* Sidebar logic fix: Removed any widths from the parent container when hidden to prevent Android cutoff */}
      <div 
        className={`
          fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
          ${isSidebarOpen ? 'translate-x-0 w-[85vw] md:w-[480px]' : '-translate-x-full w-0 md:translate-x-0 md:w-32'}
          ${!isSidebarOpen ? 'pointer-events-none md:pointer-events-auto overflow-hidden' : ''}
        `}
      >
        <Sidebar 
          isOpen={isSidebarOpen || window.innerWidth >= 768} 
          toggle={() => setSidebarOpen(!isSidebarOpen)} 
          friends={friends}
          onAddFriend={onAddFriend}
          hasUnread={hasUnread}
        />
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area: Ensure w-full and min-w-0 for flex layout */}
      <div className="flex-1 flex flex-col min-w-0 w-full h-full overflow-hidden relative">
        <Header onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)} userName={userName} />
        
        <main className="flex-1 overflow-hidden p-2 md:p-8 bg-gradient-to-br from-yellow-50 via-pink-50 to-blue-50 relative w-full">
          <div className="h-full w-full max-w-[1400px] mx-auto overflow-hidden relative">
            <Routes>
              <Route path="/" element={<Dashboard onOpenSearch={() => setSidebarOpen(true)} />} />
              <Route path="/room/:id" element={<ChatWindow userName={userName} friends={friends} />} />
              <Route path="/video" element={<VideoConference userName={userName} />} />
            </Routes>
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden h-24 bg-white border-t-4 border-yellow-200 flex items-center justify-around shrink-0 z-30 px-4 rounded-t-[3rem] shadow-lg">
          <Link to="/" className="text-4xl p-3 hover:bg-yellow-50 rounded-2xl transition-colors">🏠</Link>
          <Link to="/room/main" className="text-4xl p-3 hover:bg-blue-50 rounded-2xl transition-colors relative">
            💬
            {hasUnread && <span className="absolute top-2 right-2 w-4 h-4 bg-pink-500 border-2 border-white rounded-full"></span>}
          </Link>
          <Link to="/video" className="text-4xl p-3 hover:bg-pink-50 rounded-2xl transition-colors">📹</Link>
          <button onClick={() => setSidebarOpen(true)} className="text-4xl p-3 hover:bg-green-50 rounded-2xl transition-colors">🔍</button>
        </nav>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [userName, setUserName] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>(INITIAL_FRIENDS);

  const addFriend = (newFriend: Friend) => {
    if (!friends.find(f => f.id === newFriend.id)) {
      setFriends([...friends, newFriend]);
    }
  };

  if (!userName) {
    return <WelcomeScreen onStart={setUserName} />;
  }

  return (
    <Router>
      <AppContent userName={userName} friends={friends} onAddFriend={addFriend} />
    </Router>
  );
};

export default App;
