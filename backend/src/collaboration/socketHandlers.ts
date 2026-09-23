import { Server, Socket } from 'socket.io';

interface CollaborationUser {
  id: string; // userId (persistent)
  name: string;
  color: string;
  socketId: string; // active socket connection id
  cursor?: { x: number; y: number };
}

interface CollaborationLock {
  elementId: string;
  userId: string;
  timestamp: number;
}

interface DiagramRoom {
  users: Map<string, CollaborationUser>; // Keyed by userId
  locks: Map<string, CollaborationLock>;
  diagramData?: any;
}

const rooms = new Map<string, DiagramRoom>();

function generateColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
}

export function setupSocketHandlers(io: Server) {
  const diagramNamespace = io.of('/diagram');

  diagramNamespace.on('connection', (socket: Socket) => {
    console.log(`User socket connected: ${socket.id}`);

    socket.on('diagram:join', ({ diagramId, user: userInfo }: { diagramId: string; user?: any }) => {
      console.log(`User socket ${socket.id} joining diagram ${diagramId}`);
      
      socket.join(diagramId);
      
      if (!rooms.has(diagramId)) {
        rooms.set(diagramId, {
          users: new Map(),
          locks: new Map()
        });
      }
      
      const room = rooms.get(diagramId)!;
      
      const userId = userInfo?.userId || userInfo?.id || socket.id;
      const userName = userInfo?.userName || userInfo?.username || userInfo?.name || `Usuario ${socket.id.slice(0, 4)}`;
      const userColor = userInfo?.color || generateColor(userId);
      
      const user: CollaborationUser = {
        id: userId,
        name: userName,
        color: userColor,
        socketId: socket.id
      };
      
      room.users.set(userId, user);
      
      diagramNamespace.to(diagramId).emit('diagram:user-joined', user);
      diagramNamespace.to(diagramId).emit('diagram:users', Array.from(room.users.values()));
      diagramNamespace.to(diagramId).emit('diagram:locks', Array.from(room.locks.values()));
      
      if (room.diagramData) {
        socket.emit('diagram:update', room.diagramData);
      } else {
        socket.to(diagramId).emit('diagram:request-sync');
      }
    });

    socket.on('diagram:update', ({ diagramId, diagramData }: { diagramId: string; diagramData: any }) => {
      const room = rooms.get(diagramId);
      if (room) {
        room.diagramData = diagramData;
        socket.to(diagramId).emit('diagram:update', diagramData);
      }
    });

    socket.on('diagram:lock', ({ diagramId, elementId }: { diagramId: string; elementId: string }) => {
      const room = rooms.get(diagramId);
      if (room) {
        let lockUserId = socket.id;
        for (const [uId, u] of room.users.entries()) {
          if (u.socketId === socket.id) {
            lockUserId = uId;
            break;
          }
        }
        const lock: CollaborationLock = {
          elementId,
          userId: lockUserId,
          timestamp: Date.now()
        };
        room.locks.set(elementId, lock);
        diagramNamespace.to(diagramId).emit('diagram:lock', lock);
      }
    });

    socket.on('diagram:unlock', ({ diagramId, elementId }: { diagramId: string; elementId: string }) => {
      const room = rooms.get(diagramId);
      if (room) {
        room.locks.delete(elementId);
        diagramNamespace.to(diagramId).emit('diagram:unlock', elementId);
      }
    });

    socket.on('diagram:cursor-update', ({ diagramId, cursor }: { diagramId: string; cursor: { x: number; y: number } }) => {
      const room = rooms.get(diagramId);
      if (room) {
        for (const [userId, user] of room.users.entries()) {
          if (user.socketId === socket.id) {
            user.cursor = cursor;
            socket.to(diagramId).emit('diagram:cursor-update', { userId, cursor });
            break;
          }
        }
      }
    });

    socket.on('diagram:leave', ({ diagramId }: { diagramId: string }) => {
      console.log(`User socket ${socket.id} leaving diagram ${diagramId}`);
      
      const room = rooms.get(diagramId);
      if (room) {
        let leftUserId: string | null = null;
        for (const [uId, u] of room.users.entries()) {
          if (u.socketId === socket.id) {
            leftUserId = uId;
            room.users.delete(uId);
            break;
          }
        }
        
        if (leftUserId) {
          for (const [elementId, lock] of room.locks.entries()) {
            if (lock.userId === leftUserId || lock.userId === socket.id) {
              room.locks.delete(elementId);
            }
          }
          diagramNamespace.to(diagramId).emit('diagram:user-left', leftUserId);
          diagramNamespace.to(diagramId).emit('diagram:users', Array.from(room.users.values()));
          diagramNamespace.to(diagramId).emit('diagram:locks', Array.from(room.locks.values()));
        }
        
        if (room.users.size === 0) {
          rooms.delete(diagramId);
        }
      }
      
      socket.leave(diagramId);
    });

    socket.on('disconnect', () => {
      console.log(`User socket disconnected: ${socket.id}`);
      
      for (const [diagramId, room] of rooms.entries()) {
        for (const [userId, user] of room.users.entries()) {
          if (user.socketId === socket.id) {
            room.users.delete(userId);
            
            for (const [elementId, lock] of room.locks.entries()) {
              if (lock.userId === userId || lock.userId === socket.id) {
                room.locks.delete(elementId);
              }
            }
            
            diagramNamespace.to(diagramId).emit('diagram:user-left', userId);
            diagramNamespace.to(diagramId).emit('diagram:users', Array.from(room.users.values()));
            diagramNamespace.to(diagramId).emit('diagram:locks', Array.from(room.locks.values()));
            
            if (room.users.size === 0) {
              rooms.delete(diagramId);
            }
            break;
          }
        }
      }
    });
  });
}


