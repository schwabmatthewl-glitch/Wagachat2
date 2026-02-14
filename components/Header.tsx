
import React from 'react';

interface Props {
  onToggleSidebar: () => void;
  userName: string;
}

const Header: React.FC<Props> = ({ onToggleSidebar, userName }) => {
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
            Wagachat<span className="text-pink-500">!</span>
          </h1>
        </div>
      </div>
      
      <div className="flex items-center gap-5">
        <div className="flex flex-col items-end hidden sm:flex">
          <span className="font-kids text-gray-700 text-xl tracking-wide">Welcome, {userName}!</span>
          <span className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-sm shadow-green-200"></span>
            Super Online
          </span>
        </div>
        <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-pink-300 to-pink-500 rounded-3xl flex items-center justify-center text-4xl border-4 border-white shadow-xl hover:rotate-12 transition-transform cursor-pointer">
          🌟
        </div>
      </div>
    </header>
  );
};

export default Header;
