import React, { useEffect, useRef, useState } from 'react';
import { db } from '../firebase.ts';
import { collection, doc, setDoc, onSnapshot, deleteDoc, addDoc, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const setMediaBitrate = (sdp: string, bitrate: number) => {
  return sdp.replace(/m=video.*\r\n/g, `$&\r\nb=AS:${bitrate}\r\n`);
};

const VideoConference: React.FC<Props> = ({ userName }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  const [participants, setParticipants] = useState<any[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const pendingCandidates = useRef<{ [key: string]: any[] }>({});
  const myId = localStorage.getItem('wagachat_userId') || `guest_${Date.now()}`;

  const cleanup = async () => {
    localStream?.getTracks().forEach(t => t.stop());
    (Object.values(peerConnections.current) as RTCPeerConnection[]).forEach(pc => pc.close());
    peerConnections.current = {};
    try {
      await deleteDoc(doc(db, 'video_presence', myId));
    } catch (e) {}
  };

  const processPendingCandidates = (otherId: string) => {
    const pc = peerConnections.current[otherId];
    if (pc && pc.remoteDescription && pendingCandidates.current[otherId]) {
      pendingCandidates.current[otherId].forEach(candidate => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Queued candidate error:", e));
      });
      delete pendingCandidates.current[otherId];
    }
  };

  useEffect(() => {
    let heartbeat: any;

    const startMedia = async () => {
      try {
        // Optimized for iOS compatibility: using ideal instead of exact constraints
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { min: 320, ideal: 640, max: 1280 },
            height: { min: 240, ideal: 480, max: 720 },
            frameRate: { ideal: 15, max: 20 }
          }, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {}); // Safety play for mobile
        }
        
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
            if (!isMe && isFresh) others.push(data);
          });
          setParticipants(others);
        });

        const startTime = Date.now() - 60000;
        const callsQuery = query(collection(db, 'video_calls'), where('to', '==', myId));

        onSnapshot(callsQuery, async (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.timestamp?.toMillis() > startTime && !peerConnections.current[data.from]) {
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
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed' || pc.iceConnectionState === 'failed') {
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[otherId];
          return next;
        });
        if (peerConnections.current[otherId]) {
          peerConnections.current[otherId].close();
          delete peerConnections.current[otherId];
        }
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

    let offer = await pc.createOffer();
    offer = new RTCSessionDescription({ type: offer.type, sdp: setMediaBitrate(offer.sdp!, 300) });
    await pc.setLocalDescription(offer);
    
    await setDoc(callDoc, { 
      from: myId, to: otherId, offer: { sdp: offer.sdp, type: offer.type }, timestamp: Timestamp.now()
    });

    onSnapshot(callDoc, (doc) => {
      const data = doc.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        pc.setRemoteDescription(new RTCSessionDescription(data.answer))
          .then(() => processPendingCandidates(otherId));
      }
    });

    onSnapshot(collection(callDoc, 'answerCandidates'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = change.doc.data();
          if (pc.remoteDescription) pc.addIceCandidate(new RTCIceCandidate(candidate));
          else {
            if (!pendingCandidates.current[otherId]) pendingCandidates.current[otherId] = [];
            pendingCandidates.current[otherId].push(candidate);
          }
        }
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
    processPendingCandidates(fromId);
    
    let answer = await pc.createAnswer();
    answer = new RTCSessionDescription({ type: answer.type, sdp: setMediaBitrate(answer.sdp!, 300) });
    await pc.setLocalDescription(answer);
    
    await setDoc(callDoc, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true });

    onSnapshot(collection(callDoc, 'offerCandidates'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = change.doc.data();
          if (pc.remoteDescription) pc.addIceCandidate(new RTCIceCandidate(candidate));
          else {
            if (!pendingCandidates.current[fromId]) pendingCandidates.current[fromId] = [];
            pendingCandidates.current[fromId].push(candidate);
          }
        }
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

  return (
    <div className="h-full flex flex-col relative bg-gray-950 rounded-[3rem] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className={`grid gap-4 md:gap-6 w-full h-full max-w-4xl mx-auto ${participants.length <= 1 ? 'grid-cols-1' : participants.length <= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2'}`}>
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
                    ref={el => { if (el) { el.srcObject = remoteStreams[p.id]; el.play().catch(() => {}); } }} 
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-pink-500/20">
                    <span className="text-4xl animate-bounce">🎈</span>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 right-4 text-yellow-300 font-kids text-xl md:text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,1)] truncate">{p.name}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="absolute top-6 left-6 w-20 h-28 md:w-24 md:h-34 rounded-2xl md:rounded-3xl overflow-hidden border-4 border-white shadow-2xl z-20 bg-gray-800 pointer-events-none">
        <video 
          ref={localVideoRef} 
          autoPlay 
          playsInline 
          muted 
          className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} 
        />
        {isVideoOff && <div className="absolute inset-0 flex items-center justify-center bg-blue-500 text-3xl">🌟</div>}
        <div className="absolute bottom-2 left-0 right-0 text-white font-black text-[10px] uppercase text-center drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">ME</div>
      </div>

      <div className="p-4 md:p-6 flex items-center justify-center gap-4 bg-white/5 border-t border-white/10 shrink-0 z-30">
        <button onClick={toggleMute} className={`w-14 h-14 flex items-center justify-center text-2xl rounded-2xl transition-all shadow-lg ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
          {isMuted ? '🔇' : '🎤'}
        </button>
        <button onClick={toggleVideo} className={`w-14 h-14 flex items-center justify-center text-2xl rounded-2xl transition-all shadow-lg ${isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
          {isVideoOff ? '🚫' : '📹'}
        </button>
        <button onClick={() => window.location.hash = '/'} className="px-8 h-14 bg-red-500 text-white font-kids text-lg rounded-2xl shadow-xl hover:bg-red-600 active:scale-95 transition-all border-b-4 border-red-800 active:border-b-0">Leave 👋</button>
      </div>
    </div>
  );
};

export default VideoConference;