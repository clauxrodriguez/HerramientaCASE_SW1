import { io, Socket } from 'socket.io-client';
import { useUMLStore } from '../stores/useUMLStore';

let socket: Socket | null = null;
let currentDiagramId: string | null = null;

export const initSocket = (diagramId: string, token: string) => {
  if (socket && socket.connected && currentDiagramId === diagramId) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  currentDiagramId = diagramId;
  const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

  socket = io(`${wsUrl}/diagram`, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('🔌 Conectado a Socket.io /diagram');
    useUMLStore.getState().setOnlineStatus(true);
    socket?.emit('diagram:join', { diagramId });
  });

  socket.on('disconnect', () => {
    console.warn('🔌 Desconectado de Socket.io');
    useUMLStore.getState().setOnlineStatus(false);
  });

  socket.on('diagram:user-joined', (user: any) => {
    console.log('👤 Usuario unido al diagrama:', user);
    useUMLStore.getState().updatePresence({
      userId: user.id,
      userName: user.name,
      color: user.color,
      cursor: null,
    });
  });

  socket.on('diagram:users', (users: any[]) => {
    users.forEach((u) => {
      useUMLStore.getState().updatePresence({
        userId: u.id,
        userName: u.name,
        color: u.color,
        cursor: u.cursor || null,
      });
    });
  });

  socket.on('diagram:user-left', (userId: string) => {
    useUMLStore.getState().removePresence(userId);
  });

  socket.on('diagram:cursor-update', ({ userId, cursor }: { userId: string; cursor: { x: number; y: number } }) => {
    const existing = useUMLStore.getState().presence[userId];
    if (existing) {
      useUMLStore.getState().updatePresence({
        ...existing,
        cursor,
      });
    }
  });

  socket.on('diagram:update', (diagramData: any) => {
    if (diagramData?.classes) {
      useUMLStore.getState().setClasses(diagramData.classes);
    }
    if (diagramData?.relations) {
      useUMLStore.getState().setRelations(diagramData.relations);
    }
  });

  return socket;
};

export const emitCursorMove = (diagramId: string, x: number, y: number) => {
  if (socket && socket.connected) {
    socket.emit('diagram:cursor-update', { diagramId, cursor: { x, y } });
  }
};

export const emitDiagramUpdate = (diagramId: string, diagramData: any) => {
  if (socket && socket.connected) {
    socket.emit('diagram:update', { diagramId, diagramData });
  }
};

export const disconnectSocket = (diagramId: string) => {
  if (socket) {
    socket.emit('diagram:leave', { diagramId });
    socket.disconnect();
    socket = null;
    currentDiagramId = null;
  }
};
