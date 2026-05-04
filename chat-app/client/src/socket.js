import { io } from 'socket.io-client';

const URL = 'https://chat-app-7xii.onrender.com';

const socket = io(URL, {
  autoConnect: false,
  transports: ['polling', 'websocket'], // IMPORTANT FIX
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

export default socket;