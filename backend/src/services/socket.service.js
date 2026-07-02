import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // For development, allow all
      methods: ['GET', 'POST']
    }
  });

  // Optional: JWT Middleware for Socket.io
  /*
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error'));
      socket.user = decoded;
      next();
    });
  });
  */

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] New connection: ${socket.id}`);

    // Join specific rooms (e.g. admin room, user room)
    socket.on('join_admin', () => {
      socket.join('admin');
      console.log(`[Socket.IO] ${socket.id} joined admin room`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

// Helper methods to emit events from controllers
export const emitToAdmin = (event, data) => {
  if (io) {
    io.to('admin').emit(event, data);
  }
};

export const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};
