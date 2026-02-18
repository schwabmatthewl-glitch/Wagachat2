
import React, { useEffect, useRef, useState } from 'react';

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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const callFrameRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization (React strict mode)
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    let mounted = true;

    const loadAndJoin = async () => {
      try {
        // Load Daily.co script if not already loaded
        if (!(window as any).DailyIframe) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@daily-co/daily-js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Daily.co'));
            document.body.appendChild(script);
          });
        }

        if (!mounted) return;

        const Daily = (window as any).DailyIframe;
        
        // Create call object
        const frame = Daily.createCallObject({
          videoSource: true,
          audioSource: true,
        });
        
        callFrameRef.current = frame;

        // Set up event listeners
        frame.on('joined-meeting', () => {
          if (mounted) {
            setIsJoining(false);
            updateParticipantList(frame);
          }
        });

        frame.on('left-meeting', () => {
          if (mounted) {
            setParticipants([]);
          }
        });

        frame.on('participant-joined', () => {
          if (mounted) updateParticipantList(frame);
        });

        frame.on('participant-left', () => {
          if (mounted) updateParticipantList(frame);
        });

        frame.on('participant-updated', () => {
          if (mounted) updateParticipantList(frame);
        });

        frame.on('track-started', (event: any) => {
          if (!mounted) return;
          updateParticipantList(frame);
          
          // Update local video preview
          if (event.participant?.local && event.track?.kind === 'video' && localVideoRef.current) {
            const stream = new MediaStream([event.track]);
            localVideoRef.current.srcObject = stream;
          }
        });

        frame.on('track-stopped', () => {
          if (mounted) updateParticipantList(frame);
        });

        frame.on('error', (event: any) => {
          console.error('Daily error:', event);
          if (mounted) {
            setError(event.errorMsg || 'An error occurred');
            setIsJoining(false);
          }
        });

        // Join the room
        await frame.join({
          url: DAILY_ROOM_URL,
          userName: userName || 'Friend',
        });

      } catch (err: any) {
        console.error('Failed to initialize call:', err);
        if (mounted) {
          setError(err.message || 'Failed to join video chat');
          setIsJoining(false);
        }
      }
    };

    loadAndJoin();

    // Cleanup function
    return () => {
      mounted = false;
      if (callFrameRef.current) {
        try {
          callFrameRef.current.leave().catch(() => {});
          callFrameRef.current.destroy();
        } catch (e) {
          console.log('Cleanup error (safe to ignore):', e);
        }
        callFrameRef.current = null;
      }
    };
  }, [userName]);

  const updateParticipantList = (frame: any) => {
    if (!frame) return;

    try {
      const dailyParticipants = frame.participants();
      const participantList: Participant[] = [];

      Object.values(dailyParticipants).forEach((p: any) => {
        participantList.push({
          id: p.session_id,
          name: p.user_name || 'Friend',
          videoTrack: p.tracks?.video?.persistentTrack,
          audioTrack: p.tracks?.audio?.persistentTrack,
          isLocal: p.local,
        });
      });

      setParticipants(participantList);
    } catch (e) {
      console.error('Error updating participants:', e);
    }
  };

  const toggleMute = () => {
    if (callFrameRef.current) {
      const newMuted = !isMuted;
      callFrameRef.current.setLocalAudio(!newMuted);
      setIsMuted(newMuted);
    }
  };

  const toggleVideo = () => {
    if (callFrameRef.current) {
      const newVideoOff = !isVideoOff;
      callFrameRef.current.setLocalVideo(!newVideoOff);
      setIsVideoOff(newVideoOff);
    }
  };

  const leaveCall = async () => {
    if (callFrameRef.current) {
      try {
        await callFrameRef.current.leave();
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      } catch (e) {
        console.log('Leave error:', e);
      }
    }
    window.location.hash = '/';
  };

  // Get remote participants (non-local)
  const remoteParticipants = participants.filter(p => !p.isLocal);

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
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
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
