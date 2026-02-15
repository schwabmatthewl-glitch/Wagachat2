
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase.ts';
import { collection, addDoc, query, orderBy, onSnapshot, limit, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Message, Friend } from '../types.ts';
import { EMOJIS } from '../constants.ts';

interface Props {
  userName: string;
  friends: Friend[];
}

// Extra soft swoosh sound
const SEND_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/1105/1105-preview.mp3'; 
const RECEIVE_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'; 

const ChatWindow: React.FC<Props> = ({ userName, friends }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const isFirstLoad = useRef(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendAudio = useRef(new Audio(SEND_SOUND_URL));
  const receiveAudio = useRef(new Audio(RECEIVE_SOUND_URL));

  useEffect(() => {
    sendAudio.current.volume = 0.15; // Extremely gentle volume
    receiveAudio.current.volume = 0.35;
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "messages"),
      orderBy("timestamp", "asc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      const currentUserId = localStorage.getItem('wagachat_userId');
      let shouldPlayReceiveSound = false;
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          if (!isFirstLoad.current && data.senderId !== currentUserId) {
            shouldPlayReceiveSound = true;
          }
        }
      });

      snapshot.forEach((doc) => {
        const data = doc.data();
        const isFromMe = data.senderId === currentUserId;
        msgs.push({
          id: doc.id,
          sender: isFromMe ? 'user' : 'friend',
          senderName: data.senderName,
          senderColor: data.senderColor || 'bg-blue-400',
          text: data.text,
          avatar: data.avatar,
          timestamp: data.timestamp?.toDate() || new Date(),
          imageUrl: data.imageUrl,
        });
      });

      if (shouldPlayReceiveSound) {
        receiveAudio.current.play().catch(() => {});
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

  const handleSend = async (image?: string) => {
    if (!inputText.trim() && !image) return;
    const currentUserId = localStorage.getItem('wagachat_userId');
    const userColor = localStorage.getItem('wagachat_userColor') || 'bg-blue-400';
    const userAvatar = localStorage.getItem('wagachat_userAvatar') || '🌟';
    
    try {
      sendAudio.current.play().catch(() => {});
      
      await addDoc(collection(db, "messages"), {
        senderId: currentUserId,
        senderName: userName,
        senderColor: userColor,
        text: inputText,
        avatar: userAvatar,
        timestamp: Timestamp.now(),
        imageUrl: image || null,
      });
      setInputText('');
      setShowEmojiPicker(false);
    } catch (err) {
      console.error("Error sending:", err);
    }
  };

  const addEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        handleSend(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl border-4 md:border-8 border-yellow-50 overflow-hidden relative">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-end gap-2 md:gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-2xl md:text-4xl shadow-md border-2 border-white flex-shrink-0 ${msg.senderColor}`}>
              {msg.avatar}
            </div>
            <div className={`max-w-[85%] md:max-w-[75%]`}>
              <div 
                className={`text-[10px] md:text-sm font-black mb-1 px-2 uppercase tracking-wider ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}
                style={{ color: msg.senderColor.includes('blue') ? '#3B82F6' : msg.senderColor.includes('pink') ? '#EC4899' : msg.senderColor.includes('purple') ? '#A855F7' : msg.senderColor.includes('orange') ? '#FB923C' : msg.senderColor.includes('green') ? '#22C55E' : '#EAB308' }}
              >
                {msg.senderName}
              </div>
              <div className={`p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] text-lg md:text-2xl font-bold shadow-sm leading-snug ${msg.sender === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                {msg.imageUrl && <img src={msg.imageUrl} className="mb-3 rounded-2xl max-h-64 w-full object-cover border-4 border-white/20" alt="cloud" />}
                {msg.text}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 md:p-4 bg-yellow-50 border-t-4 border-yellow-100 shrink-0 z-20">
        <div className="relative flex flex-col gap-2 md:gap-3">
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-4 p-4 bg-white rounded-[2.5rem] shadow-2xl border-4 border-yellow-200 flex flex-wrap justify-center gap-4 md:gap-10 w-full max-h-[50vh] overflow-y-auto custom-scrollbar">
              {EMOJIS.map(e => (
                <button 
                  key={e} 
                  onClick={() => addEmoji(e)} 
                  className="text-8xl md:text-[10rem] hover:scale-125 transition-transform p-3 active:bg-yellow-100 rounded-3xl"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Added a flex wrapper for better alignment and visibility */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl shadow-md text-2xl md:text-4xl flex items-center justify-center border-2 border-yellow-100 hover:bg-yellow-50 transition-colors"
              >
                🌈
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl shadow-md text-2xl md:text-4xl flex items-center justify-center border-2 border-yellow-100 hover:bg-yellow-50 transition-colors"
              >
                📎
              </button>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
            <div className="flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type here..."
                className="w-full p-3 md:p-5 bg-white rounded-2xl outline-none font-bold shadow-inner text-base md:text-2xl text-blue-600 placeholder-blue-100 border-2 border-transparent focus:border-blue-200"
              />
            </div>
            <button 
              onClick={() => handleSend()} 
              disabled={!inputText.trim()} 
              className="w-12 h-12 md:w-16 md:h-16 bg-blue-500 text-white rounded-2xl shadow-lg text-2xl md:text-3xl flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
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
