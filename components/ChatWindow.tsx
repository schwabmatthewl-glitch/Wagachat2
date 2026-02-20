
import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase.ts';
import { collection, addDoc, query, orderBy, onSnapshot, limit, Timestamp, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Message } from '../types.ts';
import { EMOJIS } from '../constants.ts';

interface Props {
  user: any;
  dmFriend?: any; // The friend we're DMing with (passed from parent)
}

const SEND_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'; // Soft swoosh
const RECEIVE_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

// ============================================
// SOUND EFFECTS FEATURE (experimental - set to false to disable)
const SOUND_EFFECTS_ENABLED = true;

// Sound effects for private chat messages (hosted locally in /public/sounds/)
const SOUND_EFFECTS = [
  { id: 'trumpet', icon: '🎺', name: 'Trumpet', url: '/sounds/Trumpet.mp3' },
  { id: 'piano', icon: '🎹', name: 'Piano', url: 'https://assets.mixkit.co/active_storage/sfx/2576/2576-preview.mp3' },
  { id: 'yay', icon: '🎉', name: 'Yay!', url: '/sounds/yay.mp3' },
  { id: 'boing', icon: '🦘', name: 'Boing', url: '/sounds/boing.mp3' },
  { id: 'dinosaur', icon: '🦖', name: 'Dino', url: '/sounds/dinosaur.wav' },
  { id: 'chimes', icon: '🔔', name: 'Chimes', url: '/sounds/chimes.wav' },
  { id: 'birds', icon: '🐦', name: 'Birds', url: '/sounds/birds.wav' },
  { id: 'splat', icon: '💥', name: 'Splat', url: '/sounds/splat.wav' },
  { id: 'car', icon: '🚗', name: 'Car', url: '/sounds/car.wav' },
  { id: 'fairy', icon: '🧚', name: 'Fairy', url: '/sounds/fairy.wav' },
  { id: 'space', icon: '🚀', name: 'Space', url: '/sounds/space.wav' },
  { id: 'kitty', icon: '🐱', name: 'Kitty', url: '/sounds/kitty.wav' },
];

// Sound placeholder marker used in text
const SOUND_MARKER_PREFIX = '[[SND:';
const SOUND_MARKER_SUFFIX = ']]';
// ============================================

const FONTS = [
  { name: 'Quicksand', family: "'Quicksand', sans-serif" },
  { name: 'Comic', family: "'Bangers', cursive" },
  { name: 'Retro', family: "'Press Start 2P', cursive" },
  { name: 'Ink', family: "'Indie Flower', cursive" },
  { name: 'Marker', family: "'Permanent Marker', cursive" },
  { name: 'Robot', family: "'Orbitron', sans-serif" },
  { name: 'Script', family: "'Shadows Into Light', cursive" },
  { name: 'Rock', family: "'Rock Salt', cursive" },
  { name: 'Modern', family: "'Righteous', cursive" },
  { name: 'Fast', family: "'Faster One', cursive" },
  { name: 'Neon', family: "'Monoton', cursive" },
  { name: 'Typewriter', family: "'Special Elite', cursive" },
  { name: 'Urban', family: "'Bungee', cursive" },
  { name: 'Terminal', family: "'VT323', monospace" },
  { name: 'Balloon', family: "'Luckiest Guy', cursive" },
  { name: 'Blocky', family: "'Rubik Mono One', sans-serif" },
  { name: 'Outline', family: "'Londrina Outline', cursive" },
  { name: 'Bubbly', family: "'Bubblegum Sans', cursive" },
  { name: 'Chunky', family: "'Titan One', cursive" }
];

const COLORS = [
  '#FFFFFF', '#3B82F6', '#EC4899', '#A855F7', '#FB923C', '#22C55E', '#EAB308', '#EF4444', '#1F2937'
];

const ChatWindow: React.FC<Props> = ({ user, dmFriend: dmFriendProp }) => {
  const { id: roomId, friendId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [fetchedFriend, setFetchedFriend] = useState<any>(null);
  
  const [activeFont, setActiveFont] = useState(FONTS[0].family);
  const [activeColor, setActiveColor] = useState('#FFFFFF');
  const [activeSize, setActiveSize] = useState<'s' | 'm' | 'l'>('m');

  const isFirstLoad = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendAudio = useRef(new Audio(SEND_SOUND_URL));
  const receiveAudio = useRef(new Audio(RECEIVE_SOUND_URL));
  const processedMessageIds = useRef<Set<string>>(new Set());

  // Use prop if available, otherwise use fetched friend
  const dmFriend = dmFriendProp || fetchedFriend;

  // Determine if this is a DM or group chat based on the route
  const isDM = !!friendId;
  const dmPairId = isDM && friendId ? [user.id, friendId].sort().join('_') : null;

  // Fetch friend data if we have friendId but no dmFriendProp (e.g., direct URL navigation)
  useEffect(() => {
    if (friendId && !dmFriendProp) {
      const fetchFriend = async () => {
        try {
          const friendDoc = await getDoc(doc(db, "users", friendId));
          if (friendDoc.exists()) {
            setFetchedFriend(friendDoc.data());
          }
        } catch (e) {
          console.error("Error fetching friend:", e);
        }
      };
      fetchFriend();
    } else if (!friendId) {
      setFetchedFriend(null);
    }
  }, [friendId, dmFriendProp]);

  useEffect(() => {
    sendAudio.current.volume = 0.4;
    receiveAudio.current.volume = 0.4;
  }, []);

  const scrollToBottom = (instant = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
    }
  };

  useEffect(() => {
    // Reset on room/DM change
    isFirstLoad.current = true;
    setMessages([]);

    // Build the query based on whether it's a DM or group chat
    let q;
    if (isDM && dmPairId) {
      // DM: Query messages with this specific dmPairId
      q = query(
        collection(db, "messages"),
        where("dmPairId", "==", dmPairId),
        orderBy("timestamp", "desc"),
        limit(100)
      );
    } else {
      // Group chat (Clubhouse): Query ALL messages and filter client-side
      // This is because existing messages don't have dmPairId field
      q = query(
        collection(db, "messages"),
        orderBy("timestamp", "desc"),
        limit(100)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      let shouldPlayReceiveSound = false;
      const soundsToPlay: string[] = [];
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const msgId = change.doc.id;
          
          // Only process new messages from others that we haven't seen
          if (!isFirstLoad.current && data.senderId !== user.id && !processedMessageIds.current.has(msgId)) {
            shouldPlayReceiveSound = true;
            processedMessageIds.current.add(msgId);
            
            // Extract sound effects from the message text
            if (SOUND_EFFECTS_ENABLED && data.text) {
              const soundRegex = /\[\[SND:(\w+)\]\]/g;
              let match;
              while ((match = soundRegex.exec(data.text)) !== null) {
                soundsToPlay.push(match[1]);
              }
            }
          }
        }
      });

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        
        // For Clubhouse (non-DM), filter out messages that have a dmPairId
        if (!isDM && data.dmPairId) {
          return; // Skip DM messages in Clubhouse view
        }
        
        msgs.push({
          id: docSnap.id,
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
        
        // Play any sound effects embedded in the message (with delay between each)
        if (SOUND_EFFECTS_ENABLED && soundsToPlay.length > 0) {
          let delay = 300; // Start after receive sound
          soundsToPlay.forEach((soundId) => {
            const soundEffect = SOUND_EFFECTS.find(s => s.id === soundId);
            if (soundEffect) {
              setTimeout(() => {
                const audio = new Audio(soundEffect.url);
                audio.volume = 0.5;
                audio.play().catch(() => {});
              }, delay);
              delay += 800; // Space out multiple sounds
            }
          });
        }
      }

      const orderedMessages = msgs.reverse();
      setMessages(orderedMessages);
      
      if (isFirstLoad.current) {
        setTimeout(() => scrollToBottom(true), 100);
      }
      isFirstLoad.current = false;
    }, (error) => {
      console.error("Error fetching messages:", error);
    });

    return () => unsubscribe();
  }, [user.id, isDM, dmPairId, friendId, roomId]);

  useEffect(() => {
    if (!isFirstLoad.current) {
      scrollToBottom();
    }
  }, [messages]);

  // Add sound effect to input text
  const addSoundEffect = (soundId: string) => {
    const sound = SOUND_EFFECTS.find(s => s.id === soundId);
    if (sound) {
      setInputText(prev => prev + `${SOUND_MARKER_PREFIX}${soundId}${SOUND_MARKER_SUFFIX}`);
      setShowSoundPicker(false);
    }
  };

  // Render text with sound icons displayed
  const renderInputWithSounds = (text: string) => {
    if (!text) return '';
    
    // Replace sound markers with their icons for display
    let displayText = text;
    SOUND_EFFECTS.forEach(sound => {
      const marker = `${SOUND_MARKER_PREFIX}${sound.id}${SOUND_MARKER_SUFFIX}`;
      displayText = displayText.split(marker).join(sound.icon);
    });
    return displayText;
  };

  const handleSend = async (image?: string) => {
    if (!inputText.trim() && !image) return;
    
    try {
      sendAudio.current.play().catch(() => {});
      
      const messageData: any = {
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
        textColor: activeColor,
      };

      // Only add dmPairId for DM messages
      if (isDM && dmPairId) {
        messageData.dmPairId = dmPairId;
      }
      
      await addDoc(collection(db, "messages"), messageData);
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
    
    // First replace sound markers with their icons
    let processedText = text;
    if (SOUND_EFFECTS_ENABLED) {
      SOUND_EFFECTS.forEach(sound => {
        const marker = `${SOUND_MARKER_PREFIX}${sound.id}${SOUND_MARKER_SUFFIX}`;
        processedText = processedText.split(marker).join(sound.icon);
      });
    }
    
    const emojiRegex = /(\p{Emoji_Presentation})/gu;
    const parts = processedText.split(emojiRegex);
    
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`h-full flex flex-col rounded-[2rem] md:rounded-[3rem] shadow-2xl border-4 md:border-8 border-yellow-50 overflow-hidden relative ${isDM ? 'bg-purple-50' : 'bg-white'}`}>
      {/* DM Header */}
      {isDM && dmFriend && (
        <div className="bg-gradient-to-r from-purple-100 to-pink-100 px-6 py-4 border-b-4 border-purple-200 flex items-center gap-4 shrink-0">
          <div className={`w-12 h-12 rounded-xl ${dmFriend.color || 'bg-purple-400'} flex items-center justify-center text-2xl shadow-lg border-2 border-white overflow-hidden`}>
            {dmFriend.photoUrl ? (
              <img src={dmFriend.photoUrl} className="w-full h-full object-cover" alt={dmFriend.name} />
            ) : (
              dmFriend.avatar || '👤'
            )}
          </div>
          <div>
            <p className="font-kids text-purple-600 text-xl">Private Chat with {dmFriend.name}! 💜</p>
            <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">Just the two of you</p>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <span className="text-6xl">💬</span>
            <p className="text-gray-400 font-bold">
              {isDM ? `Start a conversation with ${dmFriend?.name || 'your friend'}!` : 'No messages yet. Say hello!'}
            </p>
          </div>
        )}
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
            <div className="absolute bottom-full left-0 mb-4 p-4 bg-white rounded-[2.5rem] shadow-2xl border-4 border-yellow-200 flex flex-wrap justify-center gap-3 md:gap-5 w-full max-h-[50vh] overflow-y-auto custom-scrollbar">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => addEmoji(e)} className="text-4xl md:text-6xl hover:scale-125 transition-transform p-1 md:p-2 active:bg-yellow-100 rounded-xl">
                  {e}
                </button>
              ))}
            </div>
          )}

          {/* Sound Effects Picker - Only shown in DM */}
          {SOUND_EFFECTS_ENABLED && isDM && showSoundPicker && (
            <div className="absolute bottom-full left-0 mb-4 p-4 bg-white rounded-[2rem] shadow-2xl border-4 border-purple-200 w-auto max-w-xs">
              <p className="font-kids text-purple-500 text-lg mb-3 text-center">Send a Sound! 🎵</p>
              <div className="flex flex-wrap justify-center gap-3">
                {SOUND_EFFECTS.map(sound => (
                  <button 
                    key={sound.id} 
                    onClick={() => addSoundEffect(sound.id)}
                    className="flex flex-col items-center p-3 rounded-xl hover:bg-purple-50 active:bg-purple-100 transition-all"
                    title={sound.name}
                  >
                    <span className="text-3xl md:text-4xl">{sound.icon}</span>
                    <span className="text-[10px] font-bold text-purple-400 mt-1">{sound.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl shadow-md text-2xl md:text-4xl flex items-center justify-center border-2 border-yellow-100">🌈</button>
            <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl shadow-md text-2xl md:text-4xl flex items-center justify-center border-2 border-yellow-100">📎</button>
            <button onClick={() => setShowFormatMenu(!showFormatMenu)} className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl shadow-md text-2xl md:text-4xl flex items-center justify-center border-2 border-yellow-100">🖋️</button>
            {/* Sound Effects Button - Only shown in DM */}
            {SOUND_EFFECTS_ENABLED && isDM && (
              <button 
                onClick={() => setShowSoundPicker(!showSoundPicker)} 
                className={`w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl shadow-md text-2xl md:text-4xl flex items-center justify-center border-2 ${showSoundPicker ? 'border-purple-400 bg-purple-50' : 'border-purple-100'}`}
              >
                🎺
              </button>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            <input
              type="text"
              value={renderInputWithSounds(inputText)}
              onChange={(e) => {
                // We need to preserve the actual markers, so only update if not sound-related
                // This is tricky - for simplicity, we'll show the actual markers in the input
                setInputText(e.target.value);
              }}
              onKeyDown={handleKeyDown}
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
