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
    let idleHandle = null;

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

    // Beri kesempatan request login memakai bandwidth lebih dulu. Animasi ini
    // hanya dekorasi, jadi tidak perlu bersaing dengan autentikasi.
    function scheduleStart() {
      if (idleHandle !== null) return;
      if (typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(() => {
          idleHandle = null;
          start();
        }, { timeout: 2500 });
      } else {
        idleHandle = window.setTimeout(() => {
          idleHandle = null;
          start();
        }, 1200);
      }
    }

    function cancelScheduledStart() {
      if (idleHandle === null) return;
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
      idleHandle = null;
    }

    function onMotionChange() {
      cancelScheduledStart();
      dispose();
      dispose = () => {};
      if (!motion.matches) scheduleStart();
    }

    scheduleStart();
    motion.addEventListener('change', onMotionChange);
    return () => {
      cancelled = true;
      generation++;
      cancelScheduledStart();
      motion.removeEventListener('change', onMotionChange);
      dispose();
    };
  }, []);

  return <div ref={hostRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" />;
}
