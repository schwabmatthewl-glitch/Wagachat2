
import React, { useEffect, useRef, useState } from 'react';
import { Friend } from '../types';

interface Props {
  userName: string;
  friends: Friend[];
}

const VideoConference: React.FC<Props> = ({ userName, friends }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    async function getMedia() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Error accessing media devices", err);
      }
    }
    getMedia();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  // Only show actual friends who are added
  const activeParticipants = friends.slice(0, 3);
  const totalParticipants = 1 + activeParticipants.length;

  return (
    <div className="h-full flex flex-col gap-6">
      <div className={`flex-1 grid gap-6 auto-rows-fr ${
        totalParticipants === 1 
          ? 'grid-cols-1' 
          : 'grid-cols-1 md:grid-cols-2'
      }`}>
        {/* User Local Stream */}
        <div className={`relative group rounded-[3rem] overflow-hidden bg-gray-900 shadow-2xl border-8 border-white ring-8 ring-blue-100 transition-all duration-500 ${
          totalParticipants === 1 ? 'max-w-4xl mx-auto w-full' : ''
        }`}>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover transition-opacity duration-500 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
          />
          {isVideoOff && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-400 to-indigo-600">
              <span className="text-9xl floating">🌟</span>
              <span className="text-white font-kids text-2xl mt-4">Camera is Off!</span>
            </div>
          )}
          <div className="absolute bottom-6 left-6 bg-blue-500/80 backdrop-blur-xl px-6 py-3 rounded-[1.5rem] text-white font-kids text-lg shadow-lg border-2 border-white/50">
            {userName} (Me) {isMuted && '🔇'}
          </div>
          
          {totalParticipants === 1 && (
            <div className="absolute top-6 right-6 bg-white/20 backdrop-blur-md px-6 py-3 rounded-full border border-white/30 animate-pulse">
               <span className="text-white font-bold text-sm tracking-widest uppercase">Waiting for friends... 🌈</span>
            </div>
          )}
        </div>

        {/* Display Actual Friends only */}
        {activeParticipants.map((f, i) => (
          <div key={f.id} className={`relative rounded-[3rem] overflow-hidden shadow-2xl border-8 border-white ring-8 ${i === 0 ? 'ring-pink-100' : i === 1 ? 'ring-yellow-100' : 'ring-purple-100'}`}>
            <img 
              src={`https://picsum.photos/seed/${f.id}/800/600`} 
              alt={f.name} 
              className="w-full h-full object-cover opacity-90 transition-transform duration-700 hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-6 left-6 flex items-center gap-3 bg-white/90 backdrop-blur px-5 py-2.5 rounded-[1.5rem] shadow-lg border-2 border-white">
              <span className="text-2xl">{f.avatar}</span>
              <span className="font-kids text-gray-800 text-lg">{f.name}</span>
            </div>
            <div className="absolute top-6 right-6">
              <span className="flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 shadow-sm border-2 border-white"></span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 md:gap-8 p-6 bg-white/80 backdrop-blur-2xl rounded-[3rem] shadow-2xl border-4 border-white mb-4">
        <button 
          onClick={toggleMute}
          className={`w-16 h-16 md:w-20 md:h-20 flex items-center justify-center text-3xl md:text-4xl rounded-[2rem] transition-all shadow-xl border-b-8 active:border-b-0 active:translate-y-2 ${isMuted ? 'bg-red-500 text-white border-red-800' : 'bg-blue-100 text-blue-600 border-blue-200 hover:bg-blue-200'}`}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>
        <button 
          onClick={toggleVideo}
          className={`w-16 h-16 md:w-20 md:h-20 flex items-center justify-center text-3xl md:text-4xl rounded-[2rem] transition-all shadow-xl border-b-8 active:border-b-0 active:translate-y-2 ${isVideoOff ? 'bg-red-500 text-white border-red-800' : 'bg-pink-100 text-pink-600 border-pink-200 hover:bg-pink-200'}`}
        >
          {isVideoOff ? '🚫' : '📹'}
        </button>
        <button className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center text-3xl md:text-4xl bg-yellow-100 text-yellow-600 rounded-[2rem] transition-all shadow-xl border-b-8 border-yellow-200 hover:bg-yellow-200 active:border-b-0 active:translate-y-2">
          🎉
        </button>
        <button className="hidden sm:block px-10 h-20 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-kids text-xl rounded-[2rem] shadow-2xl transition-all active:scale-95 border-b-8 border-red-800 active:border-b-0 active:translate-y-2 uppercase tracking-widest">
          Leave Party
        </button>
        <button className="sm:hidden w-16 h-16 flex items-center justify-center bg-red-500 text-white rounded-[2rem] shadow-xl border-b-8 border-red-800 active:border-b-0 active:translate-y-2">
          👋
        </button>
      </div>
    </div>
  );
};

export default VideoConference;
