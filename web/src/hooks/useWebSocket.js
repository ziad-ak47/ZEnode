import { useEffect, useRef, useCallback } from 'react';
import { tokens } from '../api/index.js';

const WS_BASE = 'ws://localhost:3000';

export function useWebSocket(userId, onMessage) {
  const wsRef      = useRef(null);
  const reconnRef  = useRef(null);
  const mountedRef = useRef(true);
  const onMsgRef   = useRef(onMessage);
  onMsgRef.current = onMessage;

  const connect = useCallback(() => {
    if (!userId || !mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(tokens.access || '')}`);
    wsRef.current = ws;

    ws.onopen = () => {
      clearTimeout(reconnRef.current);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMsgRef.current?.(data);
      } catch {}
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      reconnRef.current = setTimeout(connect, 2500);
    };

    ws.onerror = () => ws.close();
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}
