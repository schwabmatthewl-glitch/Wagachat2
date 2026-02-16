
import React, { useState } from 'react';
import { db } from '../firebase.ts';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

interface Props {
  onLogin: (userData: any, remember: boolean) => void;
}

const USER_COLORS = ['bg-blue-400', 'bg-pink-400', 'bg-purple-400', 'bg-orange-400', 'bg-green-400', 'bg-yellow-500', 'bg-red-400', 'bg-indigo-400'];
const AVATARS = ['🐶', '🐱', '🦁', 'Rex', '🐰', '🐼', '🦄', '🦊'];

const AuthScreen: React.FC<Props> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);

    try {
      if (isLogin) {
        const userRef = doc(db, "users", username.toLowerCase());
        const snap = await getDoc(userRef);
        if (snap.exists() && snap.data().password === password) {
          onLogin(snap.data(), remember);
        } else {
          alert("Oops! Wrong name or password. Try again! 🎈");
        }
      } else {
        // Sign Up
        const userRef = doc(db, "users", username.toLowerCase());
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          alert("That name is taken! Pick a new one! 🚀");
        } else {
          const userData = {
            id: username.toLowerCase(),
            name: username,
            password: password,
            avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
            color: USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)],
            friendIds: [],
            status: 'online',
            lastSeen: Date.now()
          };
          await setDoc(userRef, userData);
          onLogin(userData, remember);
        }
      }
    } catch (err) {
      alert("Internet error! Try again! ☁️");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-yellow-100 via-pink-100 to-blue-100 p-4 overflow-hidden fixed inset-0">
      <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl max-w-md w-full text-center border-8 border-yellow-300">
        <h1 className="text-4xl md:text-5xl font-kids text-blue-500 mb-2">Waga<span className="text-pink-500">chat!</span></h1>
        <div className="text-6xl mb-4 floating">🎈</div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="User Name"
            className="w-full text-center p-3 text-xl font-bold border-4 border-dashed border-blue-200 rounded-2xl focus:border-blue-500 outline-none"
            maxLength={15}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full text-center p-3 text-xl font-bold border-4 border-dashed border-blue-200 rounded-2xl focus:border-blue-500 outline-none"
          />
          
          <label className="flex items-center justify-center gap-2 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={remember} 
              onChange={() => setRemember(!remember)}
              className="w-6 h-6 rounded-lg accent-pink-500"
            />
            <span className="text-gray-600 font-bold group-hover:text-pink-500 transition-colors">Remember Me? 🌟</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-kids text-2xl py-4 rounded-3xl bg-pink-500 text-white shadow-lg hover:bg-pink-600 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? "Waiting..." : (isLogin ? "Login 🚀" : "Sign Up ✨")}
          </button>
        </form>

        <button 
          onClick={() => setIsLogin(!isLogin)}
          className="mt-6 text-blue-500 font-bold hover:underline"
        >
          {isLogin ? "Need a new account? Sign up!" : "Already have an account? Login!"}
        </button>
      </div>
    </div>
  );
};

export default AuthScreen;
