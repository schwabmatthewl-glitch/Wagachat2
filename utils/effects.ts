
import React from 'react';

export const triggerConfetti = (e?: any) => {
  const colors = ['#3B82F6', '#EC4899', '#FACC15', '#22C55E', '#A855F7', '#FF9F1C', '#FF4D6D'];
  const count = 35;
  
  // Try to find coordinates from various event types (Mouse or Touch)
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;

  if (e) {
    if (e.clientX && e.clientY) {
      x = e.clientX;
      y = e.clientY;
    } else if (e.touches && e.touches[0]) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else if (e.target) {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
  }

  for (let i = 0; i < count; i++) {
    const div = document.createElement('div');
    div.className = 'confetti';
    
    const size = Math.random() * 10 + 6;
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 250 + 100;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;
    const rot = Math.random() * 360;
    
    div.style.width = `${size}px`;
    div.style.height = `${size}px`;
    div.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    div.style.setProperty('--tx', `${tx}px`);
    div.style.setProperty('--ty', `${ty}px`);
    div.style.setProperty('--rot', `${rot}deg`);
    
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 800);
  }
};
