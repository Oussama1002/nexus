import { useEffect, useRef } from 'react';

const ACTIVITY_KEY = 'nexus:last_activity';
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll', 'visibilitychange'] as const;

/**
 * Logs the user out after `minutes` without any activity. The timestamp lives
 * in localStorage so activity in one tab keeps every tab alive.
 */
export function useIdleLogout(onTimeout: () => void, minutes = 10) {
  const timeoutRef = useRef(onTimeout);
  timeoutRef.current = onTimeout;

  useEffect(() => {
    const limitMs = minutes * 60_000;

    const read = (): number => {
      try {
        return Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
      } catch {
        return 0;
      }
    };
    const touch = () => {
      try {
        localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
      } catch {
        // private mode: the interval below simply never fires
      }
    };

    // Throttle: one write per 5s is enough to track activity.
    let last = 0;
    const onActivity = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - last < 5_000) return;
      last = now;
      touch();
    };

    touch();
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const timer = window.setInterval(() => {
      const stamp = read();
      if (stamp && Date.now() - stamp >= limitMs) {
        window.clearInterval(timer);
        timeoutRef.current();
      }
    }, 15_000);

    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(timer);
    };
  }, [minutes]);
}
