
import React, { useState, useEffect } from 'react';
import { db } from '../firebase.ts';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

interface Props {
  onStart: (name: string) => void;
}

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
      
      // Safety timeout in case Firebase is misconfigured
      const timeoutId = setTimeout(() => {
        setIsRegistering(false);
        setStatusText("Let's Go! 🚀");
        alert("The cloud is taking too long! ⛈️ Check your Firebase keys in firebase.ts!");
      }, 10000);

      try {
        const userId = `user_${Date.now()}`;
        await setDoc(doc(db, "users", userId), {
          id: userId,
          name: trimmedName,
          avatar: ['🐶', '🐱', '🦁', '🦖', '🐰', '🐼'][Math.floor(Math.random() * 6)],
          status: 'online',
          color: 'bg-blue-400',
          lastSeen: new Date()
        });
        
        clearTimeout(timeoutId);
        localStorage.setItem('wagachat_userId', userId);
        onStart(trimmedName);
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error("Firebase Error:", error);
        alert(`Cloud Error: ${error.message || 'Check your internet and Firebase setup!'}`);
        setIsRegistering(false);
        setStatusText("Let's Go! 🚀");
      }
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-yellow-100 via-pink-100 to-blue-100 p-4 overflow-hidden fixed inset-0">
      <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl max-w-md w-full text-center border-8 border-yellow-300 transform transition-transform hover:scale-[1.01]">
        <h1 className="text-5xl font-kids text-blue-500 mb-6 drop-shadow-sm">Wagachat!</h1>
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
        {isRegistering && (
          <p className="mt-4 text-blue-400 font-bold animate-pulse text-sm">Talking to the stars... ✨</p>
        )}
      </div>
    </div>
  );
};

export default WelcomeScreen;