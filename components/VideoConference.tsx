
import React, { useEffect, useRef, useState } from 'react';
import { db } from '../firebase.ts';
import { collection, doc, setDoc, onSnapshot, deleteDoc, addDoc, query, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Ghost detection constants
const HEARTBEAT_INTERVAL = 6000; // Update lastSeen every 6 seconds
const STALE_THRESHOLD = 15000;   // Consider a user "ghost" if no update in 15 seconds (very aggressive)

const VideoConference: React.FC<Props> = ({ userName }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  const [participants, setParticipants] = useState<any[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  
  // Use persistent ID strictly to avoid duplicate entries on refresh
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
            const lastSeen = data.lastSeen || 0;
            // Strict staleness check
            const isFresh = (now - lastSeen) < STALE_THRESHOLD;
            
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
        if (focusedId === otherId) setFocusedId(null);
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

  const focusedParticipant = participants.find(p => p.id === focusedId);

  return (
    <div className="h-full flex flex-col relative bg-gray-900 rounded-[3rem] overflow-hidden">
      <div className="flex-1 relative flex items-center justify-center p-4 min-h-0">
        {focusedId && remoteStreams[focusedId] ? (
          <div className="w-full h-full relative animate-in fade-in zoom-in-95 duration-300">
            <video autoPlay playsInline className="w-full h-full object-cover rounded-[2.5rem]" ref={el => { if (el) el.srcObject = remoteStreams[focusedId!]; }} />
            <button onClick={() => setFocusedId(null)} className="absolute top-4 right-4 w-12 h-12 bg-red-500 text-white rounded-full flex items-center justify-center text-2xl shadow-2xl z-20">✕</button>
            <div className="absolute bottom-6 left-6 bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl text-white font-kids text-lg border-2 border-white/20">Watching {focusedParticipant?.name}</div>
          </div>
        ) : (
          <div className="text-center p-6 space-y-4">
            <span className="text-7xl md:text-9xl floating inline-block">🎈</span>
            <h2 className="text-3xl md:text-4xl font-kids text-white">Video Clubhouse</h2>
            <p className="text-blue-200 text-lg font-bold">{participants.length > 0 ? "Tap a friend below to see them big!" : "Waiting for friends..."}</p>
          </div>
        )}
        <div className="absolute top-4 left-4 w-24 h-32 md:w-48 md:h-64 rounded-2xl md:rounded-3xl overflow-hidden border-2 md:border-4 border-white shadow-2xl z-10 bg-gray-800">
          <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} />
          {isVideoOff && <div className="absolute inset-0 flex items-center justify-center bg-blue-500 text-2xl md:text-4xl">🌟</div>}
          <div className="absolute bottom-1 right-1 bg-blue-500 text-white px-1 py-0.5 rounded text-[8px] md:text-[10px] font-black uppercase">ME</div>
        </div>
      </div>

      <div className="h-44 md:h-56 bg-white/10 backdrop-blur-xl border-t border-white/10 p-4 flex gap-4 overflow-x-auto overflow-y-hidden custom-scrollbar shrink-0">
        {participants.map((p) => (
          <div key={p.id} className="h-full shrink-0 flex flex-col">
            <button onClick={() => setFocusedId(p.id)} className={`relative h-[85%] aspect-video rounded-xl md:rounded-2xl overflow-hidden transition-all border-2 md:border-4 min-w-[150px] md:min-w-[220px] ${focusedId === p.id ? 'border-pink-500 scale-95 ring-4 ring-pink-500/30' : 'border-white/20 hover:border-white hover:scale-105'}`}>
              {remoteStreams[p.id] ? <video autoPlay playsInline className="w-full h-full object-cover pointer-events-none" ref={el => { if (el) el.srcObject = remoteStreams[p.id]; }} /> : <div className="w-full h-full bg-pink-400 flex flex-col items-center justify-center gap-1"><span className="text-2xl animate-bounce">🎈</span><span className="text-[8px] md:text-[10px] text-white font-bold px-2 text-center uppercase">Connecting...</span></div>}
            </button>
            <div className="mt-1 bg-black/50 backdrop-blur-sm rounded-lg py-1 px-2 text-[8px] md:text-[10px] text-white font-bold truncate text-center max-w-full">{p.name}</div>
          </div>
        ))}
      </div>

      <div className="p-4 md:p-6 flex items-center justify-center gap-4 bg-white/5 border-t border-white/10 shrink-0">
        <button onClick={toggleMute} className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-xl md:text-2xl rounded-2xl transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>{isMuted ? '🔇' : '🎤'}</button>
        <button onClick={toggleVideo} className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center text-xl md:text-2xl rounded-2xl transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>{isVideoOff ? '🚫' : '📹'}</button>
        <button onClick={() => window.location.hash = '/'} className="px-6 md:px-8 h-12 md:h-14 bg-red-500 text-white font-kids text-base md:text-lg rounded-2xl shadow-xl hover:bg-red-600 active:scale-95 transition-all">Leave 👋</button>
      </div>
    </div>
  );
};

export default VideoConference;
