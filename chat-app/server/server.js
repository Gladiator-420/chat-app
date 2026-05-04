const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] }
});

const rooms = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

 socket.on('join_room', ({ username, room }) => {
  socket.join(room);
  socket.data.username = username;
  socket.data.room = room;
  const count = io.sockets.adapter.rooms.get(room)?.size || 1;
  io.to(room).emit('room_count', count); // ← add this line
  socket.to(room).emit('user_joined', { username, timestamp: Date.now() });
});

  socket.on('send_message', ({ room, message }) => {
    const msg = {
      id: Date.now(),
      username: socket.data.username,
      message,
      timestamp: Date.now()
    };
    if (!rooms[room]) rooms[room] = [];
    rooms[room].push(msg);
    io.to(room).emit('receive_message', msg);
  });

  // Typing indicators
  socket.on('typing', ({ room, username }) => {
    socket.to(room).emit('user_typing', { username });
  });

  socket.on('stop_typing', ({ room, username }) => {
    socket.to(room).emit('user_stop_typing', { username });
  });

  socket.on('disconnect', () => {
    const { username, room } = socket.data;
    if (room) {
      socket.to(room).emit('user_left', { username, timestamp: Date.now() });
    }
  });
});

server.listen(3001, () => console.log('Server running on port 3001'));