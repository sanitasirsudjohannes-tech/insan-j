import { useEffect, useRef, useState } from 'react';
import WasteDataChat from './WasteDataChat';

const ANIMATION_MS = 250;

export default function WasteDataChatLauncher() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef(null);
  const closeButtonRef = useRef(null);

  const showChat = () => {
    window.clearTimeout(closeTimerRef.current);
    setMounted(true);
    window.requestAnimationFrame(() => setOpen(true));
  };

  const hideChat = () => {
    setOpen(false);
    closeTimerRef.current = window.setTimeout(() => setMounted(false), ANIMATION_MS);
  };

  useEffect(() => {
    if (!mounted) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') hideChat();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mounted]);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  return (
    <>
      {!mounted && (
        <button
          type="button"
          onClick={showChat}
          aria-label="Buka Tanya Data INSAN-J"
          className="group fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-white/80 bg-linear-to-br from-blue-500 to-blue-700 text-white shadow-[0_10px_25px_rgba(37,99,235,0.38),0_4px_0_#1e40af] transition duration-200 hover:-translate-y-0.5 active:translate-y-1 active:shadow-md md:bottom-6 md:right-6"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-20 motion-reduce:hidden" />
          <i className="fas fa-comments relative text-xl transition-transform group-hover:scale-110" />
        </button>
      )}

      {mounted && (
        <div className="fixed inset-0 z-[70] print:hidden" role="dialog" aria-modal="true" aria-labelledby="waste-chat-title">
          <button
            type="button"
            aria-label="Tutup Tanya Data"
            onClick={hideChat}
            className={`absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
          />
          <section className={`absolute inset-x-3 bottom-3 flex h-[min(76vh,42rem)] origin-bottom-right flex-col overflow-hidden rounded-[1.75rem] border border-white/80 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.35)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[min(28rem,calc(100vw-3rem))] ${open ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-16 scale-75 opacity-0'}`}>
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-blue-700 text-white shadow-md"><i className="fas fa-comments" /></span>
                <div className="min-w-0">
                  <h2 id="waste-chat-title" className="truncate font-black text-slate-800">Tanya Data INSAN-J</h2>
                  <p className="text-xs text-emerald-600"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Berdasarkan data tersinkron</p>
                </div>
              </div>
              <button ref={closeButtonRef} type="button" onClick={hideChat} aria-label="Tutup chat" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 active:scale-95"><i className="fas fa-xmark" /></button>
            </div>
            <WasteDataChat hideHeader />
          </section>
        </div>
      )}
    </>
  );
}
