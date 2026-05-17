import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCtM7JonPKTecmq937kTbZ-MF6LIWPybvo",
  authDomain: "wagachat-3a07e.firebaseapp.com",
  projectId: "wagachat-3a07e",
  storageBucket: "wagachat-3a07e.firebasestorage.app",
  messagingSenderId: "310658829414",
  appId: "1:310658829414:web:8fc0c1ca515d8d1987b1a7",
  measurementId: "G-N01XLJQNQR"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
export const auth = getAuth(app);
