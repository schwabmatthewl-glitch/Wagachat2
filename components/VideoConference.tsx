
import React, { useEffect, useRef, useState } from 'react';
import { db } from '../firebase.ts';
import { collection, doc, setDoc, onSnapshot, deleteDoc, addDoc, query, where, Timestamp, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

interface Props {
  userName: string;
}

const servers = {
  iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }],
  iceCandidatePoolSize: 10,
};

const HEARTBEAT_INTERVAL = 5000;
const STALE_THRESHOLD = 12000;

const VideoConference: React.FC<Props> = ({ userName }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  const [participants, setParticipants] = useState<any[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const myId = localStorage.getItem('wagachat_userId') || `guest_${Date.now()}`;
  const sessionId = useRef(`sess_${Date.now()}`).current;

  // Cleanup function to wipe presence and connections
  const cleanup = async () => {
    console.log("Cleaning up video session...");
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    // Fix: Explicitly cast Object.values to RTCPeerConnection[] to avoid "Property 'close' does not exist on type 'unknown'"
    (Object.values(peerConnections.current) as RTCPeerConnection[]).forEach(pc => pc.close());
    peerConnections.current = {};
    
    try {
      // Direct delete of presence to prevent ghosts
      await deleteDoc(doc(db, 'video_presence', myId));
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  };

  useEffect(() => {
    let heartbeat: any;
    let unsubscribePresence: any;
    let unsubscribeCalls: any;

    const init = async () => {
      try {
        // 1. Get Media
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } }, 
          audio: true 
        });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // 2. Establish Presence (Using myId as key to prevent duplicates)
        const presenceRef = doc(db, 'video_presence', myId);
        const updatePresence = () => setDoc(presenceRef, {
          id: myId,
          name: userName,
          lastSeen: Date.now(),
          sessionId: sessionId
        });

        await updatePresence();
        heartbeat = setInterval(updatePresence, HEARTBEAT_INTERVAL);

        // 3. Listen for other participants
        unsubscribePresence = onSnapshot(collection(db, 'video_presence'), (snapshot) => {
          const now = Date.now();
          const others: any[] = [];
          snapshot.forEach(d => {
            const data = d.data();
            if (data.id !== myId && (now - data.lastSeen < STALE_THRESHOLD)) {
              others.push(data);
            }
          });
          setParticipants(others);
        });

        // 4. Listen for incoming signaling calls
        const callsQuery = query(collection(db, 'video_signals'), where('to', '==', myId));
        unsubscribeCalls = onSnapshot(callsQuery, (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.type === 'offer' && !peerConnections.current[data.from]) {
                await handleOffer(data.from, data.sdp, change.doc.id, stream);
              }
            }
          });
        });

      } catch (err) {
        console.error("Initialization failed:", err);
      }
    };

    init();
    window.addEventListener('beforeunload', cleanup);

    return () => {
      clearInterval(heartbeat);
      if (unsubscribePresence) unsubscribePresence();
      if (unsubscribeCalls) unsubscribeCalls();
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, []);

  // Determine signaling doc ID: always smallerId_largerId
  const getSignalPath = (peerId: string) => {
    const ids = [myId, peerId].sort();
    return `${ids[0]}_${ids[1]}`;
  };

  const setupPeer = (peerId: string, stream: MediaStream) => {
    if (peerConnections.current[peerId]) return peerConnections.current[peerId];

    const pc = new RTCPeerConnection(servers);
    peerConnections.current[peerId] = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({ ...prev, [peerId]: event.streams[0] }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(collection(db, 'video_signals'), {
          type: 'candidate',
          from: myId,
          to: peerId,
          candidate: event.candidate.toJSON(),
          timestamp: Timestamp.now()
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (['disconnected', 'closed', 'failed'].includes(pc.iceConnectionState)) {
        closePeer(peerId);
      }
    };

    // Listen for ICE candidates for this peer
    const candQuery = query(
      collection(db, 'video_signals'), 
      where('from', '==', peerId), 
      where('to', '==', myId),
      where('type', '==', 'candidate')
    );
    
    onSnapshot(candQuery, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added' && pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(change.doc.data().candidate)).catch(e => {});
        }
      });
    });

    return pc;
  };

  const closePeer = (peerId: string) => {
    if (peerConnections.current[peerId]) {
      peerConnections.current[peerId].close();
      delete peerConnections.current[peerId];
    }
    setRemoteStreams(prev => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  };

  const handleOffer = async (fromId: string, sdp: string, docId: string, stream: MediaStream) => {
    const pc = setupPeer(fromId, stream);
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await addDoc(collection(db, 'video_signals'), {
      type: 'answer',
      from: myId,
      to: fromId,
      sdp: answer.sdp,
      timestamp: Timestamp.now()
    });
  };

  // Only the lexicographically smaller ID initiates the call to prevent races
  useEffect(() => {
    if (!localStream) return;
    participants.forEach(async (p) => {
      if (!peerConnections.current[p.id] && myId < p.id) {
        const pc = setupPeer(p.id, localStream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await addDoc(collection(db, 'video_signals'), {
          type: 'offer',
          from: myId,
          to: p.id,
          sdp: offer.sdp,
          timestamp: Timestamp.now()
        });

        // Listen for answer
        const ansQuery = query(
          collection(db, 'video_signals'), 
          where('from', '==', p.id), 
          where('to', '==', myId),
          where('type', '==', 'answer')
        );
        const unsub = onSnapshot(ansQuery, (snap) => {
          snap.forEach(async (d) => {
            if (!pc.remoteDescription) {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: d.data().sdp }));
            }
          });
        });
      }
    });
  }, [participants, localStream]);

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
              <div key={p.id} className="relative aspect-video rounded-3xl overflow-hidden border-4 border-white/10 bg-gray-900 shadow-2xl">
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
                    <span className="text-white font-kids mt-4">Connecting to {p.name}...</span>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 right-4 text-yellow-300 font-kids text-xl md:text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,1)] truncate">{p.name}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="absolute top-6 left-6 w-24 h-32 md:w-32 md:h-44 rounded-2xl md:rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl z-20 bg-gray-800">
        <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} />
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
        <button onClick={() => window.location.hash = '/'} className="px-8 h-14 bg-red-500 text-white font-kids text-lg rounded-2xl shadow-xl hover:bg-red-600 active:scale-95 border-b-4 border-red-800 active:border-b-0">Leave 👋</button>
      </div>
    </div>
  );
};

export default VideoConference;
