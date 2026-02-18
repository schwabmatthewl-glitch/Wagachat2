import React from 'react';
import { Link } from 'react-router-dom';

interface Props {
  onToggleSidebar: () => void;
  user: any;
}

const Header: React.FC<Props> = ({ onToggleSidebar, user }) => {
  return (
    <header className="h-20 md:h-24 flex items-center justify-between px-8 bg-white border-b-8 border-yellow-100 z-10">
      <div className="flex items-center gap-6">
        <button 
          onClick={onToggleSidebar}
          className="md:hidden p-3 rounded-[1.2rem] bg-yellow-100 text-3xl shadow-sm hover:bg-yellow-200 transition-all active:scale-90"
        >
          ⭐
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
          <span className="font-kids text-gray-700 text-xl tracking-wide">Hi, {user.name}!</span>
          <span className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-sm shadow-green-200"></span>
            Super Online
          </span>
        </div>
        <Link 
          to="/settings" 
          className={`w-16 h-16 md:w-20 md:h-20 rounded-[1.8rem] flex items-center justify-center text-4xl md:text-5xl border-4 border-white shadow-xl hover:rotate-12 transition-transform cursor-pointer overflow-hidden ${user.color}`}
        >
          {user.photoUrl ? (
            <img src={user.photoUrl} className="w-full h-full object-cover" alt="Profile" />
          ) : (
            user.avatar
          )}
        </Link>
      </div>
    </header>
  );
};

export default Header;