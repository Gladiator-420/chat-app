import { io } from 'socket.io-client';

// 🔥 Replace with your actual Render backend URL
const URL = 'https://chat-app-7xii.onrender.com';

// Single shared socket instance for the whole app
const socket = io(URL, {
  autoConnect: false,
  transports: ['websocket'], // ensures stable connection
});

export default socket;