
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase.ts';
import { collection, addDoc, query, orderBy, onSnapshot, limit, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Message, Friend } from '../types.ts';
import { EMOJIS } from '../constants.ts';

interface Props {
  userName: string;
  friends: Friend[];
}

const ChatWindow: React.FC<Props> = ({ userName, friends }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Listen to cloud messages
  useEffect(() => {
    const q = query(
      collection(db, "messages"),
      orderBy("timestamp", "asc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      const currentUserId = localStorage.getItem('wagachat_userId');
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({
          id: doc.id,
          sender: data.senderId === currentUserId ? 'user' : 'friend',
          senderName: data.senderName,
          text: data.text,
          avatar: data.avatar,
          timestamp: data.timestamp?.toDate() || new Date(),
          imageUrl: data.imageUrl,
        });
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isCameraOpen && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(s => {
          stream = s;
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(err => {
          console.error("Camera error:", err);
          setIsCameraOpen(false);
          alert("Oops! Camera error. 📸");
        });
    }
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [isCameraOpen]);

  const handleSend = async (image?: string) => {
    if (!inputText.trim() && !image) return;

    const currentUserId = localStorage.getItem('wagachat_userId');
    
    try {
      await addDoc(collection(db, "messages"), {
        senderId: currentUserId,
        senderName: userName,
        text: inputText,
        avatar: '🌟',
        timestamp: Timestamp.now(),
        imageUrl: image || null,
      });
      
      setInputText('');
      setShowEmojiPicker(false);
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Message got stuck in the cloud! ☁️");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        handleSend(dataUrl);
        setIsCameraOpen(false);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSend(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-[3rem] shadow-2xl border-8 border-yellow-50 overflow-hidden relative">
      {isCameraOpen && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="relative w-full max-w-lg aspect-video bg-gray-900 rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="mt-8 flex gap-6">
            <button onClick={() => setIsCameraOpen(false)} className="px-8 py-4 bg-white/20 text-white font-kids text-xl rounded-2xl">Cancel</button>
            <button onClick={capturePhoto} className="px-10 py-4 bg-pink-500 text-white font-kids text-2xl rounded-2xl shadow-xl">Snap & Send! 📸</button>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
        {messages.length === 0 && (
          <div className="text-center py-10 opacity-40">
            <p className="text-4xl mb-4">🎈</p>
            <p className="font-bold">No messages yet! Be the first to say hi!</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-end gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-2xl shadow-md border-2 border-white flex-shrink-0 ${msg.sender === 'user' ? 'bg-blue-400' : 'bg-pink-400'}`}>
              {msg.avatar}
            </div>
            <div className={`max-w-[85%] md:max-w-[70%]`}>
              <div className={`text-[10px] font-black mb-1 px-2 uppercase ${msg.sender === 'user' ? 'text-blue-500 text-right' : 'text-pink-500 text-left'}`}>
                {msg.senderName}
              </div>
              <div className={`p-4 rounded-[1.5rem] text-sm md:text-base font-bold shadow-sm ${msg.sender === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                {msg.imageUrl && <img src={msg.imageUrl} className="mb-2 rounded-xl max-h-48 w-full object-cover" alt="cloud photo" />}
                {msg.text}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-yellow-50 border-t-4 border-yellow-100 pb-24 md:pb-6">
        <div className="relative flex flex-col gap-3">
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-4 p-4 bg-white rounded-[2rem] shadow-2xl border-4 border-yellow-200 flex flex-wrap gap-2 w-full z-20 max-h-[30vh] overflow-y-auto custom-scrollbar">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => addEmoji(e)} className="text-2xl hover:scale-125 transition-transform p-2">{e}</button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="w-12 h-12 bg-white rounded-2xl shadow-md text-2xl">🌈</button>
            <button onClick={() => setIsCameraOpen(true)} className="w-12 h-12 bg-white rounded-2xl shadow-md text-2xl">📸</button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="flex-1 p-3 bg-white rounded-2xl outline-none font-bold shadow-inner"
            />
            <button onClick={() => handleSend()} className="w-12 h-12 bg-blue-500 text-white rounded-2xl shadow-lg text-xl">🚀</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
