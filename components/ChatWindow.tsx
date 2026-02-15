
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase.ts';
import { collection, addDoc, query, orderBy, onSnapshot, limit, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Message, Friend } from '../types.ts';
import { EMOJIS } from '../constants.ts';

interface Props {
  userName: string;
  friends: Friend[];
}

// Fun Kid-Friendly Sounds
const SEND_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'; // Pop
const RECEIVE_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'; // Magic Ding

const ChatWindow: React.FC<Props> = ({ userName, friends }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const isFirstLoad = useRef(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Audio references
  const sendAudio = useRef(new Audio(SEND_SOUND));
  const receiveAudio = useRef(new Audio(RECEIVE_SOUND));

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
      let hasNewMessage = false;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const isFromMe = data.senderId === currentUserId;
        msgs.push({
          id: doc.id,
          sender: isFromMe ? 'user' : 'friend',
          senderName: data.senderName,
          text: data.text,
          avatar: data.avatar,
          timestamp: data.timestamp?.toDate() || new Date(),
          imageUrl: data.imageUrl,
        });

        // Check if this is a new message from a friend to trigger sound
        if (!isFirstLoad.current && !isFromMe) {
          hasNewMessage = true;
        }
      });

      if (hasNewMessage) {
        receiveAudio.current.play().catch(e => console.log('Audio play blocked', e));
      }

      setMessages(msgs);
      isFirstLoad.current = false;
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
      // Play send sound immediately for feedback
      sendAudio.current.play().catch(e => console.log('Audio play blocked', e));

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

  const addEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl border-4 md:border-8 border-yellow-50 overflow-hidden relative">
      {isCameraOpen && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-lg aspect-video bg-gray-900 rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="mt-6 flex gap-4">
            <button onClick={() => setIsCameraOpen(false)} className="px-6 py-3 bg-white/20 text-white font-kids text-lg rounded-2xl">Cancel</button>
            <button onClick={capturePhoto} className="px-8 py-3 bg-pink-500 text-white font-kids text-xl rounded-2xl shadow-xl">Snap & Send! 📸</button>
          </div>
        </div>
      )}

      {/* Message List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-center py-10 opacity-40">
            <p className="text-6xl mb-4">🎈</p>
            <p className="font-bold text-xl">No messages yet! Be the first to say hi!</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-end gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-3xl md:text-4xl shadow-md border-2 border-white flex-shrink-0 ${msg.sender === 'user' ? 'bg-blue-400' : 'bg-pink-400'}`}>
              {msg.avatar}
            </div>
            <div className={`max-w-[85%] md:max-w-[70%]`}>
              <div className={`text-xs font-black mb-1 px-2 uppercase ${msg.sender === 'user' ? 'text-blue-500 text-right' : 'text-pink-500 text-left'}`}>
                {msg.senderName}
              </div>
              <div className={`p-5 rounded-[1.8rem] text-xl md:text-2xl font-bold shadow-sm leading-relaxed ${msg.sender === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                {msg.imageUrl && <img src={msg.imageUrl} className="mb-3 rounded-2xl max-h-64 w-full object-cover border-4 border-white/20" alt="cloud photo" />}
                {msg.text}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area - Adjusted for mobile visibility and larger elements */}
      <div className="p-4 bg-yellow-50 border-t-4 border-yellow-100 shrink-0 pb-24 md:pb-6">
        <div className="relative flex flex-col gap-3">
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-4 p-4 bg-white rounded-[2rem] shadow-2xl border-4 border-yellow-200 flex flex-wrap justify-center gap-3 w-full z-20 max-h-[40vh] overflow-y-auto custom-scrollbar">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => addEmoji(e)} className="text-4xl md:text-5xl hover:scale-125 transition-transform p-3 active:bg-yellow-100 rounded-2xl">{e}</button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
              className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl shadow-md text-3xl transition-colors ${showEmojiPicker ? 'bg-yellow-200' : 'bg-white'}`}
            >
              🌈
            </button>
            <button 
              onClick={() => setIsCameraOpen(true)} 
              className="w-14 h-14 md:w-16 md:h-16 bg-white rounded-2xl shadow-md text-3xl"
            >
              📸
            </button>
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type here..."
                className="w-full p-4 md:p-5 bg-white rounded-2xl outline-none font-bold shadow-inner text-xl md:text-2xl text-blue-600 placeholder-blue-100"
              />
            </div>
            <button 
              onClick={() => handleSend()} 
              disabled={!inputText.trim()}
              className="w-14 h-14 md:w-16 md:h-16 bg-blue-500 text-white rounded-2xl shadow-lg text-2xl md:text-3xl active:scale-90 transition-transform disabled:opacity-50"
            >
              🚀
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;