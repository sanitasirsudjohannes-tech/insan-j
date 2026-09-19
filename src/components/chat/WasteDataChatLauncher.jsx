import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import WasteDataChat from './WasteDataChat';

const ANIMATION_MS = 600;

export default function WasteDataChatLauncher() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [panelOrigin, setPanelOrigin] = useState('100% 100%');
  const closeTimerRef = useRef(null);
  const openTimerRef = useRef(null);
  const launcherButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const panelRef = useRef(null);
  const busyRef = useRef(false);
  const openRef = useRef(false);
  const mountedRef = useRef(false);
  const historyEntryRef = useRef(false);
  const closeAnimationDoneRef = useRef(false);

  const finishClose = useCallback(() => {
    if (busyRef.current) {
      closeAnimationDoneRef.current = true;
      return;
    }
    mountedRef.current = false;
    setMounted(false);
    window.requestAnimationFrame(() => launcherButtonRef.current?.focus());
  }, []);

  const handleBusyChange = useCallback(value => {
    busyRef.current = value;
    setChatBusy(value);
    if (!value && !openRef.current && closeAnimationDoneRef.current) finishClose();
  }, [finishClose]);

  const showChat = useCallback(() => {
    window.clearTimeout(closeTimerRef.current);
    window.clearTimeout(openTimerRef.current);
    closeAnimationDoneRef.current = false;
    mountedRef.current = true;
    setMounted(true);
    if (!historyEntryRef.current) {
      window.history.pushState({ ...window.history.state, wasteChatOpen: true }, '');
      historyEntryRef.current = true;
    }
    openTimerRef.current = window.setTimeout(() => {
      openRef.current = true;
      setOpen(true);
    }, 50);
  }, []);

  const startClosing = useCallback(() => {
    if (!mountedRef.current) return;
    window.clearTimeout(openTimerRef.current);
    openRef.current = false;
    setOpen(false);
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(finishClose, ANIMATION_MS);
  }, [finishClose]);

  const hideChat = useCallback(() => {
    startClosing();
    if (historyEntryRef.current) {
      historyEntryRef.current = false;
      window.history.back();
    }
  }, [startClosing]);

  useLayoutEffect(() => {
    if (!mounted || !launcherButtonRef.current || !panelRef.current) return;
    const launcherRect = launcherButtonRef.current.getBoundingClientRect();
    const panel = panelRef.current;
    const originX = launcherRect.left + launcherRect.width / 2 - panel.offsetLeft;
    const originY = launcherRect.top + launcherRect.height / 2 - panel.offsetTop;
    setPanelOrigin(`${originX}px ${originY}px`);
  }, [mounted]);

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
    const handlePopState = () => {
      if (!mountedRef.current) return;
      historyEntryRef.current = false;
      startClosing();
    };
    window.addEventListener('popstate', handlePopState);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hideChat, open, startClosing]);

  useEffect(() => () => {
    window.clearTimeout(openTimerRef.current);
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
            transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease-out',
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
            style={{ opacity: open ? 1 : 0, transition: 'opacity 450ms ease-out' }}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />
          <section
            ref={panelRef}
            aria-busy={chatBusy}
            style={{
              transformOrigin: panelOrigin,
              transform: open ? 'scale(1)' : 'scale(0.06)',
              opacity: open ? 1 : 0,
              transition: 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1), opacity 350ms ease-out',
              willChange: 'transform, opacity',
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
            <WasteDataChat hideHeader onBusyChange={handleBusyChange} />
          </section>
        </div>
      )}
    </>
  );
}
