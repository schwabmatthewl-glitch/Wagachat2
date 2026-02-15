
import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Header from './components/Header.tsx';
import Sidebar from './components/Sidebar.tsx';
import ChatWindow from './components/ChatWindow.tsx';
import VideoConference from './components/VideoConference.tsx';
import WelcomeScreen from './components/WelcomeScreen.tsx';
import Dashboard from './components/Dashboard.tsx';
import { INITIAL_FRIENDS } from './constants.ts';
import { Friend } from './types.ts';

const App: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
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
      <div className="flex h-screen h-[100dvh] bg-[#FFF9E6] overflow-hidden relative w-full">
        {/* Expanded Sidebar: Open = 480px, Collapsed = 128px */}
        <div 
          className={`
            fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
            ${isSidebarOpen ? 'translate-x-0 w-[85vw] md:w-[480px]' : '-translate-x-full w-0 md:translate-x-0 md:w-32'}
          `}
        >
          <Sidebar 
            isOpen={isSidebarOpen || window.innerWidth >= 768} 
            toggle={() => setSidebarOpen(!isSidebarOpen)} 
            friends={friends}
            onAddFriend={addFriend}
          />
        </div>

        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
          <Header onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)} userName={userName} />
          
          <main className="flex-1 overflow-hidden p-3 md:p-8 bg-gradient-to-br from-yellow-50 via-pink-50 to-blue-50 relative">
            <div className="h-full max-w-[1400px] mx-auto overflow-hidden relative">
              <Routes>
                <Route path="/" element={<Dashboard onOpenSearch={() => setSidebarOpen(true)} />} />
                <Route path="/room/:id" element={<ChatWindow userName={userName} friends={friends} />} />
                <Route path="/video" element={<VideoConference userName={userName} />} />
              </Routes>
            </div>
          </main>

          {/* Mobile Bottom Nav */}
          <nav className="md:hidden h-24 bg-white border-t-4 border-yellow-200 flex items-center justify-around shrink-0 z-30 px-4 rounded-t-[3rem] shadow-lg">
            <Link to="/" className="text-4xl p-3 bg-yellow-100 rounded-2xl">🏠</Link>
            <Link to="/room/main" className="text-4xl p-3 bg-blue-100 rounded-2xl">💬</Link>
            <Link to="/video" className="text-4xl p-3 bg-pink-100 rounded-2xl">📹</Link>
            <button onClick={() => setSidebarOpen(true)} className="text-4xl p-3 bg-green-100 rounded-2xl">🔍</button>
          </nav>
        </div>
      </div>
    </Router>
  );
};

export default App;
