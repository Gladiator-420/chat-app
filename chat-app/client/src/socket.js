import { io } from 'socket.io-client';

// Single shared socket instance for the whole app
const socket = io('http://localhost:3001', { autoConnect: false });

export default socket;