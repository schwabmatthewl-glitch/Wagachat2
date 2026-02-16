
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase.ts';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

interface Props {
  onToggleSidebar: () => void;
  userName: string;
}

const Header: React.FC<Props> = ({ onToggleSidebar, userName }) => {
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string>('🌟');
  const [userColor, setUserColor] = useState<string>('bg-pink-400');
  const userId = localStorage.getItem('wagachat_userId');

  useEffect(() => {
    if (userId) {
      const unsub = onSnapshot(doc(db, "users", userId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserPhoto(data.photoUrl || null);
          setUserAvatar(data.avatar || '🌟');
          setUserColor(data.color || 'bg-pink-400');
        }
      });
      return () => unsub();
    }
  }, [userId]);

  return (
    <header className="h-20 md:h-24 flex items-center justify-between px-8 bg-white border-b-8 border-yellow-100 z-10">
      <div className="flex items-center gap-6">
        <button 
          onClick={onToggleSidebar}
          className="md:hidden p-3 rounded-[1.2rem] bg-yellow-100 text-3xl shadow-sm hover:bg-yellow-200 transition-all active:scale-90"
        >
          🍔
        </button>
        <div className="flex items-center gap-3">
          <div className="text-5xl drop-shadow-sm">🎈</div>
          <h1 className="text-3xl md:text-5xl font-kids text-blue-500 tracking-tighter select-none">
            Waga<span className="text-pink-500">chat!</span>
          </h1>
        </div>
      </div>
      
      <div className="flex items-center gap-5">
        <div className="flex flex-col items-end hidden sm:flex">
          <span className="font-kids text-gray-700 text-xl tracking-wide">Hi, {userName}!</span>
          <span className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-sm shadow-green-200"></span>
            Super Online
          </span>
        </div>
        <Link 
          to="/settings" 
          className={`w-16 h-16 md:w-20 md:h-20 rounded-[1.8rem] flex items-center justify-center text-4xl md:text-5xl border-4 border-white shadow-xl hover:rotate-12 transition-transform cursor-pointer overflow-hidden ${userColor}`}
        >
          {userPhoto ? (
            <img src={userPhoto} className="w-full h-full object-cover" alt="Profile" />
          ) : (
            userAvatar
          )}
        </Link>
      </div>
    </header>
  );
};

export default Header;
