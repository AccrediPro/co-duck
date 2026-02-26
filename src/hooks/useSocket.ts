'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { initSocket, disconnectSocket, getSocket } from '@/lib/socket';

export function useSocket() {
  const { getToken } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let mounted = true;

    async function connect() {
      try {
        const token = await getToken();
        if (!token || !mounted) return;

        const s = initSocket(token);

        const onConnect = () => {
          if (mounted) setIsConnected(true);
        };
        const onDisconnect = () => {
          if (mounted) setIsConnected(false);
        };

        s.on('connect', onConnect);
        s.on('disconnect', onDisconnect);

        if (s.connected) {
          setIsConnected(true);
        }
      } catch (err) {
        console.error('[useSocket] Failed to initialize:', err);
      }
    }

    connect();

    return () => {
      mounted = false;
      disconnectSocket();
      initializedRef.current = false;
    };
  }, [getToken]);

  return { socket: getSocket(), isConnected };
}
