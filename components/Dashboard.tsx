
import React from 'react';
import { Link } from 'react-router-dom';

interface Props {
  onOpenSearch?: () => void;
}

const Dashboard: React.FC<Props> = ({ onOpenSearch }) => {
  const cards = [
    {
      title: 'Clubhouse',
      desc: 'Chat & Photos!',
      icon: '🏠',
      color: 'bg-blue-400',
      borderColor: 'border-blue-600',
      link: '/room/main',
      emoji: '🎈'
    },
    {
      title: 'Video Party',
      desc: 'See Friends!',
      icon: '📹',
      color: 'bg-pink-400',
      borderColor: 'border-pink-600',
      link: '/video',
      emoji: '🎉'
    },
    {
      title: 'Find Friends',
      desc: 'Search now!',
      icon: '🔍',
      color: 'bg-green-400',
      borderColor: 'border-green-600',
      action: onOpenSearch,
      emoji: '✨'
    }
  ];

  return (
    <div className="h-full flex flex-col items-center justify-start py-4 md:py-8 md:justify-center p-2 md:p-4 overflow-y-auto custom-scrollbar pb-24 md:pb-8">
      <div className="text-center mb-8 md:mb-12">
        <h2 className="text-3xl md:text-5xl font-kids text-blue-500 mb-2 md:mb-4 drop-shadow-sm">Where to next?</h2>
        <p className="text-lg md:text-xl font-bold text-gray-500">Pick an adventure!</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 w-full max-w-5xl px-2">
        {cards.map((card, idx) => {
          const Content = (
            <div className={`
              h-full flex flex-col items-center text-center p-6 md:p-8 text-white relative
              ${card.color} ${card.borderColor} border-b-8 rounded-[2.5rem] md:rounded-[3rem] shadow-xl 
              transition-all hover:scale-105 hover:-translate-y-2 active:scale-95
            `}>
              <div className="text-6xl md:text-8xl mb-4 md:mb-6 transform group-hover:rotate-12 transition-transform duration-300">
                {card.icon}
              </div>
              <h3 className="text-2xl md:text-3xl font-kids mb-1 md:mb-2 tracking-wide whitespace-nowrap">{card.title}</h3>
              <p className="font-bold opacity-90 text-sm md:text-base">{card.desc}</p>
              
              <div className="absolute -top-3 -right-3 text-3xl md:text-4xl floating" style={{ animationDelay: `${idx * 0.5}s` }}>
                {card.emoji}
              </div>
            </div>
          );

          return card.link ? (
            <Link key={idx} to={card.link} className="group">
              {Content}
            </Link>
          ) : (
            <button key={idx} onClick={card.action} className="group w-full text-left">
              {Content}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
