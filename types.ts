
export interface Message {
  id: string;
  sender: 'user' | 'friend';
  text: string;
  timestamp: Date;
  senderName: string;
  avatar: string;
  imageUrl?: string;
}

export interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline';
  color: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  type: 'text' | 'video';
  icon: string;
}
