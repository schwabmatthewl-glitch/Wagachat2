
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase.ts';
import { doc, updateDoc, onSnapshot, arrayRemove, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

interface Props {
  user: any;
  onLogout: () => void;
}

const Settings: React.FC<Props> = ({ user, onLogout }) => {
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState(user.password);
  const [localPhotoUrl, setLocalPhotoUrl] = useState(user.photoUrl || '');
  const [friends, setFriends] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  // Track if we are currently in the middle of a photo change to prevent sync overwrite
  const isEditingPhoto = useRef(false);
  const hasLoadedInitial = useRef(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "users", user.id), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setName(data.name);
        setPassword(data.password);
        
        // Only update local photo from DB if we aren't currently editing it
        if (!isEditingPhoto.current || !hasLoadedInitial.current) {
          setLocalPhotoUrl(data.photoUrl || '');
          hasLoadedInitial.current = true;
        }

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
        password,
        photoUrl: localPhotoUrl
      });
      isEditingPhoto.current = false; // Reset editing flag after successful save
      alert("Settings saved! ✨");
    } catch (e) {
      alert("Error saving! ☁️");
    } finally {
      setSaving(false);
    }
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { aspectRatio: 1 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert("Couldn't open camera! 🎥 Check permissions.");
      setIsCameraActive(false);
    }
  };

  const takeSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const size = Math.min(video.videoWidth, video.videoHeight);
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;
        ctx.drawImage(video, startX, startY, size, size, 0, 0, 400, 400);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setLocalPhotoUrl(dataUrl);
        isEditingPhoto.current = true; // Mark as editing to prevent sync reset
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = 400;
            canvas.height = 400;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const size = Math.min(img.width, img.height);
              const startX = (img.width - size) / 2;
              const startY = (img.height - size) / 2;
              ctx.drawImage(img, startX, startY, size, size, 0, 0, 400, 400);
              setLocalPhotoUrl(canvas.toDataURL('image/jpeg', 0.8));
              isEditingPhoto.current = true;
            }
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
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

  const handleRemovePhoto = () => {
    setLocalPhotoUrl('');
    isEditingPhoto.current = true;
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
          
          <div className="flex flex-col items-center gap-4 py-4">
            <div className={`w-40 h-40 md:w-56 md:h-56 rounded-[2.5rem] flex items-center justify-center text-7xl md:text-8xl shadow-xl border-4 border-white overflow-hidden ${user.color}`}>
              {localPhotoUrl ? (
                <img src={localPhotoUrl} className="w-full h-full object-cover" alt="Profile" />
              ) : (
                user.avatar
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-100 text-blue-600 px-6 py-2 rounded-2xl font-bold hover:bg-blue-200"
              >
                Choose Pic 📂
              </button>
              <button 
                onClick={startCamera}
                className="bg-pink-100 text-pink-600 px-6 py-2 rounded-2xl font-bold hover:bg-pink-200"
              >
                Take a Selfie! 📸
              </button>
              {localPhotoUrl && (
                <button 
                  onClick={handleRemovePhoto}
                  className="bg-red-100 text-red-600 px-6 py-2 rounded-2xl font-bold hover:bg-red-200"
                >
                  Remove Photo ✖
                </button>
              )}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
          </div>

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

        {isCameraActive && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg aspect-square bg-gray-800 rounded-[3rem] overflow-hidden border-8 border-white relative shadow-2xl">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
              <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
                 <div className="w-full h-full border-4 border-dashed border-white/50 rounded-full" />
              </div>
            </div>
            <div className="mt-8 flex gap-6">
              <button onClick={stopCamera} className="bg-gray-500 text-white px-8 py-4 rounded-3xl font-kids text-xl">Cancel</button>
              <button onClick={takeSelfie} className="bg-pink-500 text-white px-12 py-4 rounded-3xl font-kids text-2xl shadow-xl active:scale-95 transition-all border-b-8 border-pink-700">Snap! 📸</button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        <section className="bg-pink-50 p-6 md:p-8 rounded-[2.5rem] space-y-6 border-4 border-pink-100">
          <h3 className="text-2xl font-kids text-pink-500">My Friends List 🎈</h3>
          <div className="space-y-3">
            {friends.length === 0 ? (
              <p className="text-center text-gray-400 font-bold py-8 italic">No friends yet... Go exploring! 🚀</p>
            ) : (
              friends.map(f => (
                <div key={f.id} className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border-2 border-transparent">
                  <div className="flex items-center gap-4">
                    <span className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center text-3xl shadow-md border-2 border-white overflow-hidden`}>
                      {f.photoUrl ? <img src={f.photoUrl} className="w-full h-full object-cover" /> : f.avatar}
                    </span>
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
