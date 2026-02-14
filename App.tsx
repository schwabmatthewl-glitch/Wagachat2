
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
  const [isSidebarOpen, setSidebarOpen] = useState(true);
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
      <div className="flex h-screen bg-[#FFF9E6] overflow-hidden">
        {/* Sidebar for Navigation */}
        <div className={`transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-80' : 'w-24'} h-full hidden md:block`}>
          <Sidebar 
            isOpen={isSidebarOpen} 
            toggle={() => setSidebarOpen(!isSidebarOpen)} 
            friends={friends}
            onAddFriend={addFriend}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
          <Header onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)} userName={userName} />
          
          <main className="flex-1 overflow-hidden p-4 md:p-8 bg-gradient-to-br from-yellow-50 via-pink-50 to-blue-50">
            <div className="h-full max-w-6xl mx-auto overflow-y-auto custom-scrollbar">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/room/:id" element={<ChatWindow userName={userName} friends={friends} />} />
                <Route path="/video" element={<VideoConference userName={userName} friends={friends} />} />
              </Routes>
            </div>
          </main>

          {/* Mobile Navigation */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-white border-t-4 border-yellow-200 flex items-center justify-around z-50 px-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] rounded-t-[2.5rem]">
            <Link to="/" className="text-3xl hover:scale-125 transition-transform p-2 bg-yellow-100 rounded-2xl">🏠</Link>
            <Link to="/room/main" className="text-3xl hover:scale-125 transition-transform p-2 bg-blue-100 rounded-2xl">💬</Link>
            <Link to="/video" className="text-3xl hover:scale-125 transition-transform p-2 bg-pink-100 rounded-2xl">📹</Link>
          </nav>
        </div>
      </div>
    </Router>
  );
};

export default App;
