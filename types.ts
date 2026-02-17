export interface Message {
  id: string;
  senderId: string;
  sender: 'user' | 'friend';
  text: string;
  timestamp: Date;
  senderName: string;
  senderColor: string;
  avatar: string;
  imageUrl?: string;
  photoUrl?: string;
  fontFamily?: string;
  fontSize?: 's' | 'm' | 'l';
  textColor?: string;
}

export interface Friend {
  id: string;
  name: string;
  avatar: string;
  photoUrl?: string;
  status: 'online' | 'offline';
  color: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  type: 'text' | 'video';
  icon: string;
}