
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
        
        // Create call object with explicit audio/video settings
        const frame = Daily.createCallObject({
          startVideoOff: false,
          startAudioOff: false,
        });
        
        callFrameRef.current = frame;
        
        // Expose to window for debugging (can check in console)
        (window as any).dailyCall = frame;

        // Set up event listeners
        frame.on('joined-meeting', () => {
          if (mounted) {
            console.log('Joined meeting - local participant:', frame.participants().local);
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

        frame.on('participant-updated', (event: any) => {
          console.log('Participant updated:', event?.participant?.user_name, event?.participant?.tracks);
          if (mounted) updateParticipantList(frame);
        });

        frame.on('track-started', (event: any) => {
          console.log('Track started:', event?.track?.kind, 'from', event?.participant?.user_name, 'local:', event?.participant?.local);
          if (!mounted) return;
          updateParticipantList(frame);
          
          // Update local video preview
          if (event.participant?.local && event.track?.kind === 'video' && localVideoRef.current) {
            const stream = new MediaStream([event.track]);
            localVideoRef.current.srcObject = stream;
          }
        });

        frame.on('track-stopped', (event: any) => {
          console.log('Track stopped:', event?.track?.kind, 'from', event?.participant?.user_name);
          if (mounted) updateParticipantList(frame);
        });

        frame.on('error', (event: any) => {
          console.error('Daily error:', event);
          if (mounted) {
            setError(event.errorMsg || 'An error occurred');
            setIsJoining(false);
          }
        });

        // Listen for camera/mic access errors
        frame.on('camera-error', (event: any) => {
          console.error('Camera error:', event);
        });

        frame.on('nonfatal-error', (event: any) => {
          console.warn('Daily non-fatal error:', event);
        });

        // Join the room with explicit audio/video on
        await frame.join({
          url: DAILY_ROOM_URL,
          userName: userName || 'Friend',
          startVideoOff: false,
          startAudioOff: false,
        });

        // Double-check audio is enabled after joining
        console.log('After join - audio enabled:', frame.localAudio(), 'video enabled:', frame.localVideo());

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
        // Try multiple ways to get the tracks (Daily.co API varies)
        const videoTrack = p.tracks?.video?.persistentTrack || p.tracks?.video?.track || p.videoTrack;
        const audioTrack = p.tracks?.audio?.persistentTrack || p.tracks?.audio?.track || p.audioTrack;
        
        console.log(`Participant ${p.user_name}: video=${!!videoTrack}, audio=${!!audioTrack}, local=${p.local}`);
        
        participantList.push({
          id: p.session_id,
          name: p.user_name || 'Friend',
          videoTrack: videoTrack,
          audioTrack: audioTrack,
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
      if (videoRef.current) {
        // Combine both video and audio tracks into the stream
        const tracks: MediaStreamTrack[] = [];
        if (participant.videoTrack) {
          tracks.push(participant.videoTrack);
        }
        if (participant.audioTrack) {
          tracks.push(participant.audioTrack);
        }
        
        console.log(`Setting up ${participant.name}: ${tracks.length} tracks (video: ${!!participant.videoTrack}, audio: ${!!participant.audioTrack}), isLocal: ${participant.isLocal}`);
        
        if (tracks.length > 0) {
          const stream = new MediaStream(tracks);
          videoRef.current.srcObject = stream;
          
          // Log what's actually in the video element
          console.log(`${participant.name} video element - muted: ${videoRef.current.muted}, tracks in stream:`, stream.getTracks().map(t => t.kind));
        }
      }
    }, [participant.videoTrack, participant.audioTrack, participant.name, participant.isLocal]);

    return (
      <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border-4 border-white/10 bg-gray-900 shadow-2xl">
        {/* Always render video element for audio playback, hide visually if no video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className={`w-full h-full object-cover ${!participant.videoTrack ? 'hidden' : ''}`}
        />
        {!participant.videoTrack && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-pink-500/30 to-purple-500/30">
            <span className="text-6xl mb-2">😊</span>
            <span className="text-white font-kids text-lg">Camera off</span>
          </div>
        )}
        <div className="absolute bottom-4 left-4 right-4 text-yellow-300 font-kids text-xl md:text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,1)] truncate text-center">
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
    <div className="h-full flex flex-col bg-gray-950 rounded-[3rem] overflow-hidden">
      {/* Header with selfie cam and participant count */}
      <div className="shrink-0 p-4 flex items-center justify-between bg-white/5 border-b border-white/10">
        {/* Local video preview - portrait */}
        <div className="w-20 h-28 md:w-24 md:h-32 rounded-2xl overflow-hidden border-3 border-white shadow-xl bg-gray-800 relative">
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} 
          />
          {isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-blue-500 text-2xl">🌟</div>
          )}
          <div className="absolute bottom-1 left-0 right-0 text-white font-black text-[8px] uppercase text-center drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
            ME
          </div>
        </div>

        {/* Title and participant count */}
        <div className="flex-1 text-center px-4">
          <h2 className="text-xl md:text-2xl font-kids text-white">Video Party! 🎉</h2>
          <span className="text-blue-200 text-sm font-bold">
            👥 {participants.length} {participants.length === 1 ? 'person' : 'people'}
          </span>
        </div>

        {/* Spacer to balance layout */}
        <div className="w-20 md:w-24"></div>
      </div>

      {/* Participants grid - quadrant layout with portrait videos */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className={`grid gap-4 w-full h-full max-w-3xl mx-auto ${
          remoteParticipants.length === 0 ? 'grid-cols-1' : 
          remoteParticipants.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' : 
          remoteParticipants.length === 2 ? 'grid-cols-2 max-w-lg mx-auto' :
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

      {/* Controls */}
      <div className="p-4 md:p-6 flex items-center justify-center gap-4 bg-white/5 border-t border-white/10 shrink-0">
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
