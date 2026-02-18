
import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  userName: string;
}

// Daily.co room URL - this is your public room
const DAILY_ROOM_URL = 'https://wagachat.daily.co/wagachat';

interface Participant {
  id: string;
  name: string;
  videoTrack?: MediaStreamTrack;
  audioTrack?: MediaStreamTrack;
  isLocal: boolean;
}

const VideoConference: React.FC<Props> = ({ userName }) => {
  const [callFrame, setCallFrame] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Load Daily.co script dynamically
  useEffect(() => {
    const loadDaily = async () => {
      // Check if Daily is already loaded
      if ((window as any).DailyIframe) {
        initializeCall();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@daily-co/daily-js';
      script.async = true;
      script.onload = () => {
        initializeCall();
      };
      script.onerror = () => {
        setError('Failed to load video chat. Please refresh and try again.');
        setIsJoining(false);
      };
      document.body.appendChild(script);
    };

    loadDaily();

    return () => {
      if (callFrame) {
        callFrame.leave();
        callFrame.destroy();
      }
    };
  }, []);

  const initializeCall = async () => {
    try {
      const Daily = (window as any).DailyIframe;
      
      const frame = Daily.createCallObject({
        videoSource: true,
        audioSource: true,
      });

      // Set up event listeners
      frame.on('joined-meeting', handleJoinedMeeting);
      frame.on('left-meeting', handleLeftMeeting);
      frame.on('participant-joined', handleParticipantUpdate);
      frame.on('participant-left', handleParticipantUpdate);
      frame.on('participant-updated', handleParticipantUpdate);
      frame.on('track-started', handleTrackStarted);
      frame.on('track-stopped', handleTrackStopped);
      frame.on('error', handleError);

      setCallFrame(frame);

      // Join the room
      await frame.join({
        url: DAILY_ROOM_URL,
        userName: userName || 'Friend',
      });

    } catch (err: any) {
      console.error('Failed to initialize call:', err);
      setError(err.message || 'Failed to join video chat');
      setIsJoining(false);
    }
  };

  const handleJoinedMeeting = useCallback((event: any) => {
    console.log('Joined meeting:', event);
    setIsJoining(false);
    updateParticipants();
  }, []);

  const handleLeftMeeting = useCallback(() => {
    console.log('Left meeting');
    setParticipants([]);
  }, []);

  const handleParticipantUpdate = useCallback(() => {
    updateParticipants();
  }, []);

  const handleTrackStarted = useCallback((event: any) => {
    console.log('Track started:', event);
    updateParticipants();
    
    // Update local video preview
    if (event.participant?.local && event.track?.kind === 'video' && localVideoRef.current) {
      const stream = new MediaStream([event.track]);
      localVideoRef.current.srcObject = stream;
    }
  }, []);

  const handleTrackStopped = useCallback(() => {
    updateParticipants();
  }, []);

  const handleError = useCallback((event: any) => {
    console.error('Daily error:', event);
    setError(event.errorMsg || 'An error occurred');
  }, []);

  const updateParticipants = useCallback(() => {
    if (!callFrame) return;

    const dailyParticipants = callFrame.participants();
    const participantList: Participant[] = [];

    Object.values(dailyParticipants).forEach((p: any) => {
      participantList.push({
        id: p.session_id,
        name: p.user_name || 'Friend',
        videoTrack: p.tracks?.video?.track,
        audioTrack: p.tracks?.audio?.track,
        isLocal: p.local,
      });
    });

    setParticipants(participantList);
  }, [callFrame]);

  // Update participants when callFrame changes
  useEffect(() => {
    if (callFrame) {
      updateParticipants();
    }
  }, [callFrame, updateParticipants]);

  const toggleMute = () => {
    if (callFrame) {
      callFrame.setLocalAudio(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (callFrame) {
      callFrame.setLocalVideo(!isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  const leaveCall = async () => {
    if (callFrame) {
      await callFrame.leave();
      callFrame.destroy();
    }
    window.location.hash = '/';
  };

  // Get remote participants (non-local)
  const remoteParticipants = participants.filter(p => !p.isLocal);
  const localParticipant = participants.find(p => p.isLocal);

  // Render a participant's video
  const ParticipantVideo: React.FC<{ participant: Participant }> = ({ participant }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
      if (videoRef.current && participant.videoTrack) {
        const stream = new MediaStream([participant.videoTrack]);
        videoRef.current.srcObject = stream;
      }
    }, [participant.videoTrack]);

    return (
      <div className="relative aspect-video rounded-3xl overflow-hidden border-4 border-white/10 bg-gray-900 shadow-2xl">
        {participant.videoTrack ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={participant.isLocal}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-pink-500/30 to-purple-500/30">
            <span className="text-6xl mb-2">😊</span>
            <span className="text-white font-kids text-lg">Camera off</span>
          </div>
        )}
        <div className="absolute bottom-4 left-4 right-4 text-yellow-300 font-kids text-xl md:text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,1)] truncate">
          {participant.name}
        </div>
      </div>
    );
  };

  // Loading state
  if (isJoining) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-950 rounded-[3rem]">
        <span className="text-8xl floating mb-6">🎬</span>
        <h2 className="text-3xl font-kids text-white mb-2">Joining the Party!</h2>
        <p className="text-blue-200 text-lg font-bold">Getting your camera ready...</p>
        <div className="mt-6 flex gap-2">
          <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-950 rounded-[3rem] p-8">
        <span className="text-8xl mb-6">😕</span>
        <h2 className="text-3xl font-kids text-white mb-2">Oops!</h2>
        <p className="text-red-300 text-lg font-bold text-center mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-8 h-14 bg-blue-500 text-white font-kids text-lg rounded-2xl shadow-xl hover:bg-blue-600 active:scale-95 border-b-4 border-blue-800"
        >
          Try Again 🔄
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative bg-gray-950 rounded-[3rem] overflow-hidden">
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className={`grid gap-4 md:gap-6 w-full h-full max-w-4xl mx-auto ${
          remoteParticipants.length === 0 ? 'grid-cols-1' : 
          remoteParticipants.length === 1 ? 'grid-cols-1 md:grid-cols-2' : 
          'grid-cols-2'
        }`}>
          {remoteParticipants.length === 0 ? (
            <div className="col-span-full h-full flex flex-col items-center justify-center text-center space-y-4">
              <span className="text-8xl floating">🎈</span>
              <h2 className="text-3xl font-kids text-white">Clubhouse Party!</h2>
              <p className="text-blue-200 text-lg font-bold">Waiting for your friends to join...</p>
              <p className="text-gray-400 text-sm mt-4">Share the app with friends so they can join!</p>
            </div>
          ) : (
            remoteParticipants.map((participant) => (
              <ParticipantVideo key={participant.id} participant={participant} />
            ))
          )}
        </div>
      </div>

      {/* Local video preview */}
      <div className="absolute top-6 left-6 w-24 h-32 md:w-32 md:h-44 rounded-2xl md:rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl z-20 bg-gray-800">
        <video 
          ref={localVideoRef} 
          autoPlay 
          playsInline 
          muted 
          className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} 
        />
        {isVideoOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-500 text-3xl">🌟</div>
        )}
        <div className="absolute bottom-2 left-0 right-0 text-white font-black text-[10px] uppercase text-center drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
          ME
        </div>
      </div>

      {/* Participant count badge */}
      <div className="absolute top-6 right-6 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full z-20">
        <span className="text-white font-kids text-lg">
          👥 {participants.length} {participants.length === 1 ? 'person' : 'people'}
        </span>
      </div>

      {/* Controls */}
      <div className="p-4 md:p-6 flex items-center justify-center gap-4 bg-white/5 border-t border-white/10 shrink-0 z-30">
        <button 
          onClick={toggleMute} 
          className={`w-14 h-14 flex items-center justify-center text-2xl rounded-2xl transition-all shadow-lg ${
            isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>
        <button 
          onClick={toggleVideo} 
          className={`w-14 h-14 flex items-center justify-center text-2xl rounded-2xl transition-all shadow-lg ${
            isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {isVideoOff ? '🚫' : '📹'}
        </button>
        <button 
          onClick={leaveCall} 
          className="px-8 h-14 bg-red-500 text-white font-kids text-lg rounded-2xl shadow-xl hover:bg-red-600 active:scale-95 border-b-4 border-red-800 active:border-b-0"
        >
          Leave 👋
        </button>
      </div>
    </div>
  );
};

export default VideoConference;
