import { useEffect, useRef } from 'react';

// Decorative enhancement: authentication never waits for WebGL or its download.
export default function LoginBackdrop() {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cancelled = false;
    let generation = 0;
    let dispose = () => {};

    async function start() {
      const request = ++generation;
      if (motion.matches || navigator.connection?.saveData) return;
      try {
        const { createLoginScene } = await import('./createLoginScene');
        if (!cancelled && request === generation && !motion.matches) dispose = createLoginScene(host);
      } catch {
        // Keep the CSS gradient when WebGL or the optional chunk is unavailable.
      }
    }
    function onMotionChange() {
      dispose();
      dispose = () => {};
      if (!motion.matches) start();
    }
    start();
    motion.addEventListener('change', onMotionChange);
    return () => {
      cancelled = true;
      generation++;
      motion.removeEventListener('change', onMotionChange);
      dispose();
    };
  }, []);

  return <div ref={hostRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" />;
}
