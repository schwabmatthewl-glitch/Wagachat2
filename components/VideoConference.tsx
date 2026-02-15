
import React, { useEffect, useRef, useState } from 'react';
import { db } from '../firebase.ts';
import { collection, doc, setDoc, onSnapshot, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

interface Props {
  userName: string;
}

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

const HEARTBEAT_INTERVAL = 6000; 
const STALE_THRESHOLD = 15000;   

const VideoConference: React.FC<Props> = ({ userName }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  const [participants, setParticipants] = useState<any[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const myId = localStorage.getItem('wagachat_userId') || `guest_${Date.now()}`;

  const cleanup = async () => {
    localStream?.getTracks().forEach(t => t.stop());
    (Object.values(peerConnections.current) as RTCPeerConnection[]).forEach(pc => pc.close());
    peerConnections.current = {};
    try {
      await deleteDoc(doc(db, 'video_presence', myId));
    } catch (e) {}
  };

  useEffect(() => {
    let heartbeat: any;

    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        
        const presenceRef = doc(db, 'video_presence', myId);
        const updatePresence = async () => {
          await setDoc(presenceRef, {
            id: myId,
            name: userName,
            lastSeen: Date.now(),
            joinedAt: new Date().getTime(),
          }, { merge: true });
        };

        await updatePresence();
        heartbeat = setInterval(updatePresence, HEARTBEAT_INTERVAL);

        onSnapshot(collection(db, 'video_presence'), (snapshot) => {
          const now = Date.now();
          const others: any[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            const isMe = data.id === myId;
            const isFresh = (now - (data.lastSeen || 0)) < STALE_THRESHOLD;
            if (!isMe && isFresh) {
              others.push(data);
            }
          });
          setParticipants(others);
        });

        onSnapshot(collection(db, 'video_calls'), async (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.to === myId && !peerConnections.current[data.from]) {
                await answerCall(change.doc.id, data.from, data.offer, stream);
              }
            }
          });
        });

        window.addEventListener('beforeunload', cleanup);
      } catch (err) {
        console.error("Camera access error:", err);
      }
    };

    startMedia();
    return () => {
      if (heartbeat) clearInterval(heartbeat);
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, []);

  const createPeerConnection = (otherId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection(servers);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => ({ ...prev, [otherId]: event.streams[0] }));
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[otherId];
          return next;
        });
      }
    };

    peerConnections.current[otherId] = pc;
    return pc;
  };

  const callUser = async (otherId: string) => {
    if (peerConnections.current[otherId] || !localStream) return;
    const pc = createPeerConnection(otherId, localStream);
    const callDoc = doc(collection(db, 'video_calls'));
    pc.onicecandidate = (event) => {
      if (event.candidate) addDoc(collection(callDoc, 'offerCandidates'), event.candidate.toJSON());
    };
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);
    await setDoc(callDoc, { from: myId, to: otherId, offer: { sdp: offerDescription.sdp, type: offerDescription.type } });
    onSnapshot(callDoc, (doc) => {
      const data = doc.data();
      if (!pc.currentRemoteDescription && data?.answer) pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    });
    onSnapshot(collection(callDoc, 'answerCandidates'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      });
    });
  };

  const answerCall = async (callId: string, fromId: string, offer: any, stream: MediaStream) => {
    const pc = createPeerConnection(fromId, stream);
    const callDoc = doc(db, 'video_calls', callId);
    pc.onicecandidate = (event) => {
      if (event.candidate) addDoc(collection(callDoc, 'answerCandidates'), event.candidate.toJSON());
    };
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);
    await setDoc(callDoc, { answer: { type: answerDescription.type, sdp: answerDescription.sdp } }, { merge: true });
    onSnapshot(collection(callDoc, 'offerCandidates'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      });
    });
  };

  useEffect(() => {
    participants.forEach(p => {
      if (!peerConnections.current[p.id] && myId < p.id) callUser(p.id);
    });
  }, [participants]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  // Determine grid columns
  const getGridCols = (count: number) => {
    if (count <= 1) return 'grid-cols-1';
    if (count <= 2) return 'grid-cols-1 md:grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-2 md:grid-cols-3';
    return 'grid-cols-3';
  };

  return (
    <div className="h-full flex flex-col relative bg-gray-950 rounded-[3rem] overflow-hidden">
      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className={`grid gap-4 md:gap-6 w-full h-full ${getGridCols(participants.length)}`}>
          {participants.length === 0 ? (
            <div className="col-span-full h-full flex flex-col items-center justify-center text-center space-y-4">
              <span className="text-8xl floating">🎈</span>
              <h2 className="text-3xl font-kids text-white">Clubhouse Party!</h2>
              <p className="text-blue-200 text-lg font-bold">Waiting for your friends to join...</p>
            </div>
          ) : (
            participants.map((p) => (
              <div key={p.id} className="relative aspect-video rounded-3xl overflow-hidden border-4 border-white/10 bg-gray-900 shadow-2xl transition-all">
                {remoteStreams[p.id] ? (
                  <video 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                    ref={el => { if (el) el.srcObject = remoteStreams[p.id]; }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-pink-500/20">
                    <span className="text-4xl animate-bounce">🎈</span>
                    <span className="text-white font-bold text-sm uppercase mt-2">Connecting to {p.name}...</span>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 right-4 bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl text-white font-kids text-lg border-2 border-white/20 truncate">
                  {p.name}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Selfie View - Smaller and Floating top-left */}
      <div className="absolute top-6 left-6 w-28 h-40 md:w-36 md:h-52 rounded-2xl md:rounded-3xl overflow-hidden border-4 border-white shadow-2xl z-20 bg-gray-800 pointer-events-none">
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
        <div className="absolute bottom-1 left-1 right-1 bg-blue-500/80 backdrop-blur-sm text-white px-2 py-0.5 rounded-lg text-[10px] font-black uppercase text-center">ME</div>
      </div>

      {/* Footer Controls */}
      <div className="p-4 md:p-6 flex items-center justify-center gap-4 bg-white/5 border-t border-white/10 shrink-0 z-30">
        <button onClick={toggleMute} className={`w-14 h-14 flex items-center justify-center text-2xl rounded-2xl transition-all shadow-lg ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
          {isMuted ? '🔇' : '🎤'}
        </button>
        <button onClick={toggleVideo} className={`w-14 h-14 flex items-center justify-center text-2xl rounded-2xl transition-all shadow-lg ${isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
          {isVideoOff ? '🚫' : '📹'}
        </button>
        <button 
          onClick={() => window.location.hash = '/'}
          className="px-8 h-14 bg-red-500 text-white font-kids text-lg rounded-2xl shadow-xl hover:bg-red-600 active:scale-95 transition-all border-b-4 border-red-800 active:border-b-0"
        >
          Leave 👋
        </button>
      </div>
    </div>
  );
};

export default VideoConference;
