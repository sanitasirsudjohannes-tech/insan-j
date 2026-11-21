import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WasteDataChat from './WasteDataChat';

const ANIMATION_MS = 650;

export default function WasteDataChatLauncher() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const duration = reducedMotion ? 0 : ANIMATION_MS;
  const [panelOrigin, setPanelOrigin] = useState('100% 100%');
  const [collapsedClip, setCollapsedClip] = useState('polygon(98% 98%, 100% 98%, 100% 100%, 98% 100%)');
  const closeTimerRef = useRef(null);
  const animationTimerRef = useRef(null);
  const firstFrameRef = useRef(null);
  const secondFrameRef = useRef(null);
  const pendingOpenRef = useRef(false);
  const launcherButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const panelRef = useRef(null);
  const openRef = useRef(false);
  const mountedRef = useRef(false);
  const historyEntryRef = useRef(false);
  const historyBackPendingRef = useRef(false);
  const pendingNavigationRef = useRef(null);

  const finishClose = useCallback(() => {
    setAnimating(false);
    // Keep the chat alive so an in-flight answer can render and persist.
    const focused = document.activeElement;
    const focusStillBelongsToChat = !focused || focused === document.body || panelRef.current?.contains(focused);
    if (!openRef.current && focusStillBelongsToChat) launcherButtonRef.current?.focus({ preventScroll: true });
  }, []);

  const calculateAnchor = useCallback(() => {
    if (!launcherButtonRef.current || !panelRef.current) return;
    const launcher = launcherButtonRef.current;
    const panel = panelRef.current;
    const originX = launcher.offsetLeft + launcher.offsetWidth / 2 - panel.offsetLeft;
    const originY = launcher.offsetTop + launcher.offsetHeight / 2 - panel.offsetTop;
    setPanelOrigin(`${originX}px ${originY}px`);
    setCollapsedClip(`polygon(${originX - 5}px ${originY - 3}px, ${originX + 5}px ${originY - 3}px, ${originX + 3}px ${originY + 3}px, ${originX - 3}px ${originY + 3}px)`);
  }, []);

  const scheduleOpening = useCallback(() => {
    window.cancelAnimationFrame(firstFrameRef.current);
    window.cancelAnimationFrame(secondFrameRef.current);
    firstFrameRef.current = window.requestAnimationFrame(() => {
      secondFrameRef.current = window.requestAnimationFrame(() => {
        calculateAnchor();
        setAnimating(true);
        openRef.current = true;
        setOpen(true);
        window.clearTimeout(animationTimerRef.current);
        animationTimerRef.current = window.setTimeout(() => setAnimating(false), duration);
      });
    });
  }, [calculateAnchor, duration]);

  const handleBusyChange = useCallback(value => {
    setChatBusy(value);
  }, []);

  const showChat = useCallback(() => {
    if (historyBackPendingRef.current) return;
    window.clearTimeout(closeTimerRef.current);
    window.clearTimeout(animationTimerRef.current);
    if (!historyEntryRef.current) {
      window.history.pushState({ ...window.history.state, wasteChatOpen: true }, '');
      historyEntryRef.current = true;
    }
    if (mountedRef.current && panelRef.current) {
      scheduleOpening();
      return;
    }
    pendingOpenRef.current = true;
    mountedRef.current = true;
    setMounted(true);
  }, [scheduleOpening]);

  const startClosing = useCallback(() => {
    if (!mountedRef.current) return;
    pendingOpenRef.current = false;
    window.cancelAnimationFrame(firstFrameRef.current);
    window.cancelAnimationFrame(secondFrameRef.current);
    calculateAnchor();
    setAnimating(true);
    openRef.current = false;
    setOpen(false);
    window.clearTimeout(closeTimerRef.current);
    window.clearTimeout(animationTimerRef.current);
    animationTimerRef.current = window.setTimeout(() => setAnimating(false), duration);
    closeTimerRef.current = window.setTimeout(finishClose, duration);
  }, [calculateAnchor, duration, finishClose]);

  const hideChat = useCallback(() => {
    startClosing();
    if (historyEntryRef.current) {
      historyEntryRef.current = false;
      historyBackPendingRef.current = true;
      window.history.back();
    }
  }, [startClosing]);

  const navigateFromChat = useCallback(to => {
    if (!to) return;
    startClosing();
    if (historyEntryRef.current) {
      pendingNavigationRef.current = to;
      historyEntryRef.current = false;
      historyBackPendingRef.current = true;
      window.history.back();
      return;
    }
    navigate(to);
  }, [navigate, startClosing]);

  useLayoutEffect(() => {
    if (!mounted) return;
    calculateAnchor();
    if (pendingOpenRef.current) {
      pendingOpenRef.current = false;
      scheduleOpening();
    }
  }, [calculateAnchor, mounted, scheduleOpening]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const handleViewportChange = () => calculateAnchor();
    const handlePopState = () => {
      historyBackPendingRef.current = false;
      if (historyEntryRef.current) {
        historyEntryRef.current = false;
        startClosing();
      }
      const destination = pendingNavigationRef.current;
      pendingNavigationRef.current = null;
      if (destination) navigate(destination);
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('resize', handleViewportChange);
    viewport?.addEventListener('resize', handleViewportChange);
    viewport?.addEventListener('scroll', handleViewportChange);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('resize', handleViewportChange);
      viewport?.removeEventListener('resize', handleViewportChange);
      viewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, [calculateAnchor, navigate, startClosing]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') hideChat();
      if (event.key === 'Tab') {
        const elements = [...(panelRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), summary, [tabindex="0"]') || [])].filter(element => element.getClientRects().length);
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [hideChat, open]);

  useEffect(() => () => {
    window.cancelAnimationFrame(firstFrameRef.current);
    window.cancelAnimationFrame(secondFrameRef.current);
    window.clearTimeout(animationTimerRef.current);
    window.clearTimeout(closeTimerRef.current);
  }, []);

  return (
    <>
      <button
          ref={launcherButtonRef}
          type="button"
          onClick={showChat}
          aria-label="Buka Tanya INSAN-J"
          aria-hidden={open}
          tabIndex={open ? -1 : 0}
          style={{
            opacity: open ? 0 : 1,
            transform: open ? 'translateY(0.5rem) scale(0.85)' : 'translateY(0) scale(1)',
            transition: `transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${duration}ms ease-in-out`,
          }}
          className={`group fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-30 isolate flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/90 bg-linear-to-br from-white/80 via-blue-100/55 to-cyan-200/40 text-blue-700 shadow-[0_12px_32px_rgba(30,64,175,0.24),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(59,130,246,0.16)] backdrop-blur-xl backdrop-saturate-150 hover:-translate-y-1 hover:scale-105 hover:border-white hover:shadow-[0_16px_38px_rgba(30,64,175,0.3),inset_0_1px_0_white] active:translate-y-0 active:scale-95 md:bottom-6 md:right-6 ${open ? 'pointer-events-none' : ''}`}
        >
          <span className="absolute -left-2 -top-3 h-9 w-9 rounded-full bg-white/90 blur-md" />
          <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-cyan-400/35 blur-sm" />
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-blue-600/85 text-white shadow-[0_5px_14px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-md transition-transform duration-300 group-hover:rotate-[-4deg] group-hover:scale-105">
            <i className="fas fa-comments text-lg drop-shadow-sm" />
          </span>
        </button>

      {mounted && (
        <div inert={open ? undefined : ''} className={`fixed inset-0 z-[70] print:hidden ${open ? '' : 'pointer-events-none'}`} role="dialog" aria-modal="true" aria-hidden={!open} aria-labelledby="waste-chat-title">
          <button
            type="button"
            aria-label="Tutup Tanya INSAN-J"
            onClick={hideChat}
            style={{ opacity: open ? 1 : 0, transition: `opacity ${duration}ms ease-in-out` }}
            className="absolute inset-0 bg-slate-950/45"
          />
          <section
            ref={panelRef}
            aria-busy={chatBusy}
            style={{
              transformOrigin: panelOrigin,
              transform: open ? 'scale(1, 1)' : 'scale(0.92, 0.68)',
              opacity: open ? 1 : 0,
              clipPath: open ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' : collapsedClip,
              borderRadius: open ? '1.75rem' : '2.5rem',
              transition: [
                `transform ${duration}ms cubic-bezier(0.22, 0.8, 0.2, 1)`,
                `clip-path ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                `border-radius ${duration}ms ease-in-out`,
                `opacity ${duration}ms ease-in-out`,
              ].join(', '),
              willChange: animating ? 'transform, opacity, clip-path' : 'auto',
            }}
            className="absolute inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] flex h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:h-[min(85dvh,46rem)] flex-col overflow-hidden rounded-[1.75rem] border border-white/80 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.35)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[min(36rem,calc(100vw-3rem))]"
          >
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-blue-700 text-white shadow-md"><i className="fas fa-comments" /></span>
                <div className="min-w-0">
                  <h2 id="waste-chat-title" className="truncate font-black text-slate-800">Tanya INSAN-J</h2>
                  <p className="text-xs text-emerald-600"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Asisten pencarian data</p>
                </div>
              </div>
              <button ref={closeButtonRef} type="button" onClick={hideChat} aria-label="Tutup chat" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 active:scale-95"><i className="fas fa-xmark" /></button>
            </div>
            <WasteDataChat hideHeader onBusyChange={handleBusyChange} onNavigateRequest={navigateFromChat} />
          </section>
        </div>
      )}
    </>
  );
}
