const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

// ✅ Socket.IO with open CORS (for deployment)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// In-memory room storage
const rooms = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('join_room', ({ username, room }) => {
    socket.join(room);
    socket.data.username = username;
    socket.data.room = room;

    const count = io.sockets.adapter.rooms.get(room)?.size || 1;
    io.to(room).emit('room_count', count);

    socket.to(room).emit('user_joined', {
      username,
      timestamp: Date.now()
    });
  });

  // Send message
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

  // Typing indicator
  socket.on('typing', ({ room, username }) => {
    socket.to(room).emit('user_typing', { username });
  });

  socket.on('stop_typing', ({ room, username }) => {
    socket.to(room).emit('user_stop_typing', { username });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const { username, room } = socket.data;

    if (room) {
      socket.to(room).emit('user_left', {
        username,
        timestamp: Date.now()
      });

      const count = io.sockets.adapter.rooms.get(room)?.size || 0;
      io.to(room).emit('room_count', count);
    }

    console.log('User disconnected:', socket.id);
  });
});

// ✅ Health check route (important for deployment)
app.get('/', (req, res) => {
  res.send('Server is running 🚀');
});

// ✅ Dynamic PORT (required for Render)
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});