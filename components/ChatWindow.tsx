
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase.ts';
import { collection, addDoc, query, orderBy, onSnapshot, limit, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Message } from '../types.ts';
import { EMOJIS } from '../constants.ts';

interface Props {
  user: any;
}

const SEND_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/1105/1105-preview.mp3'; 
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  
  // Formatting states
  const [activeFont, setActiveFont] = useState(FONTS[0].family);
  const [activeColor, setActiveColor] = useState('#FFFFFF');
  const [activeSize, setActiveSize] = useState<'s' | 'm' | 'l'>('m');

  const isFirstLoad = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendAudio = useRef(new Audio(SEND_SOUND_URL));
  const receiveAudio = useRef(new Audio(RECEIVE_SOUND_URL));

  useEffect(() => {
    sendAudio.current.volume = 0.15;
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
        const isFromMe = data.senderId === user.id;
        msgs.push({
          id: doc.id,
          senderId: data.senderId,
          sender: isFromMe ? 'user' : 'friend',
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

      setMessages(msgs);
      isFirstLoad.current = false;
    });

    return () => unsubscribe();
  }, [user.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (image?: string) => {
    if (!inputText.trim() && !image) return;
    
    try {
      sendAudio.current.play().catch(() => {});
      
      await addDoc(collection(db, "messages"), {
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
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        handleSend(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const getFontSize = (size?: string) => {
    switch (size) {
      case 's': return 'text-sm md:text-base';
      case 'l': return 'text-2xl md:text-4xl';
      default: return 'text-lg md:text-2xl';
    }
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
            style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))' }}
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth custom-scrollbar">
        {messages.map((msg: any) => {
          const currentPhoto = msg.sender === 'user' ? user.photoUrl : msg.photoUrl;
          const isEmojiOnly = !msg.imageUrl && !msg.text.replace(/(\p{Emoji_Presentation})/gu, '').trim();
          
          return (
            <div key={msg.id} className={`flex items-start gap-4 md:gap-6 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-28 h-28 md:w-36 md:h-36 rounded-[2rem] flex items-center justify-center text-5xl md:text-6xl shadow-xl border-4 border-white flex-shrink-0 overflow-hidden ${msg.senderColor}`}>
                {currentPhoto ? (
                  <img src={currentPhoto} className="w-full h-full object-cover" alt={msg.senderName} />
                ) : (
                  msg.avatar
                )}
              </div>
              <div className={`max-w-[70%] md:max-w-[60%] flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div 
                  className={`text-[12px] md:text-base font-black mb-2 px-2 uppercase tracking-wider`}
                  style={{ color: msg.senderColor.includes('blue') ? '#3B82F6' : msg.senderColor.includes('pink') ? '#EC4899' : msg.senderColor.includes('purple') ? '#A855F7' : msg.senderColor.includes('orange') ? '#FB923C' : msg.senderColor.includes('green') ? '#22C55E' : '#EAB308' }}
                >
                  {msg.senderName}
                </div>
                <div 
                  className={`
                    p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-sm leading-snug 
                    ${msg.sender === 'user' ? 'bg-blue-600 rounded-tr-none' : `${msg.senderColor} rounded-tl-none shadow-md`}
                    ${getFontSize(msg.fontSize)}
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
      </div>

      <div className="p-3 md:p-4 bg-yellow-50 border-t-4 border-yellow-100 shrink-0 z-20">
        <div className="relative flex flex-col gap-2 md:gap-3">
          {showFormatMenu && (
            <div className="absolute bottom-full left-0 mb-4 p-6 bg-white rounded-[2.5rem] shadow-2xl border-4 border-yellow-200 w-full max-h-[60vh] overflow-y-auto custom-scrollbar space-y-6">
              <div>
                <p className="font-kids text-xl text-gray-400 mb-3">Pick a Font! 🎭</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {FONTS.map(f => (
                    <button 
                      key={f.name}
                      onClick={() => setActiveFont(f.family)}
                      className={`p-3 rounded-xl border-2 transition-all ${activeFont === f.family ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`}
                      style={{ fontFamily: f.family }}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-kids text-xl text-gray-400 mb-2">Color 🎨</p>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map(c => (
                      <button 
                        key={c}
                        onClick={() => setActiveColor(c)}
                        className={`w-10 h-10 rounded-full border-4 shadow-sm transition-transform active:scale-90 ${activeColor === c ? 'border-gray-400 scale-110' : 'border-white'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="font-kids text-xl text-gray-400 mb-2">Size 📏</p>
                  <div className="flex bg-gray-100 p-1 rounded-2xl">
                    {(['s', 'm', 'l'] as const).map(s => (
                      <button 
                        key={s}
                        onClick={() => setActiveSize(s)}
                        className={`px-6 py-2 rounded-xl font-kids text-xl transition-all ${activeSize === s ? 'bg-white shadow-md text-blue-500' : 'text-gray-400'}`}
                      >
                        {s.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

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
              <button 
                onClick={() => setShowFormatMenu(!showFormatMenu)}
                className={`w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl shadow-md text-2xl md:text-4xl flex items-center justify-center border-2 border-yellow-100 hover:bg-yellow-50 transition-colors ${showFormatMenu ? 'ring-4 ring-blue-200' : ''}`}
              >
                🖋️
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
                style={{ 
                  fontFamily: activeFont, 
                  color: activeColor === '#FFFFFF' ? '#2563EB' : activeColor 
                }}
                className={`w-full p-3 md:p-5 bg-white rounded-2xl outline-none font-bold shadow-inner text-base md:text-2xl border-2 border-transparent focus:border-blue-200`}
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
