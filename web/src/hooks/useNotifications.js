import { useEffect, useRef, useCallback } from 'react';

export function useNotifications() {
  const permissionRef = useRef(Notification.permission);

  useEffect(() => {
    if (permissionRef.current === 'default') {
      Notification.requestPermission().then(p => { permissionRef.current = p; });
    }
  }, []);

  const notify = useCallback((title, options = {}) => {
    if (permissionRef.current !== 'granted') return;
    if (document.hasFocus()) return; // Don't notify if tab is active

    const n = new Notification(`ZEnode — ${title}`, {
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      silent: false,
      ...options,
    });

    n.onclick = () => {
      window.focus();
      n.close();
      options.onClick?.();
    };

    setTimeout(() => n.close(), 6000);
  }, []);

  return { notify };
}
