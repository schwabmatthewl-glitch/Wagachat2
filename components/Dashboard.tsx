
import React from 'react';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const cards = [
    {
      title: 'Clubhouse',
      desc: 'Chat and share photos!',
      icon: '🏠',
      color: 'bg-blue-400',
      borderColor: 'border-blue-600',
      link: '/room/main',
      emoji: '🎈'
    },
    {
      title: 'Video Party',
      desc: 'See your friends live!',
      icon: '📹',
      color: 'bg-pink-400',
      borderColor: 'border-pink-600',
      link: '/video',
      emoji: '🎉'
    }
  ];

  return (
    <div className="h-full flex flex-col items-center justify-start py-8 md:justify-center p-4 overflow-y-auto custom-scrollbar">
      <div className="text-center mb-12">
        <h2 className="text-5xl font-kids text-blue-500 mb-4 drop-shadow-sm">Where to next?</h2>
        <p className="text-xl font-bold text-gray-500">Pick an adventure!</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {cards.map((card, idx) => (
          <Link 
            key={idx} 
            to={card.link}
            className={`group relative ${card.color} ${card.borderColor} border-b-8 rounded-[3rem] p-8 text-white shadow-2xl transition-all hover:scale-105 hover:-translate-y-2 active:scale-95 flex flex-col items-center text-center`}
          >
            <div className="text-8xl mb-6 transform group-hover:rotate-12 transition-transform duration-300">
              {card.icon}
            </div>
            <h3 className="text-3xl font-kids mb-2 tracking-wide">{card.title}</h3>
            <p className="font-bold opacity-90">{card.desc}</p>
            
            <div className="absolute -top-4 -right-4 text-4xl floating" style={{ animationDelay: `${idx * 0.5}s` }}>
              {card.emoji}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
