import { useEffect, useRef } from 'react';
import styles from './WelcomeWave.module.css';

// Decorative enhancement: dashboard content never waits for WebGL or its download.
export default function WelcomeWave() {
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
        const { createWelcomeWave } = await import('./createWelcomeWave');
        if (!cancelled && request === generation && !motion.matches) dispose = createWelcomeWave(host);
      } catch {
        // Keep the static CSS waves when WebGL or the optional chunk is unavailable.
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

  return <div ref={hostRef} aria-hidden="true" className={styles.accent} />;
}
