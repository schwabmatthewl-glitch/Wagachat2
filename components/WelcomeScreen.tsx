
import React, { useState } from 'react';
import { db } from '../firebase.ts';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

interface Props {
  onStart: (name: string) => void;
}

const WelcomeScreen: React.FC<Props> = ({ onStart }) => {
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName) {
      setIsRegistering(true);
      try {
        // We create a unique ID for this session/device
        const userId = `user_${Date.now()}`;
        // Save user to the cloud "users" collection
        await setDoc(doc(db, "users", userId), {
          id: userId,
          name: trimmedName,
          avatar: ['🐶', '🐱', '🦁', '🦖', '🐰', '🐼'][Math.floor(Math.random() * 6)],
          status: 'online',
          color: 'bg-blue-400',
          lastSeen: new Date()
        });
        
        // Save userId locally so we can identify ourselves later
        localStorage.setItem('wagachat_userId', userId);
        onStart(trimmedName);
      } catch (error) {
        console.error("Error joining:", error);
        alert("Oh no! The cloud is stormy. Try again! ⛈️");
      } finally {
        setIsRegistering(false);
      }
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-yellow-100 via-pink-100 to-blue-100 p-4">
      <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl max-w-md w-full text-center border-8 border-yellow-300 transform transition-transform hover:scale-[1.01]">
        <h1 className="text-5xl font-kids text-blue-500 mb-6 drop-shadow-sm">Wagachat!</h1>
        <div className="text-6xl mb-8 floating">🌈</div>
        <p className="text-gray-600 font-bold mb-8 text-xl">What's your name, explorer?</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type your name here..."
            className="w-full text-center p-4 text-2xl font-bold border-4 border-dashed border-blue-200 rounded-2xl focus:border-blue-500 outline-none transition-all text-blue-600 placeholder-blue-200"
            maxLength={12}
            autoFocus
            disabled={isRegistering}
          />
          
          <button
            type="submit"
            disabled={!name.trim() || isRegistering}
            className="w-full bg-pink-500 hover:bg-pink-600 text-white font-kids text-2xl py-4 rounded-3xl shadow-lg transform active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRegistering ? 'Joining...' : "Let's Go! 🚀"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default WelcomeScreen;
