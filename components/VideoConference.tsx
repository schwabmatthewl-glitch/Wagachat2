
import React, { useEffect, useRef, useState } from 'react';
import { db } from '../firebase.ts';
import { collection, doc, setDoc, onSnapshot, deleteDoc, addDoc, query, onSnapshotsInSync } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const VideoConference: React.FC<Props> = ({ userName }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  const [participants, setParticipants] = useState<any[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const myId = useRef(localStorage.getItem('wagachat_userId') || `guest_${Date.now()}`);

  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        
        // 1. Announce presence
        const presenceRef = doc(db, 'video_presence', myId.current);
        await setDoc(presenceRef, {
          id: myId.current,
          name: userName,
          joinedAt: new Date(),
        });

        // 2. Listen for other participants
        onSnapshot(collection(db, 'video_presence'), (snapshot) => {
          const others: any[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            if (data.id !== myId.current) others.push(data);
          });
          setParticipants(others);
        });

        // 3. Listen for incoming calls (Signaling)
        const callsCol = collection(db, 'video_calls');
        onSnapshot(callsCol, async (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              // If someone is calling ME
              if (data.to === myId.current && !peerConnections.current[data.from]) {
                await answerCall(change.doc.id, data.from, data.offer, stream);
              }
            }
          });
        });

      } catch (err) {
        console.error("Camera access error:", err);
        alert("Oh no! Sparky couldn't find your camera! 📸");
      }
    };

    startMedia();

    return () => {
      // Cleanup
      localStream?.getTracks().forEach(t => t.stop());
      // Fix: Cast values to RTCPeerConnection array to avoid 'unknown' type error on pc.close()
      (Object.values(peerConnections.current) as RTCPeerConnection[]).forEach(pc => pc.close());
      deleteDoc(doc(db, 'video_presence', myId.current));
    };
  }, []);

  const createPeerConnection = (otherId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection(servers);
    
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [otherId]: event.streams[0],
      }));
    };

    peerConnections.current[otherId] = pc;
    return pc;
  };

  // Called when we see a new participant and want to initiate connection
  const callUser = async (otherId: string) => {
    if (peerConnections.current[otherId] || !localStream) return;
    
    const pc = createPeerConnection(otherId, localStream);
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const callDoc = doc(collection(db, 'video_calls'));
    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await setDoc(callDoc, { from: myId.current, to: otherId, offer });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(collection(callDoc, 'offerCandidates'), event.candidate.toJSON());
      }
    };

    // Listen for answer
    onSnapshot(callDoc, (doc) => {
      const data = doc.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
      }
    });

    // Listen for remote ICE candidates
    onSnapshot(collection(callDoc, 'answerCandidates'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
  };

  const answerCall = async (callId: string, fromId: string, offer: any, stream: MediaStream) => {
    const pc = createPeerConnection(fromId, stream);
    const callDoc = doc(db, 'video_calls', callId);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(collection(callDoc, 'answerCandidates'), event.candidate.toJSON());
      }
    };

    const offerDescription = new RTCSessionDescription(offer);
    await pc.setRemoteDescription(offerDescription);

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await setDoc(callDoc, { answer }, { merge: true });

    onSnapshot(collection(callDoc, 'offerCandidates'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

  // Trigger calls to existing participants when we join
  useEffect(() => {
    participants.forEach(p => {
      if (!peerConnections.current[p.id]) {
        callUser(p.id);
      }
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
    <div className="h-full flex flex-col gap-8">
      <div className="flex-1 grid gap-8 auto-rows-fr grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Local Video */}
        <div className="relative rounded-[3rem] overflow-hidden bg-gray-900 shadow-2xl border-8 border-white ring-8 ring-blue-100 group">
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
          />
          {isVideoOff && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-400">
              <span className="text-9xl mb-4">🌟</span>
              <p className="text-white font-kids text-2xl">Camera Off!</p>
            </div>
          )}
          <div className="absolute bottom-6 left-6 bg-blue-500/90 backdrop-blur-xl px-6 py-3 rounded-2xl text-white font-kids text-xl shadow-lg border-2 border-white/50">
            Me {isMuted && '🔇'}
          </div>
        </div>

        {/* Remote Videos */}
        {participants.map((p) => (
          <div key={p.id} className="relative rounded-[3rem] overflow-hidden bg-gray-800 shadow-2xl border-8 border-white ring-8 ring-pink-100">
            {remoteStreams[p.id] ? (
              <video 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
                ref={el => { if (el) el.srcObject = remoteStreams[p.id]; }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-pink-400 animate-pulse">
                <span className="text-9xl mb-4">🎈</span>
                <p className="text-white font-kids text-2xl">Connecting to {p.name}...</p>
              </div>
            )}
            <div className="absolute bottom-6 left-6 bg-pink-500/90 backdrop-blur-xl px-6 py-3 rounded-2xl text-white font-kids text-xl shadow-lg border-2 border-white/50">
              {p.name}
            </div>
          </div>
        ))}
        
        {participants.length === 0 && (
          <div className="relative rounded-[3rem] overflow-hidden bg-yellow-100 border-8 border-white border-dashed flex flex-col items-center justify-center p-12 text-center">
            <span className="text-9xl mb-8 floating">🌈</span>
            <h3 className="text-3xl font-kids text-yellow-600 mb-4">Waiting for friends!</h3>
            <p className="text-yellow-700 font-bold text-xl">Tell someone to join the party on another device!</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 p-8 bg-white/90 backdrop-blur-3xl rounded-[3.5rem] shadow-2xl border-4 border-white mb-6">
        <button onClick={toggleMute} className={`w-20 h-20 flex items-center justify-center text-4xl rounded-3xl transition-all shadow-xl border-b-8 active:border-b-0 active:translate-y-2 ${isMuted ? 'bg-red-500 text-white border-red-800' : 'bg-blue-100 text-blue-600 border-blue-200 hover:bg-blue-200'}`}>
          {isMuted ? '🔇' : '🎤'}
        </button>
        <button onClick={toggleVideo} className={`w-20 h-20 flex items-center justify-center text-4xl rounded-3xl transition-all shadow-xl border-b-8 active:border-b-0 active:translate-y-2 ${isVideoOff ? 'bg-red-500 text-white border-red-800' : 'bg-pink-100 text-pink-600 border-pink-200 hover:bg-pink-200'}`}>
          {isVideoOff ? '🚫' : '📹'}
        </button>
        <button className="px-12 h-20 bg-gradient-to-r from-red-500 to-pink-500 text-white font-kids text-2xl rounded-3xl shadow-2xl hover:scale-105 transition-all border-b-8 border-red-800 active:border-b-0 active:translate-y-2">
          End Party 👋
        </button>
      </div>
    </div>
  );
};

export default VideoConference;
