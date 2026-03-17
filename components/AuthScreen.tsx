import React, { useState } from 'react';
import { db, auth } from '../firebase.ts';
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { triggerConfetti } from '../utils/effects.ts';

// Converts a username to an internal Firebase Auth email (never shown to users)
const toEmail = (username: string) => `${username}@wagachat.app`;

interface Props {
  onLogin: (userData: any) => void;
}

const USER_COLORS = ['bg-blue-400', 'bg-pink-400', 'bg-purple-400', 'bg-orange-400', 'bg-green-400', 'bg-yellow-500', 'bg-red-400', 'bg-indigo-400'];
const AVATARS = ['🐶', '🐱', '🦁', 'Rex', '🐰', '🐼', '🦄', '🦊'];

const AuthScreen: React.FC<Props> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) return;
    setLoading(true);

    try {
      const userId = cleanUsername.toLowerCase();
      const email = toEmail(userId);

      // Set Firebase Auth persistence based on "remember me"
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);

      if (isLogin) {
        let userData: any = null;

        try {
          // Try Firebase Auth login first
          await signInWithEmailAndPassword(auth, email, cleanPassword);
        } catch (authErr: any) {
          if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/invalid-email') {
            // Legacy migration: user exists in Firestore but not yet in Firebase Auth
            const userRef = doc(db, "users", userId);
            const snap = await getDoc(userRef);
            if (snap.exists() && snap.data().password?.trim() === cleanPassword) {
              // Create Firebase Auth account for this existing user
              await createUserWithEmailAndPassword(auth, email, cleanPassword);
              // Remove the plain-text password from Firestore now that Firebase Auth handles it
              await updateDoc(userRef, { password: null });
            } else {
              alert("Oops! Wrong name or password. Try again! 🎈\n(Check for sneaky spaces!)");
              return;
            }
          } else if (authErr.code === 'auth/wrong-password') {
            alert("Oops! Wrong name or password. Try again! 🎈");
            return;
          } else {
            throw authErr;
          }
        }

        // Fetch user profile from Firestore
        const userRef = doc(db, "users", userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          userData = snap.data();
          triggerConfetti();
          onLogin(userData);
        } else {
          alert("Oops! Account not found. Try again! 🎈");
        }

      } else {
        // Register: check if username is taken
        const userRef = doc(db, "users", userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          alert("That name is taken! Pick a new one! 🚀");
        } else {
          // Create Firebase Auth account (password is securely stored by Firebase — not in Firestore)
          await createUserWithEmailAndPassword(auth, email, cleanPassword);

          // Create Firestore user profile (no password field)
          const userData = {
            id: userId,
            name: cleanUsername,
            avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
            color: USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)],
            friendIds: [],
            status: 'online',
            lastSeen: Date.now(),
            createdAt: Date.now()
          };
          await setDoc(userRef, userData);
          triggerConfetti();
          onLogin(userData);
        }
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      if (err.code === 'auth/email-already-in-use') {
        alert("That name is taken! Pick a new one! 🚀");
      } else {
        alert("Internet error! Try again! ☁️");
      }
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
