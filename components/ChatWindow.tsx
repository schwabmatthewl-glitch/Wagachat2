
import React, { useState, useRef, useEffect } from 'react';
import { Message, Friend } from '../types';
import { EMOJIS } from '../constants';

interface Props {
  userName: string;
  friends: Friend[];
}

const ChatWindow: React.FC<Props> = ({ userName, friends }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'friend',
      senderName: 'Clubhouse Bot',
      text: `Welcome, ${userName}! Add some friends to start the party! 🎈✨`,
      avatar: '🤖',
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle camera stream
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
          alert("Oops! Sparky couldn't find your camera. Check your settings! 📸");
        });
    }
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [isCameraOpen]);

  const handleSend = (image?: string) => {
    if (!inputText.trim() && !image) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      senderName: userName,
      text: inputText,
      avatar: '🌟',
      timestamp: new Date(),
      imageUrl: image,
    };

    setMessages([...messages, newMessage]);
    setInputText('');
    setShowEmojiPicker(false);

    // If there are friends, simulate a random response
    if (friends.length > 0 && Math.random() > 0.5) {
      setTimeout(() => {
        const friend = friends[Math.floor(Math.random() * friends.length)];
        const replies = [
          "That sounds so much fun! 🍦",
          "Wow! Tell me more! 🌈",
          "Hahaha! 😂",
          "You're the best! 🦄",
          "Let's play later! 🎮",
          "Cool picture! 📸✨",
        ];
        
        const reply: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'friend',
          senderName: friend.name,
          text: replies[Math.floor(Math.random() * replies.length)],
          avatar: friend.avatar,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, reply]);
      }, 2000);
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
      {/* Camera Modal Overlay */}
      {isCameraOpen && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="relative w-full max-w-lg aspect-video bg-gray-900 rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="mt-8 flex gap-6">
            <button 
              onClick={() => setIsCameraOpen(false)}
              className="px-8 py-4 bg-white/20 hover:bg-white/30 text-white font-kids text-xl rounded-2xl transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={capturePhoto}
              className="px-10 py-4 bg-pink-500 hover:bg-pink-600 text-white font-kids text-2xl rounded-2xl shadow-xl border-b-4 border-pink-800 active:border-b-0 active:translate-y-1 transition-all"
            >
              Snap & Send! 📸
            </button>
          </div>
        </div>
      )}

      {/* Decorative Stickers */}
      <div className="absolute top-4 right-4 text-4xl opacity-20 pointer-events-none floating">🎨</div>
      <div className="absolute bottom-24 left-4 text-4xl opacity-20 pointer-events-none floating" style={{animationDelay: '1s'}}>🚀</div>

      {/* Messages area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth bg-[url('https://www.transparenttextures.com/patterns/white-diamond.png')]"
      >
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex items-end gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`w-14 h-14 rounded-3xl flex items-center justify-center text-3xl shadow-lg border-4 border-white flex-shrink-0 transform transition-transform hover:scale-110
              ${msg.sender === 'user' ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gradient-to-br from-pink-400 to-pink-600'}
            `}>
              {msg.avatar}
            </div>
            
            <div className={`max-w-[80%] md:max-w-[65%]`}>
              <div className={`text-xs font-black mb-1.5 px-3 uppercase tracking-wider ${msg.sender === 'user' ? 'text-blue-500 text-right' : 'text-pink-500 text-left'}`}>
                {msg.senderName} • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className={`
                p-5 rounded-[2rem] text-base md:text-lg font-bold shadow-md leading-relaxed border-b-4
                ${msg.sender === 'user' 
                  ? 'bg-blue-500 text-white rounded-br-none border-blue-700' 
                  : 'bg-white text-gray-800 rounded-bl-none border-gray-100'}
              `}>
                {msg.imageUrl && (
                  <div className="mb-3 overflow-hidden rounded-2xl border-4 border-white shadow-sm">
                    <img src={msg.imageUrl} alt="Shared content" className="w-full h-auto object-cover max-h-60" />
                  </div>
                )}
                {msg.text}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="p-6 bg-yellow-50 border-t-8 border-yellow-100">
        <div className="relative flex flex-col gap-4">
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-6 p-6 bg-white rounded-[3rem] shadow-2xl border-4 border-yellow-200 flex flex-wrap gap-2 w-full max-w-lg z-20 animate-in zoom-in-50 duration-200 max-h-[40vh] overflow-y-auto custom-scrollbar">
              {EMOJIS.map(e => (
                <button 
                  key={e} 
                  onClick={() => addEmoji(e)}
                  className="text-3xl hover:scale-150 transition-transform p-2 bg-yellow-50 rounded-2xl hover:bg-yellow-100 m-1"
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {/* Top Row: Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange}
                />
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-white hover:bg-pink-100 text-3xl md:text-4xl rounded-[1.2rem] md:rounded-[1.5rem] transition-all shadow-lg border-4 border-pink-200 active:scale-90 group"
                  title="Attach a photo"
                >
                  <span className="group-hover:rotate-12 transition-transform">📎</span>
                </button>

                <button 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-white hover:bg-yellow-100 text-3xl md:text-4xl rounded-[1.2rem] md:rounded-[1.5rem] transition-all shadow-lg border-4 border-yellow-200 active:scale-90"
                >
                  🌈
                </button>

                {/* NEW: Camera Button */}
                <button 
                  onClick={() => setIsCameraOpen(true)}
                  className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-white hover:bg-blue-100 text-3xl md:text-4xl rounded-[1.2rem] md:rounded-[1.5rem] transition-all shadow-lg border-4 border-blue-200 active:scale-90"
                  title="Take a selfie"
                >
                  📸
                </button>
              </div>

              <button 
                onClick={() => handleSend()}
                className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-[1.2rem] md:rounded-[1.5rem] shadow-xl hover:shadow-blue-200 transition-all active:scale-90 border-b-4 border-blue-800"
              >
                <span className="text-2xl md:text-3xl">🚀</span>
              </button>
            </div>

            {/* Bottom Row: Text Input (Wide) */}
            <div className="relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Say something fun!..."
                className="w-full p-4 md:p-5 bg-white border-4 border-transparent focus:border-blue-400 rounded-[2rem] outline-none font-bold text-lg md:text-xl text-gray-700 transition-all placeholder-gray-300 shadow-inner"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
