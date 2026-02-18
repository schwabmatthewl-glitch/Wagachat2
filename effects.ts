import React from 'react';

// Import React to fix "Cannot find namespace 'React'" error for MouseEvent type
export const triggerConfetti = (e?: React.MouseEvent | MouseEvent) => {
  const colors = ['#3B82F6', '#EC4899', '#FACC15', '#22C55E', '#A855F7'];
  const count = 20;
  
  const x = e ? e.clientX : window.innerWidth / 2;
  const y = e ? e.clientY : window.innerHeight / 2;

  for (let i = 0; i < count; i++) {
    const div = document.createElement('div');
    div.className = 'confetti';
    const size = Math.random() * 10 + 10;
    const tx = (Math.random() - 0.5) * 300;
    const ty = (Math.random() - 0.5) * 300;
    
    div.style.width = `${size}px`;
    div.style.height = `${size}px`;
    div.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    div.style.setProperty('--tx', `${tx}px`);
    div.style.setProperty('--ty', `${ty}px`);
    
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1000);
  }
};