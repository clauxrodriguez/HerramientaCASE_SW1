import { io, Socket } from 'socket.io-client';
import { useUMLStore } from '../stores/useUMLStore';
import { useAuthStore } from '../stores/useAuthStore';
import { UserPresence } from '../types/uml';

let socket: Socket | null = null;
let currentDiagramId: string | null = null;

export const getOrInitGuestUser = () => {
  const authState = useAuthStore.getState();
  if (authState.isAuthenticated && authState.user && authState.user.id) {
    return {
      userId: authState.user.id,
      userName: authState.user.username || 'Usuario',
      color: authState.user.color || `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
    };
  }

  let guestRaw = sessionStorage.getItem('uml_guest_user');
  if (guestRaw) {
    try {
      return JSON.parse(guestRaw);
    } catch (e) {}
  }
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const newGuest = {
    userId: `guest-${crypto.randomUUID().slice(0, 8)}`,
    userName: `Invitado-${randomSuffix}`,
    color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
  };
  sessionStorage.setItem('uml_guest_user', JSON.stringify(newGuest));
  return newGuest;
};

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

  const broadcastCurrentState = () => {
    const currentState = useUMLStore.getState();
    if (currentState.classes.length > 0 || currentState.relations.length > 0) {
      socket?.emit('diagram:update', {
        diagramId,
        diagramData: {
          classes: currentState.classes,
          relations: currentState.relations,
        },
      });
    }
  };

  socket.on('connect', () => {
    console.log('🔌 Conectado a Socket.io /diagram');
    useUMLStore.getState().setOnlineStatus(true);
    const user = getOrInitGuestUser();
    socket?.emit('diagram:join', { diagramId, user });
    broadcastCurrentState();
  });

  socket.on('disconnect', () => {
    console.warn('🔌 Desconectado de Socket.io');
    useUMLStore.getState().setOnlineStatus(false);
  });

  socket.on('diagram:user-joined', (user: any) => {
    console.log('👤 Usuario unido al diagrama:', user);
    const uId = user.id || user.userId;
    useUMLStore.getState().updatePresence({
      userId: uId,
      userName: user.name || user.userName || 'Usuario',
      color: user.color || '#0284C7',
      cursor: null,
    });
  });

  socket.on('diagram:request-sync', () => {
    broadcastCurrentState();
  });

  socket.on('diagram:users', (users: any[]) => {
    const presenceMap: Record<string, UserPresence> = {};
    users.forEach((u) => {
      const uId = u.id || u.userId;
      presenceMap[uId] = {
        userId: uId,
        userName: u.name || u.userName || 'Usuario',
        color: u.color || '#0284C7',
        cursor: u.cursor || null,
      };
    });
    useUMLStore.getState().setPresenceMap(presenceMap);
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
    if (diagramData?.classes || diagramData?.relations) {
      useUMLStore.getState().setDiagramDataFromRemote(diagramData);
    }
    const pId = useUMLStore.getState().projectId;
    if (pId && (diagramData?.classes || diagramData?.relations)) {
      const existingRaw = localStorage.getItem(`uml_diagram_${pId}`);
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      localStorage.setItem(
        `uml_diagram_${pId}`,
        JSON.stringify({
          id: `diag-${pId}`,
          name: existing.name || useUMLStore.getState().projectName || 'Diagrama Compartido',
          package: existing.package || useUMLStore.getState().packageName || 'com.example.uml',
          classes: diagramData.classes || useUMLStore.getState().classes,
          relations: diagramData.relations || useUMLStore.getState().relations,
        })
      );
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
