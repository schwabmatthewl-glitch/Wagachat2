import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase.ts';
import { collection, addDoc, query, orderBy, onSnapshot, limit, Timestamp, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Message } from '../types.ts';
import { EMOJIS } from '../constants.ts';

interface Props {
  user: any;
}

const SEND_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2635/2635-preview.mp3'; // Whimsical Swoosh
const RECEIVE_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'; 

const FONTS = [
  { name: 'Quicksand', family: "'Quicksand', sans-serif" },
  { name: 'Comic', family: "'Bangers', cursive" },
  { name: 'Retro', family: "'Press Start 2P', cursive" },
  { name: 'Ink', family: "'Indie Flower', cursive" },
  { name: 'Marker', family: "'Permanent Marker', cursive" },
  { name: 'Spooky', family: "'Creepster', cursive" },
  { name: 'Robot', family: "'Orbitron', sans-serif" },
  { name: 'Script', family: "'Shadows Into Light', cursive" },
  { name: 'Rock', family: "'Rock Salt', cursive" },
  { name: 'Modern', family: "'Righteous', cursive" },
  { name: 'Fast', family: "'Faster One', cursive" },
  { name: 'Neon', family: "'Monoton', cursive" },
  { name: 'Typewriter', family: "'Special Elite', cursive" },
  { name: 'Urban', family: "'Bungee', cursive" },
  { name: 'Terminal', family: "'VT323', monospace" }
];

const COLORS = [
  '#FFFFFF', '#3B82F6', '#EC4899', '#A855F7', '#FB923C', '#22C55E', '#EAB308', '#EF4444', '#1F2937'
];

const ChatWindow: React.FC<Props> = ({ user }) => {
  const { id: roomId = 'main' } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  
  const [activeFont, setActiveFont] = useState(FONTS[0].family);
  const [activeColor, setActiveColor] = useState('#FFFFFF');
  const [activeSize, setActiveSize] = useState<'s' | 'm' | 'l'>('m');

  const isFirstLoad = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendAudio = useRef(new Audio(SEND_SOUND_URL));
  const receiveAudio = useRef(new Audio(RECEIVE_SOUND_URL));

  useEffect(() => {
    sendAudio.current.volume = 0.3;
    receiveAudio.current.volume = 0.4;
  }, []);

  const scrollToBottom = (instant = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
    }
  };

  useEffect(() => {
    // Re-initialize for room change
    isFirstLoad.current = true;
    
    const q = query(
      collection(db, "messages"),
      where("roomId", "==", roomId),
      orderBy("timestamp", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      let shouldPlayReceiveSound = false;
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          if (!isFirstLoad.current && data.senderId !== user.id) {
            shouldPlayReceiveSound = true;
          }
        }
      });

      snapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({
          id: doc.id,
          senderId: data.senderId,
          sender: data.senderId === user.id ? 'user' : 'friend',
          senderName: data.senderName,
          senderColor: data.senderColor || 'bg-blue-400',
          text: data.text,
          avatar: data.avatar,
          timestamp: data.timestamp?.toDate() || new Date(),
          imageUrl: data.imageUrl,
          photoUrl: data.photoUrl,
          fontFamily: data.fontFamily,
          fontSize: data.fontSize,
          textColor: data.textColor
        } as Message);
      });

      if (shouldPlayReceiveSound) {
        receiveAudio.current.play().catch(() => {});
      }

      const orderedMessages = msgs.reverse();
      setMessages(orderedMessages);
      
      if (isFirstLoad.current) {
        setTimeout(() => scrollToBottom(true), 100);
      }
      isFirstLoad.current = false;
    });

    return () => unsubscribe();
  }, [user.id, roomId]);

  useEffect(() => {
    if (!isFirstLoad.current) {
      scrollToBottom();
    }
  }, [messages]);

  const handleSend = async (image?: string) => {
    if (!inputText.trim() && !image) return;
    
    try {
      sendAudio.current.play().catch(() => {});
      
      await addDoc(collection(db, "messages"), {
        roomId,
        senderId: user.id,
        senderName: user.name,
        senderColor: user.color,
        text: inputText,
        avatar: user.avatar,
        photoUrl: user.photoUrl || null,
        timestamp: Timestamp.now(),
        imageUrl: image || null,
        fontFamily: activeFont,
        fontSize: activeSize,
        textColor: activeColor
      });
      setInputText('');
      setShowEmojiPicker(false);
      setShowFormatMenu(false);
    } catch (err) {
      console.error("Error sending:", err);
    }
  };

  const addEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          handleSend(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getFontSizeClass = (size?: string) => {
    switch (size) {
      case 's': return 'text-sm md:text-base';
      case 'l': return 'text-2xl md:text-4xl';
      default: return 'text-lg md:text-2xl';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatMessageText = (text: string, isEmojiOnly: boolean) => {
    if (!text) return null;
    const emojiRegex = /(\p{Emoji_Presentation})/gu;
    const parts = text.split(emojiRegex);
    
    return parts.map((part, i) => {
      if (emojiRegex.test(part)) {
        return (
          <span 
            key={i} 
            className={`${isEmojiOnly ? 'text-4xl md:text-6xl' : 'text-2xl md:text-4xl'} inline-block align-middle leading-none mx-0.5`}
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl border-4 md:border-8 border-yellow-50 overflow-hidden relative">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth custom-scrollbar">
        {messages.map((msg: any) => {
          const currentPhoto = msg.sender === 'user' ? user.photoUrl : msg.photoUrl;
          const isEmojiOnly = !msg.imageUrl && !msg.text.replace(/(\p{Emoji_Presentation})/gu, '').trim();
          
          return (
            <div key={msg.id} className={`flex items-start gap-3 md:gap-5 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-14 h-14 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center text-2xl md:text-4xl shadow-lg border-2 md:border-4 border-white flex-shrink-0 overflow-hidden ${msg.senderColor}`}>
                {currentPhoto ? (
                  <img src={currentPhoto} className="w-full h-full object-cover" alt={msg.senderName} />
                ) : (
                  msg.avatar
                )}
              </div>
              <div className={`max-w-[70%] md:max-w-[60%] flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-2 px-2 uppercase tracking-wider">
                   <span className="text-[10px] md:text-xs font-black text-gray-500">{msg.senderName}</span>
                   <span className="text-[9px] md:text-[10px] font-bold text-gray-300" title={msg.timestamp.toLocaleString()}>
                     {formatTime(msg.timestamp)}
                   </span>
                </div>
                <div 
                  title={msg.timestamp.toLocaleString()}
                  className={`
                    p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-sm leading-snug 
                    ${msg.sender === 'user' ? 'bg-blue-600 rounded-tr-none' : `${msg.senderColor} rounded-tl-none shadow-md`}
                    ${getFontSizeClass(msg.fontSize)}
                  `}
                  style={{ 
                    fontFamily: msg.fontFamily || 'inherit',
                    color: msg.textColor || '#FFFFFF'
                  }}
                >
                  {msg.imageUrl && <img src={msg.imageUrl} className="mb-4 rounded-3xl max-h-80 w-full object-cover border-4 border-white/20 shadow-lg" alt="shared" />}
                  {formatMessageText(msg.text, isEmojiOnly)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      <div className="p-3 md:p-4 bg-yellow-50 border-t-4 border-yellow-100 shrink-0 z-20">
        <div className="relative flex flex-col gap-2 md:gap-3">
          {showFormatMenu && (
            <div className="absolute bottom-full left-0 mb-4 p-6 bg-white rounded-[2.5rem] shadow-2xl border-4 border-yellow-200 w-full max-h-[60vh] overflow-y-auto custom-scrollbar space-y-6">
              <div>
                <p className="font-kids text-xl text-gray-400 mb-3">Pick a Font! 🎭</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {FONTS.map(f => (
                    <button key={f.name} onClick={() => setActiveFont(f.family)} className={`p-3 rounded-xl border-2 transition-all ${activeFont === f.family ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`} style={{ fontFamily: f.family }}>
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="font-kids text-xl text-gray-400 mb-2">Color 🎨</p>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setActiveColor(c)} className={`w-10 h-10 rounded-full border-4 shadow-sm transition-transform active:scale-90 ${activeColor === c ? 'border-gray-400 scale-110' : 'border-white'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-kids text-xl text-gray-400 mb-2">Size 📏</p>
                  <div className="flex gap-2">
                    {(['s', 'm', 'l'] as const).map(size => (
                      <button 
                        key={size} 
                        onClick={() => setActiveSize(size)} 
                        className={`w-12 h-12 rounded-xl border-4 font-black uppercase transition-all ${activeSize === size ? 'bg-blue-500 text-white border-blue-200' : 'bg-white text-blue-500 border-blue-50'}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-4 p-4 bg-white rounded-[2.5rem] shadow-2xl border-4 border-yellow-200 flex flex-wrap justify-center gap-2 md:gap-4 w-full max-h-[50vh] overflow-y-auto custom-scrollbar">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => addEmoji(e)} className="text-sm md:text-sm hover:scale-125 transition-transform p-1 md:p-1 active:bg-yellow-100 rounded-xl">
                  {e}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl shadow-md text-2xl md:text-4xl flex items-center justify-center border-2 border-yellow-100">🌈</button>
            <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl shadow-md text-2xl md:text-4xl flex items-center justify-center border-2 border-yellow-100">📎</button>
            <button onClick={() => setShowFormatMenu(!showFormatMenu)} className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl shadow-md text-2xl md:text-4xl flex items-center justify-center border-2 border-yellow-100">🖋️</button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type here..."
              style={{ fontFamily: activeFont, color: activeColor === '#FFFFFF' ? '#2563EB' : activeColor }}
              className="flex-1 p-3 md:p-5 bg-white rounded-2xl outline-none font-bold shadow-inner text-base md:text-2xl"
            />
            <button onClick={() => handleSend()} disabled={!inputText.trim()} className="w-12 h-12 md:w-16 md:h-16 bg-blue-500 text-white rounded-2xl shadow-lg text-2xl md:text-3xl flex items-center justify-center active:scale-95 disabled:opacity-50">🚀</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;