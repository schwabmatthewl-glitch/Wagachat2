
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
}

const Sidebar: React.FC<Props> = ({ isOpen, toggle, friends, onAddFriend }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Friend[]>([]);

  // Listen to the cloud for anyone who joins!
  useEffect(() => {
    const q = query(collection(db, "users"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: Friend[] = [];
      const currentUserId = localStorage.getItem('wagachat_userId');
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Don't show ourselves in the search/list
        if (data.id !== currentUserId) {
          users.push({
            id: data.id,
            name: data.name,
            avatar: data.avatar,
            status: data.status,
            color: data.color || 'bg-blue-400'
          });
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
    { path: '/', name: 'Home', icon: '🏠', color: 'blue' },
    { path: '/room/main', name: 'Clubhouse', icon: '💬', color: 'blue' },
    { path: '/video', name: 'Video Chat', icon: '📹', color: 'pink' },
  ];

  return (
    <div className={`h-full bg-white border-r-8 border-yellow-100 flex flex-col transition-all duration-300 ${isOpen ? 'p-6' : 'p-3 items-center'}`}>
      <div className="mb-10">
        <h2 className={`font-kids text-blue-500 mb-6 flex items-center gap-2 ${isOpen ? 'text-xl' : 'hidden'}`}>
          <span>Main Menu</span>
        </h2>
        <div className="space-y-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => {
                let colorClass = 'bg-blue-500';
                if (item.color === 'pink') colorClass = 'bg-pink-500';
                
                return `
                  flex items-center gap-4 p-4 rounded-[2rem] transition-all
                  ${isActive 
                    ? `${colorClass} text-white shadow-xl scale-105` 
                    : 'hover:bg-yellow-50 text-gray-600 border-2 border-transparent hover:border-yellow-200'}
                `;
              }}
            >
              <span className="text-3xl">{item.icon}</span>
              {isOpen && <span className="font-kids tracking-wide">{item.name}</span>}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className={`flex items-center justify-between mb-6 ${isOpen ? '' : 'hidden'}`}>
          <h2 className="font-kids text-pink-500 text-xl">Explorers</h2>
          <button 
            onClick={() => setIsSearching(!isSearching)}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${isSearching ? 'bg-red-100 text-red-500' : 'bg-pink-100 text-pink-500'} hover:scale-110 shadow-sm`}
          >
            {isSearching ? '✖' : '🔍'}
          </button>
        </div>

        {isOpen && isSearching && (
          <div className="mb-8 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="relative">
              <input
                type="text"
                placeholder="Search real friends..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-4 rounded-3xl border-4 border-dashed border-pink-200 focus:border-pink-400 focus:ring-4 focus:ring-pink-50 outline-none text-lg font-bold placeholder-pink-100 text-pink-600"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl">✨</span>
            </div>
            {searchResults.length > 0 ? (
              <div className="bg-white rounded-[2rem] p-3 shadow-xl border-4 border-pink-50 max-h-52 overflow-y-auto space-y-2 custom-scrollbar">
                {searchResults.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-3 hover:bg-pink-50 rounded-2xl transition-all group border-2 border-transparent hover:border-pink-100">
                    <div className="flex items-center gap-3">
                      <span className={`w-10 h-10 rounded-full ${f.color} flex items-center justify-center text-xl border-2 border-white shadow-sm`}>{f.avatar}</span>
                      <span className="font-bold text-gray-700">{f.name}</span>
                    </div>
                    <button 
                      onClick={() => {
                        onAddFriend(f);
                        setSearchTerm('');
                        setIsSearching(false);
                      }}
                      className="w-8 h-8 flex items-center justify-center bg-pink-500 text-white rounded-full font-bold hover:scale-125 transition-transform shadow-md"
                    >
                      ＋
                    </button>
                  </div>
                ))}
              </div>
            ) : searchTerm && (
              <div className="text-center p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <p className="text-sm text-gray-400 font-bold italic">No explorers found yet!</p>
                <p className="text-xs text-gray-300">Wait for them to log in on another device!</p>
              </div>
            )}
          </div>
        )}

        {friends.length === 0 && isOpen && !isSearching && (
          <div className="text-center p-6 bg-pink-50 rounded-[2rem] border-4 border-dashed border-pink-100">
            <p className="text-pink-400 font-bold text-sm mb-2">No friends yet!</p>
            <p className="text-xs text-pink-300">Tap the 🔍 to find other devices!</p>
          </div>
        )}

        <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
          {friends.map((friend) => (
            <div key={friend.id} className="group relative">
              <div className={`
                flex items-center gap-4 p-3 rounded-[1.5rem] transition-all cursor-pointer
                bg-white border-2 border-transparent hover:border-pink-200 hover:shadow-md
                ${!isOpen && 'justify-center'}
              `}>
                <div className={`
                  w-12 h-12 rounded-full ${friend.color} flex items-center justify-center text-2xl shadow-sm
                  border-4 border-white flex-shrink-0 group-hover:scale-110 transition-transform
                `}>
                  {friend.avatar}
                </div>
                {isOpen && (
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-700 tracking-wide truncate">{friend.name}</p>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${friend.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                      <p className={`text-[10px] font-black uppercase tracking-widest ${friend.status === 'online' ? 'text-green-500' : 'text-gray-400'}`}>
                        {friend.status === 'online' ? 'Online' : 'Snoozing'}
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
        className="mt-8 p-4 rounded-2xl bg-yellow-400 text-white font-kids hover:bg-yellow-500 transition-all shadow-lg active:scale-95"
      >
        {isOpen ? '⬅ Close Menu' : '➡️'}
      </button>
    </div>
  );
};

export default Sidebar;
