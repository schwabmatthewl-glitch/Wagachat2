
import React, { useState } from 'react';
import { db } from '../firebase.ts';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

interface Props {
  onStart: (name: string) => void;
}

const USER_COLORS = [
  'bg-blue-400', 'bg-pink-400', 'bg-purple-400', 
  'bg-orange-400', 'bg-green-400', 'bg-yellow-500', 
  'bg-red-400', 'bg-indigo-400'
];

const WelcomeScreen: React.FC<Props> = ({ onStart }) => {
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [statusText, setStatusText] = useState("Let's Go! 🚀");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName) {
      setIsRegistering(true);
      setStatusText("Connecting... ☁️");
      
      try {
        const userId = `user_${Date.now()}`;
        const userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
        const userAvatar = ['🐶', '🐱', '🦁', '🦖', '🐰', '🐼', '🦄', '🦊'][Math.floor(Math.random() * 8)];
        
        await setDoc(doc(db, "users", userId), {
          id: userId,
          name: trimmedName,
          avatar: userAvatar,
          status: 'online',
          color: userColor,
          lastSeen: Date.now()
        });
        
        localStorage.setItem('wagachat_userId', userId);
        localStorage.setItem('wagachat_userColor', userColor);
        localStorage.setItem('wagachat_userAvatar', userAvatar);
        onStart(trimmedName);
      } catch (error: any) {
        console.error("Firebase Error:", error);
        alert(`Cloud Error: ${error.message || 'Check your internet!'}`);
        setIsRegistering(false);
        setStatusText("Let's Go! 🚀");
      }
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-yellow-100 via-pink-100 to-blue-100 p-4 overflow-hidden fixed inset-0">
      <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl max-w-md w-full text-center border-8 border-yellow-300 transform transition-transform hover:scale-[1.01]">
        <h1 className="text-5xl font-kids text-blue-500 mb-6 drop-shadow-sm">Waga<span className="text-pink-500">chat!</span></h1>
        <div className="text-7xl mb-8 floating">🌈</div>
        <p className="text-gray-600 font-bold mb-8 text-2xl">What's your name, explorer?</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type your name..."
            className="w-full text-center p-5 text-3xl font-bold border-4 border-dashed border-blue-200 rounded-2xl focus:border-blue-500 outline-none transition-all text-blue-600 placeholder-blue-100"
            maxLength={12}
            autoFocus
            disabled={isRegistering}
          />
          
          <button
            type="submit"
            disabled={!name.trim() || isRegistering}
            className={`w-full font-kids text-3xl py-5 rounded-3xl shadow-lg transform active:scale-95 transition-all disabled:opacity-50 ${isRegistering ? 'bg-gray-400' : 'bg-pink-500 hover:bg-pink-600 text-white'}`}
          >
            {statusText}
          </button>
        </form>
      </div>
    </div>
  );
};

export default WelcomeScreen;
