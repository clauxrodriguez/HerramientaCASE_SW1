import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
}

interface CollaborationLock {
  elementId: string;
  userId: string;
  timestamp: number;
}

interface DiagramRoom {
  users: Map<string, CollaborationUser>;
  locks: Map<string, CollaborationLock>;
  diagramData?: any;
}

const rooms = new Map<string, DiagramRoom>();

export function setupSocketHandlers(io: Server) {
  const diagramNamespace = io.of('/diagram');

  diagramNamespace.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('diagram:join', ({ diagramId }: { diagramId: string }) => {
      console.log(`User ${socket.id} joining diagram ${diagramId}`);
      
      // Join the room
      socket.join(diagramId);
      
      // Initialize room if it doesn't exist
      if (!rooms.has(diagramId)) {
        rooms.set(diagramId, {
          users: new Map(),
          locks: new Map()
        });
      }
      
      const room = rooms.get(diagramId)!;
      
      // Create user
      const user: CollaborationUser = {
        id: socket.id,
        name: `User ${socket.id.slice(0, 6)}`,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`
      };
      
      room.users.set(socket.id, user);
      
      // Notify all users in the room
      diagramNamespace.to(diagramId).emit('diagram:user-joined', user);
      diagramNamespace.to(diagramId).emit('diagram:users', Array.from(room.users.values()));
      diagramNamespace.to(diagramId).emit('diagram:locks', Array.from(room.locks.values()));
      
      // Send current diagram data to the new user
      if (room.diagramData) {
        socket.emit('diagram:update', room.diagramData);
      }
    });

    socket.on('diagram:update', ({ diagramId, diagramData }: { diagramId: string; diagramData: any }) => {
      const room = rooms.get(diagramId);
      if (room) {
        room.diagramData = diagramData;
        // Broadcast to all users except sender
        socket.to(diagramId).emit('diagram:update', diagramData);
      }
    });

    socket.on('diagram:lock', ({ diagramId, elementId }: { diagramId: string; elementId: string }) => {
      const room = rooms.get(diagramId);
      if (room) {
        const lock: CollaborationLock = {
          elementId,
          userId: socket.id,
          timestamp: Date.now()
        };
        
        room.locks.set(elementId, lock);
        
        // Broadcast lock to all users
        diagramNamespace.to(diagramId).emit('diagram:lock', lock);
      }
    });

    socket.on('diagram:unlock', ({ diagramId, elementId }: { diagramId: string; elementId: string }) => {
      const room = rooms.get(diagramId);
      if (room) {
        room.locks.delete(elementId);
        
        // Broadcast unlock to all users
        diagramNamespace.to(diagramId).emit('diagram:unlock', elementId);
      }
    });

    socket.on('diagram:cursor-update', ({ diagramId, cursor }: { diagramId: string; cursor: { x: number; y: number } }) => {
      const room = rooms.get(diagramId);
      if (room) {
        const user = room.users.get(socket.id);
        if (user) {
          user.cursor = cursor;
          // Broadcast cursor update to all users except sender
          socket.to(diagramId).emit('diagram:cursor-update', { userId: socket.id, cursor });
        }
      }
    });

    socket.on('diagram:leave', ({ diagramId }: { diagramId: string }) => {
      console.log(`User ${socket.id} leaving diagram ${diagramId}`);
      
      const room = rooms.get(diagramId);
      if (room) {
        // Remove user
        room.users.delete(socket.id);
        
        // Remove user's locks
        for (const [elementId, lock] of room.locks.entries()) {
          if (lock.userId === socket.id) {
            room.locks.delete(elementId);
          }
        }
        
        // Notify remaining users
        diagramNamespace.to(diagramId).emit('diagram:user-left', socket.id);
        diagramNamespace.to(diagramId).emit('diagram:users', Array.from(room.users.values()));
        diagramNamespace.to(diagramId).emit('diagram:locks', Array.from(room.locks.values()));
        
        // Clean up empty room
        if (room.users.size === 0) {
          rooms.delete(diagramId);
        }
      }
      
      socket.leave(diagramId);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      
      // Remove user from all rooms
      for (const [diagramId, room] of rooms.entries()) {
        if (room.users.has(socket.id)) {
          room.users.delete(socket.id);
          
          // Remove user's locks
          for (const [elementId, lock] of room.locks.entries()) {
            if (lock.userId === socket.id) {
              room.locks.delete(elementId);
            }
          }
          
          // Notify remaining users
          diagramNamespace.to(diagramId).emit('diagram:user-left', socket.id);
          diagramNamespace.to(diagramId).emit('diagram:users', Array.from(room.users.values()));
          diagramNamespace.to(diagramId).emit('diagram:locks', Array.from(room.locks.values()));
          
          // Clean up empty room
          if (room.users.size === 0) {
            rooms.delete(diagramId);
          }
        }
      }
    });
  });
}

