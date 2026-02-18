
import React, { useState } from 'react';
import { db } from '../firebase.ts';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

interface Props {
  onLogin: (userData: any, remember: boolean) => void;
}

const USER_COLORS = ['bg-blue-400', 'bg-pink-400', 'bg-purple-400', 'bg-orange-400', 'bg-green-400', 'bg-yellow-500', 'bg-red-400', 'bg-indigo-400'];
const AVATARS = ['🐶', '🐱', '🦁', 'Rex', '🐰', '🐼', '🦄', '🦊'];

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
if (typeof document !== 'undefined' && !document.getElementById('confetti-styles-auth')) {
  const style = document.createElement('style');
  style.id = 'confetti-styles-auth';
  style.textContent = `
    @keyframes confettiPop {
      0% { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
      50% { opacity: 1; transform: translate(-50%, -50%) scale(1.5); }
      100% { opacity: 0; transform: translate(-50%, -100%) scale(1); }
    }
  `;
  document.head.appendChild(style);
}

const AuthScreen: React.FC<Props> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Trigger confetti on the button
    const button = (e.target as HTMLFormElement).querySelector('button[type="submit"]');
    if (button) triggerConfetti(button as HTMLElement);
    
    // TRIMMING IS CRITICAL: Mobile keyboards often add accidental spaces
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();
    
    if (!cleanUsername || !cleanPassword) return;
    setLoading(true);

    try {
      const userId = cleanUsername.toLowerCase();
      const userRef = doc(db, "users", userId);
      
      if (isLogin) {
        const snap = await getDoc(userRef);
        // Check password with trimming to be safe
        if (snap.exists() && snap.data().password?.trim() === cleanPassword) {
          onLogin(snap.data(), remember);
        } else {
          alert("Oops! Wrong name or password. Try again! 🎈\n(Check for sneaky spaces!)");
        }
      } else {
        // Sign Up
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          alert("That name is taken! Pick a new one! 🚀");
        } else {
          const userData = {
            id: userId,
            name: cleanUsername,
            password: cleanPassword,
            avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
            color: USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)],
            friendIds: [],
            status: 'online',
            lastSeen: Date.now(),
            createdAt: Date.now()
          };
          await setDoc(userRef, userData);
          onLogin(userData, remember);
        }
      }
    } catch (err) {
      console.error("Auth Error:", err);
      alert("Internet error! Try again! ☁️");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-yellow-100 via-pink-100 to-blue-100 p-4 overflow-hidden fixed inset-0">
      <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl max-w-md w-full text-center border-8 border-yellow-300">
        <h1 className="text-4xl md:text-5xl font-kids text-blue-500 mb-2 italic">Waga<span className="text-pink-500">chat!</span></h1>
        <div className="text-6xl mb-4 floating">🎈</div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="User Name"
              className="w-full text-center p-3 text-xl font-bold border-4 border-dashed border-blue-200 rounded-2xl focus:border-blue-500 outline-none transition-all"
              maxLength={15}
            />
          </div>

          <div className="space-y-1 relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full text-center p-3 text-xl font-bold border-4 border-dashed border-blue-200 rounded-2xl focus:border-blue-500 outline-none transition-all"
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 bottom-3 text-2xl hover:scale-110 active:scale-90 transition-transform"
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
          
          <div className="flex flex-col gap-4 py-2">
            <label className="flex items-center justify-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={remember} 
                onChange={() => setRemember(!remember)}
                className="w-6 h-6 rounded-lg accent-pink-500 cursor-pointer"
              />
              <span className="text-gray-600 font-bold group-hover:text-pink-500 transition-colors">Keep me logged in? 🌟</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full font-kids text-2xl py-4 rounded-3xl bg-pink-500 text-white shadow-lg hover:bg-pink-600 transition-all active:scale-95 disabled:opacity-50 border-b-8 border-pink-700 active:border-b-0"
            >
              {loading ? "Connecting..." : (isLogin ? "Login 🚀" : "Sign Up ✨")}
            </button>
          </div>
        </form>

        <button 
          onClick={() => {
            setIsLogin(!isLogin);
            setUsername('');
            setPassword('');
          }}
          className="mt-6 text-blue-500 font-bold hover:underline bg-blue-50 px-4 py-2 rounded-xl transition-all hover:bg-blue-100"
        >
          {isLogin ? "Need a new account? Sign up here!" : "Already have an account? Login here!"}
        </button>
      </div>
    </div>
  );
};

export default AuthScreen;
