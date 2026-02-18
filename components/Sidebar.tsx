import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { db } from '../firebase.ts';
import { doc, collection, onSnapshot, query, limit, updateDoc, arrayUnion, getDoc, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

interface Props {
  isOpen: boolean;
  toggle: () => void;
  userId: string;
  hasUnread?: boolean;
  onSelectFriend?: (friend: any) => void;
}

const STALE_ONLINE_THRESHOLD = 60000;

// Confetti pop animation
const triggerConfetti = (element: HTMLElement) => {
  const confetti = document.createElement('div');
  confetti.innerHTML = '🎉✨🎊';
  confetti.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 24px;
    pointer-events: none;
    animation: confettiPop 0.5s ease-out forwards;
    z-index: 100;
  `;
  element.style.position = 'relative';
  element.appendChild(confetti);
  
  // Haptic feedback
  if (navigator.vibrate) {
    navigator.vibrate(50);
  }
  
  setTimeout(() => confetti.remove(), 500);
};

// Add confetti animation to document
if (typeof document !== 'undefined' && !document.getElementById('confetti-styles')) {
  const style = document.createElement('style');
  style.id = 'confetti-styles';
  style.textContent = `
    @keyframes confettiPop {
      0% { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
      50% { opacity: 1; transform: translate(-50%, -50%) scale(1.5); }
      100% { opacity: 0; transform: translate(-50%, -100%) scale(1); }
    }
  `;
  document.head.appendChild(style);
} 

const Sidebar: React.FC<Props> = ({ isOpen, toggle, userId, hasUnread, onSelectFriend }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [myFriends, setMyFriends] = useState<any[]>([]);
  const [unreadDMs, setUnreadDMs] = useState<{ [friendId: string]: boolean }>({});
  const [lastReadTimestamps, setLastReadTimestamps] = useState<{ [friendId: string]: number }>({});

  useEffect(() => {
    const q = query(collection(db, "users"), limit(50));
    const unsubAll = onSnapshot(q, (snapshot) => {
      const users: any[] = [];
      const now = Date.now();
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.id !== userId) {
          const isOnline = (now - (data.lastSeen || 0)) < STALE_ONLINE_THRESHOLD;
          users.push({
            id: data.id,
            name: data.name,
            avatar: data.avatar,
            photoUrl: data.photoUrl,
            status: isOnline ? 'online' : 'offline',
            color: data.color || 'bg-blue-400'
          });
        }
      });
      setAllUsers(users);
    });

    return () => unsubAll();
  }, [userId]);

  useEffect(() => {
    const fetchFriends = async () => {
      const snap = await getDoc(doc(db, "users", userId));
      if (snap.exists()) {
        const friendIds = snap.data().friendIds || [];
        const friendsList = allUsers.filter(u => friendIds.includes(u.id));
        setMyFriends(friendsList);
      }
    };
    fetchFriends();
  }, [allUsers, userId]);

  // Track unread DMs for each friend
  useEffect(() => {
    if (myFriends.length === 0) return;

    const unsubscribers: (() => void)[] = [];

    myFriends.forEach(friend => {
      const dmPairId = [userId, friend.id].sort().join('_');
      const lastRead = lastReadTimestamps[friend.id] || 0;
      
      const q = query(
        collection(db, "messages"),
        where("dmPairId", "==", dmPairId),
        where("senderId", "==", friend.id),
        orderBy("timestamp", "desc"),
        limit(1)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const latestMsg = snapshot.docs[0].data();
          const msgTime = latestMsg.timestamp?.toMillis() || 0;
          if (msgTime > lastRead) {
            setUnreadDMs(prev => ({ ...prev, [friend.id]: true }));
          }
        }
      });

      unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [myFriends, userId, lastReadTimestamps]);

  const markAsRead = (friendId: string) => {
    setLastReadTimestamps(prev => ({ ...prev, [friendId]: Date.now() }));
    setUnreadDMs(prev => ({ ...prev, [friendId]: false }));
  };

  const addFriend = async (friendId: string) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        friendIds: arrayUnion(friendId)
      });
      setIsSearching(false);
      setSearchTerm('');
    } catch (e) {
      console.error(e);
    }
  };

  const navItems = [
    { path: '/', name: 'Home Adventure', icon: '🏠', color: 'blue' },
    { path: '/room/main', name: 'Clubhouse', icon: '💬', color: 'blue', notify: hasUnread },
    { path: '/video', name: 'Video Party', icon: '📹', color: 'pink' },
    { path: '/settings', name: 'Settings', icon: '⚙️', color: 'purple' },
  ];

  const showFullMenu = isOpen || window.innerWidth >= 768;

  const searchResults = searchTerm.trim() 
    ? allUsers.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !myFriends.some(f => f.id === u.id)
      )
    : [];

  return (
    <div className={`h-full bg-white border-r-8 border-yellow-100 flex flex-col transition-all duration-300 p-4 md:p-8 items-center md:items-start overflow-hidden`}>
      <div className="mb-12 w-full">
        <div className="space-y-4 w-full">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={(e) => triggerConfetti(e.currentTarget as HTMLElement)}
              className={({ isActive }) => `
                flex items-center gap-6 p-4 md:p-5 rounded-[2.5rem] transition-all relative w-full
                ${isActive ? 'bg-blue-500 text-white shadow-2xl scale-105' : 'hover:bg-yellow-50 text-gray-600'}
              `}
            >
              <span className="text-3xl md:text-4xl">{item.icon}</span>
              <span className={`font-kids text-lg md:text-xl ${showFullMenu ? 'block' : 'hidden'}`}>{item.name}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 w-full">
        <div className={`flex items-center justify-between mb-8 ${showFullMenu ? '' : 'hidden'}`}>
          <h2 className="font-kids text-pink-500 text-xl md:text-2xl">Friends</h2>
          <button onClick={() => setIsSearching(!isSearching)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-pink-100 text-pink-500 hover:scale-110">
            {isSearching ? '✖' : '🔍'}
          </button>
        </div>

        {showFullMenu && isSearching && (
          <div className="mb-6 space-y-4 w-full animate-in fade-in slide-in-from-top-4">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-4 rounded-2xl border-4 border-dashed border-pink-100 outline-none font-bold text-pink-600"
            />
            {searchResults.length > 0 && (
              <div className="bg-white rounded-[2rem] p-2 shadow-2xl border-4 border-pink-50 max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
                {searchResults.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 hover:bg-pink-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <span className={`w-10 h-10 rounded-xl ${u.color} flex items-center justify-center text-xl overflow-hidden`}>
                        {u.photoUrl ? <img src={u.photoUrl} className="w-full h-full object-cover" /> : u.avatar}
                      </span>
                      <span className="font-bold text-sm">{u.name}</span>
                    </div>
                    <button onClick={() => addFriend(u.id)} className="bg-pink-500 text-white rounded-lg px-2 py-1 font-bold">＋</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-6 overflow-y-auto flex-1 pr-2 custom-scrollbar w-full">
          {myFriends.length === 0 && showFullMenu && !isSearching && (
            <p className="text-center text-gray-400 font-bold p-4">Add some friends to start chatting! 🌟</p>
          )}
          {myFriends.map((friend) => (
            <button 
              key={friend.id} 
              onClick={(e) => {
                triggerConfetti(e.currentTarget as HTMLElement);
                markAsRead(friend.id);
                navigate(`/dm/${friend.id}`);
                if (onSelectFriend) onSelectFriend(friend);
                if (window.innerWidth < 768) toggle();
              }}
              className={`w-full flex items-center gap-6 p-4 rounded-[2.5rem] bg-white border-4 border-transparent hover:border-pink-200 hover:bg-pink-50 transition-all cursor-pointer ${!showFullMenu && 'justify-center'}`}
            >
              <div className={`w-14 h-14 rounded-xl md:rounded-2xl ${friend.color} flex items-center justify-center text-2xl shadow-lg border-2 md:border-4 border-white flex-shrink-0 overflow-hidden`}>
                {friend.photoUrl ? (
                  <img src={friend.photoUrl} className="w-full h-full object-cover" alt={friend.name} />
                ) : (
                  friend.avatar
                )}
              </div>
              {showFullMenu && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <p className="font-kids text-gray-800 text-xl truncate">{friend.name}</p>
                    {unreadDMs[friend.id] && (
                      <span className="w-3 h-3 rounded-full bg-pink-500 animate-pulse flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${friend.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${friend.status === 'online' ? 'text-green-500' : 'text-gray-400'}`}>
                      {friend.status === 'online' ? 'Online' : 'Asleep'}
                    </span>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;