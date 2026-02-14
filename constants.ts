
import { Friend, ChatRoom } from './types';

// Start with an empty friends list to encourage searching
export const INITIAL_FRIENDS: Friend[] = [];

// Mock directory of other human kids to "find"
export const MOCK_DIRECTORY: Friend[] = [
  { id: '10', name: 'Alex', avatar: '🦁', status: 'online', color: 'bg-orange-400' },
  { id: '11', name: 'Chloe', avatar: '🦄', status: 'online', color: 'bg-pink-400' },
  { id: '12', name: 'Max', avatar: '🐶', status: 'offline', color: 'bg-blue-400' },
  { id: '13', name: 'Sara', avatar: '🎨', status: 'online', color: 'bg-purple-400' },
  { id: '14', name: 'Toby', avatar: '🚀', status: 'offline', color: 'bg-green-400' },
  { id: '15', name: 'Mia', avatar: '🍓', status: 'online', color: 'bg-red-400' },
  { id: '16', name: 'Ben', avatar: '🦖', status: 'online', color: 'bg-yellow-500' },
];

export const ROOMS: ChatRoom[] = [
  { id: 'main', name: 'Friend Clubhouse', type: 'text', icon: '🏠' },
  { id: 'video', name: 'VideoChat', type: 'video', icon: '📹' },
];

export const EMOJIS = [
  // Faces & Expressions
  '😀', '😍', '😎', '🥳', '🤩', '🤢', '🤔', '🤨', '😮', '😲', '😴', '🤯', '🤠', '🤫',
  // Actions & Alerts (Added SOS, Thumbs, Exclamation)
  '👍', '👎', '🆘', '❗', '‼️', '📢', '✅', '❌',
  // Hearts (Different colors and styles)
  '❤️', '🧡', '💛', '💚', '💙', '💜', '💖', '💗', '💓', '💞', '💕', '❣️', '💔',
  // People & Fantasy
  '🧚‍♀️', '🧚‍♂️', '👸', '🤴', '🦄', '🌟', '✨', '👼',
  // Food & Drink
  '🍝', '🐟', '🍦', '🍕', '🍔', '🍟', '🍩', '🍓', '🍪', '🍭',
  // Animals & Nature
  '🐶', '🐱', '🦁', '🦖', '🐰', '🐼', '🐨', '🦋', '🌈', '🎈',
  // Activities & Objects
  '🎨', '🎮', '🚀', '🧸', '🚲', '🎉', '🧩', '🎸', '⚽', '🏖️'
];
