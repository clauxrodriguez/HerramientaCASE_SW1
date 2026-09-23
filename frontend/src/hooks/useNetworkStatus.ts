import { useEffect } from 'react';
import { useUMLStore } from '../stores/useUMLStore';

export const useNetworkStatus = () => {
  const setOnlineStatus = useUMLStore((s) => s.setOnlineStatus);
  const syncQueue = useUMLStore((s) => s.syncQueue);
  const clearSyncQueue = useUMLStore((s) => s.clearSyncQueue);

  useEffect(() => {
    const handleOnline = () => {
      setOnlineStatus(true);
      console.log('🌐 Conexión reestablecida. Sincronizando acciones locales...');
      if (syncQueue.length > 0) {
        // Enviar acciones acumuladas al backend
        clearSyncQueue();
      }
    };

    const handleOffline = () => {
      setOnlineStatus(false);
      console.warn('⚠️ Se perdió la conexión. Cambiando a Modo Desconectado.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnlineStatus, syncQueue, clearSyncQueue]);
};
