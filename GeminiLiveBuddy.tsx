
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

// Implement audio encoding/decoding as requested in instructions
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const GeminiLiveBuddy: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState('');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  const startSession = async () => {
    setIsConnecting(true);
    // Create new GoogleGenAI instance right before call to ensure up-to-date config
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = outputAudioContext;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              // Crucial: send input only after session promise resolves
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Transcriptions
            if (message.serverContent?.outputTranscription) {
              setCurrentTranscription(prev => prev + message.serverContent?.outputTranscription?.text);
            }
            if (message.serverContent?.turnComplete) {
               setTranscript(prev => [...prev, currentTranscription].filter(Boolean));
               setCurrentTranscription('');
            }

            // Handle Audio
            const audioBase64 = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioBase64) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
              const audioBuffer = await decodeAudioData(decode(audioBase64), outputAudioContext, 24000, 1);
              const source = outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputAudioContext.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error("Live Session Error:", e);
            setIsActive(false);
            setIsConnecting(false);
          },
          onclose: () => {
            setIsActive(false);
            setIsConnecting(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          systemInstruction: "You are Sparky, a friendly and magical golden retriever AI friend for kids. You love talking about space, dinosaurs, and ice cream. Be encouraging, use simple words, and keep the conversation fun! Keep your answers short (1-2 sentences).",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err) {
      console.error(err);
      setIsConnecting(false);
    }
  };

  const stopSession = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    // Properly close the session
    sessionPromiseRef.current?.then(s => s.close());
    sessionPromiseRef.current = null;
    setIsActive(false);
  };

  useEffect(() => {
    return () => stopSession();
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center space-y-8 max-w-2xl mx-auto text-center px-4">
      <div className={`
        relative w-56 h-56 md:w-64 md:h-64 rounded-full flex items-center justify-center text-8xl md:text-9xl
        bg-white shadow-2xl border-8 border-yellow-200 transition-all duration-500
        ${isActive ? 'scale-110 border-green-300 ring-8 ring-green-100 shadow-green-200' : 'hover:scale-105'}
      `}>
        <div className={isActive ? 'animate-bounce' : 'floating'}>🐶</div>
        {isActive && (
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest animate-pulse shadow-lg">
            Sparky is listening!
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-4xl md:text-5xl font-kids text-blue-500 drop-shadow-sm">Sparky is your Buddy!</h2>
        <p className="text-gray-600 font-bold px-4 text-lg">
          {isActive 
            ? "Go ahead! Say 'Hi Sparky!' and tell him about your day!" 
            : "Sparky is taking a nap. Wake him up to start talking!"}
        </p>
      </div>

      {!isActive ? (
        <button
          onClick={startSession}
          disabled={isConnecting}
          className="px-12 py-5 bg-yellow-400 hover:bg-yellow-500 text-white font-kids text-2xl md:text-3xl rounded-[2.5rem] shadow-xl hover:shadow-yellow-100 transition-all active:scale-95 disabled:opacity-50 border-b-8 border-yellow-600 active:border-b-0"
        >
          {isConnecting ? 'Waking up...' : 'Start Talking! 🎙️'}
        </button>
      ) : (
        <button
          onClick={stopSession}
          className="px-12 py-5 bg-red-500 hover:bg-red-600 text-white font-kids text-2xl md:text-3xl rounded-[2.5rem] shadow-xl transition-all active:scale-95 border-b-8 border-red-800 active:border-b-0"
        >
          Bye Bye Sparky! 👋
        </button>
      )}

      {/* Live Transcription Visualization */}
      <div className="w-full bg-white/70 backdrop-blur rounded-[2.5rem] p-6 h-36 overflow-y-auto flex flex-col-reverse shadow-inner border-4 border-white custom-scrollbar">
        {currentTranscription && (
            <p className="text-blue-600 font-bold italic animate-pulse text-lg">Sparky: {currentTranscription}...</p>
        )}
        {transcript.slice(-3).map((text, i) => (
          <p key={i} className="text-gray-400 font-bold mb-1 opacity-60 text-base">
             {text}
          </p>
        )).reverse()}
      </div>
    </div>
  );
};

export default GeminiLiveBuddy;
