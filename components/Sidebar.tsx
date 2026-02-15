
import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { db } from '../firebase.ts';
import { collection, onSnapshot, query, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Friend } from '../types.ts';

interface Props {
  isOpen: boolean;
  toggle: () => void;
  friends: Friend[];
  onAddFriend: (friend: Friend) => void;
  hasUnread?: boolean;
}

const STALE_ONLINE_THRESHOLD = 60000; // 60 seconds of inactivity = offline/ghost

const Sidebar: React.FC<Props> = ({ isOpen, toggle, friends, onAddFriend, hasUnread }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Friend[]>([]);

  useEffect(() => {
    const q = query(collection(db, "users"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: Friend[] = [];
      const currentUserId = localStorage.getItem('wagachat_userId');
      const now = Date.now();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.id !== currentUserId) {
          // Check staleness here to prevent ghosts in the sidebar
          const lastSeen = data.lastSeen || 0;
          const isActuallyOnline = (now - lastSeen) < STALE_ONLINE_THRESHOLD;
          
          if (isActuallyOnline) {
            users.push({
              id: data.id,
              name: data.name,
              avatar: data.avatar,
              status: 'online',
              color: data.color || 'bg-blue-400'
            });
          }
        }
      });
      setOnlineUsers(users);
    });
    return () => unsubscribe();
  }, []);

  const searchResults = searchTerm.trim() 
    ? onlineUsers.filter(f => 
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !friends.find(existing => existing.id === f.id)
      )
    : [];

  const navItems = [
    { path: '/', name: 'Home Adventure', icon: '🏠', color: 'blue' },
    { path: '/room/main', name: 'Chat Clubhouse', icon: '💬', color: 'blue', notify: hasUnread },
    { path: '/video', name: 'Live Video Party', icon: '📹', color: 'pink' },
  ];

  return (
    <div className={`h-full bg-white border-r-8 border-yellow-100 flex flex-col transition-all duration-300 pointer-events-auto ${isOpen ? 'p-8' : 'p-4 items-center'}`}>
      <div className="mb-12">
        <h2 className={`font-kids text-blue-500 mb-8 flex items-center gap-3 ${isOpen ? 'text-2xl' : 'hidden'}`}>
          <span>🚀 Explore</span>
        </h2>
        <div className="space-y-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => {
                let colorClass = 'bg-blue-500';
                if (item.color === 'pink') colorClass = 'bg-pink-500';
                
                return `
                  flex items-center gap-6 p-5 rounded-[2.5rem] transition-all relative
                  ${isActive 
                    ? `${colorClass} text-white shadow-2xl scale-105` 
                    : 'hover:bg-yellow-50 text-gray-600 border-2 border-transparent hover:border-yellow-200'}
                `;
              }}
            >
              <span className="text-4xl">{item.icon}</span>
              {isOpen && <span className="font-kids text-xl tracking-wide">{item.name}</span>}
              {item.notify && (
                <span className="absolute top-2 right-2 w-5 h-5 bg-pink-500 border-4 border-white rounded-full animate-bounce shadow-md"></span>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className={`flex items-center justify-between mb-8 ${isOpen ? '' : 'hidden'}`}>
          <h2 className="font-kids text-pink-500 text-2xl">Friends Online</h2>
          <button 
            onClick={() => setIsSearching(!isSearching)}
            className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all ${isSearching ? 'bg-red-100 text-red-500' : 'bg-pink-100 text-pink-500'} hover:scale-110 shadow-md`}
          >
            {isSearching ? '✖' : '🔍'}
          </button>
        </div>

        {isOpen && isSearching && (
          <div className="mb-10 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="relative">
              <input
                type="text"
                placeholder="Find a friend..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-5 rounded-3xl border-4 border-dashed border-pink-200 focus:border-pink-400 focus:ring-4 focus:ring-pink-50 outline-none text-xl font-bold placeholder-pink-100 text-pink-600"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-3xl">✨</span>
            </div>
            {searchResults.length > 0 && (
              <div className="bg-white rounded-[2.5rem] p-4 shadow-2xl border-4 border-pink-50 max-h-64 overflow-y-auto space-y-3 custom-scrollbar">
                {searchResults.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-4 hover:bg-pink-50 rounded-2xl transition-all group border-2 border-transparent hover:border-pink-100">
                    <div className="flex items-center gap-4">
                      <span className={`w-12 h-12 rounded-2xl ${f.color} flex items-center justify-center text-2xl border-2 border-white shadow-md`}>{f.avatar}</span>
                      <span className="font-bold text-gray-700 text-lg">{f.name}</span>
                    </div>
                    <button 
                      onClick={() => {
                        onAddFriend(f);
                        setSearchTerm('');
                        setIsSearching(false);
                      }}
                      className="w-10 h-10 flex items-center justify-center bg-pink-500 text-white rounded-xl font-bold hover:scale-125 transition-transform shadow-lg"
                    >
                      ＋
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-5 overflow-y-auto flex-1 pr-3 custom-scrollbar">
          {friends.map((friend) => (
            <div key={friend.id} className="group relative">
              <div className={`
                flex items-center gap-5 p-4 rounded-[2rem] transition-all cursor-pointer
                bg-white border-2 border-transparent hover:border-pink-200 hover:shadow-xl
                ${!isOpen && 'justify-center'}
              `}>
                <div className={`
                  w-14 h-14 rounded-2xl ${friend.color} flex items-center justify-center text-3xl shadow-md
                  border-4 border-white flex-shrink-0 group-hover:scale-110 transition-transform
                `}>
                  {friend.avatar}
                </div>
                {isOpen && (
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-xl tracking-wide truncate">{friend.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-3 h-3 rounded-full ${friend.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                      <p className={`text-xs font-black uppercase tracking-widest ${friend.status === 'online' ? 'text-green-500' : 'text-gray-400'}`}>
                        {friend.status === 'online' ? 'Ready to Chat!' : 'Sleeping'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={toggle}
        className="mt-10 p-5 rounded-3xl bg-yellow-400 text-white font-kids text-xl hover:bg-yellow-500 transition-all shadow-xl active:scale-95 border-b-8 border-yellow-600 active:border-b-0"
      >
        {isOpen ? '⬅ Hide Menu' : '➡️'}
      </button>
    </div>
  );
};

export default Sidebar;
