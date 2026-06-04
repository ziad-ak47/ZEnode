import { useEffect, useRef } from 'react';

export function useInfiniteScroll(callback, enabled) {
  const ref = useRef(null);
  useEffect(() => {
    if (!enabled) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) callback(); },
      { threshold: 0.1 }
    );
    const el = ref.current;
    if (el) obs.observe(el);
    return () => { if (el) obs.unobserve(el); };
  }, [callback, enabled]);
  return ref;
}
