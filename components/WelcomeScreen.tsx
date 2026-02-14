
import React, { useState } from 'react';

interface Props {
  onStart: (name: string) => void;
}

const WelcomeScreen: React.FC<Props> = ({ onStart }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onStart(name);
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-yellow-100 via-pink-100 to-blue-100 p-4">
      <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl max-w-md w-full text-center border-8 border-yellow-300 transform transition-transform hover:scale-[1.01]">
        <h1 className="text-5xl font-kids text-blue-500 mb-6 drop-shadow-sm">Wagachat!</h1>
        <div className="text-6xl mb-8 floating">🌈</div>
        <p className="text-gray-600 font-bold mb-8 text-xl">What's your name, explorer?</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type your name here..."
            className="w-full text-center p-4 text-2xl font-bold border-4 border-dashed border-blue-200 rounded-2xl focus:border-blue-500 outline-none transition-all text-blue-600 placeholder-blue-200"
            maxLength={12}
            autoFocus
          />
          
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full bg-pink-500 hover:bg-pink-600 text-white font-kids text-2xl py-4 rounded-3xl shadow-lg transform active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Let's Go! 🚀
          </button>
        </form>
      </div>
    </div>
  );
};

export default WelcomeScreen;
