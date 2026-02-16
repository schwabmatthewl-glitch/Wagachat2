
import React, { useState, useEffect } from 'react';
import { db } from '../firebase.ts';
import { doc, updateDoc, onSnapshot, arrayRemove, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Friend } from '../types.ts';

interface Props {
  user: any;
  onLogout: () => void;
}

const Settings: React.FC<Props> = ({ user, onLogout }) => {
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState(user.password);
  const [friends, setFriends] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "users", user.id), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fIds = data.friendIds || [];
        const fList: any[] = [];
        for (const id of fIds) {
          const fSnap = await getDoc(doc(db, "users", id));
          if (fSnap.exists()) fList.push(fSnap.data());
        }
        setFriends(fList);
      }
    });
    return () => unsub();
  }, [user.id]);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.id), {
        name,
        password
      });
      alert("Settings saved! ✨");
    } catch (e) {
      alert("Error saving! ☁️");
    } finally {
      setSaving(false);
    }
  };

  const removeFriend = async (fId: string) => {
    try {
      await updateDoc(doc(db, "users", user.id), {
        friendIds: arrayRemove(fId)
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-12 bg-white rounded-[3rem] shadow-2xl border-8 border-yellow-50 custom-scrollbar">
      <div className="max-w-2xl mx-auto space-y-10 pb-20">
        <header className="text-center">
          <h2 className="text-4xl md:text-5xl font-kids text-blue-500 mb-2">My Clubhouse Rules</h2>
          <p className="text-gray-500 font-bold">Change your name or say goodbye to friends here!</p>
        </header>

        <section className="bg-yellow-50 p-6 md:p-8 rounded-[2.5rem] space-y-6 border-4 border-yellow-100">
          <h3 className="text-2xl font-kids text-orange-500">My Profile 👤</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Display Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full p-4 rounded-2xl border-4 border-white focus:border-blue-400 outline-none text-xl font-bold"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 rounded-2xl border-4 border-white focus:border-blue-400 outline-none text-xl font-bold"
              />
            </div>
            <button 
              onClick={handleUpdate}
              disabled={saving}
              className="w-full py-4 bg-blue-500 text-white font-kids text-2xl rounded-2xl shadow-lg hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes! ✅"}
            </button>
          </div>
        </section>

        <section className="bg-pink-50 p-6 md:p-8 rounded-[2.5rem] space-y-6 border-4 border-pink-100">
          <h3 className="text-2xl font-kids text-pink-500">My Friends List 🎈</h3>
          <div className="space-y-3">
            {friends.length === 0 ? (
              <p className="text-center text-gray-400 font-bold py-8 italic">No friends yet... Go exploring! 🚀</p>
            ) : (
              friends.map(f => (
                <div key={f.id} className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border-2 border-transparent">
                  <div className="flex items-center gap-4">
                    <span className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center text-3xl shadow-md border-2 border-white`}>{f.avatar}</span>
                    <span className="font-bold text-lg text-gray-700">{f.name}</span>
                  </div>
                  <button 
                    onClick={() => removeFriend(f.id)}
                    className="p-2 w-10 h-10 flex items-center justify-center bg-red-100 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all font-bold"
                  >
                    ✖
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="pt-8">
          <button 
            onClick={onLogout}
            className="w-full py-5 bg-red-500 text-white font-kids text-2xl rounded-3xl shadow-xl hover:bg-red-600 active:scale-95 transition-all border-b-8 border-red-800 active:border-b-0"
          >
            Logout 👋
          </button>
          <p className="text-center mt-4 text-gray-400 font-bold text-sm italic">Come back soon!</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
