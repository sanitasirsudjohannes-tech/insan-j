import { useId, useLayoutEffect, useRef, useState } from 'react';

const TABS = [
  { id: 'pengangkutan', label: 'Sisa Limbah & Pengangkutan', icon: 'fa-truck-loading' },
  { id: 'jenis_limbah', label: 'Jenis & Tren Tahunan', icon: 'fa-layer-group' },
  { id: 'anorganik', label: 'Limbah Anorganik', icon: 'fa-recycle' },
];

export default function DashboardTabs({ activeTab, onChange, children }) {
  const id = useId();
  const listRef = useRef(null);
  const buttons = useRef({});
  const panelRef = useRef(null);
  const previousTab = useRef(activeTab);
  const [indicator, setIndicator] = useState(null);

  useLayoutEffect(() => {
    const measure = () => {
      const button = buttons.current[activeTab];
      if (!button) return;
      const next = { left: button.offsetLeft, top: button.offsetTop, width: button.offsetWidth, height: button.offsetHeight };
      setIndicator(current => current && Object.keys(next).every(key => current[key] === next[key]) ? current : next);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (listRef.current) observer?.observe(listRef.current);
    Object.values(buttons.current).forEach(button => { if (button) observer?.observe(button); });
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [activeTab]);

  useLayoutEffect(() => {
    const changed = previousTab.current !== activeTab;
    previousTab.current = activeTab;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!changed || preference.matches || !panelRef.current?.animate) return undefined;
    const animation = panelRef.current.animate(
      [{ opacity: 0.65 }, { opacity: 1 }],
      { duration: 220, easing: 'ease-out' }
    );
    const stopIfReduced = () => { if (preference.matches) animation.cancel(); };
    preference.addEventListener?.('change', stopIfReduced);
    return () => {
      animation.cancel();
      preference.removeEventListener?.('change', stopIfReduced);
    };
  }, [activeTab]);

  const handleKeyDown = (event, index) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    onChange(TABS[next].id);
    buttons.current[TABS[next].id]?.focus();
  };

  return <>
    <div ref={listRef} role="tablist" aria-label="Ringkasan dashboard"
      className="relative isolate mb-8 inline-flex max-w-full flex-wrap gap-2 rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
      {indicator && <span aria-hidden="true"
        className={`pointer-events-none absolute left-0 top-0 rounded-lg shadow-md transition-[transform,width,height,background-color] duration-300 ease-out motion-reduce:transition-none ${activeTab === 'anorganik' ? 'bg-cyan-600' : 'bg-blue-600'}`}
        style={{ width: indicator.width, height: indicator.height, transform: `translate(${indicator.left}px, ${indicator.top}px)` }} />}
      {TABS.map((tab, index) => <button key={tab.id} type="button"
        ref={element => { buttons.current[tab.id] = element; }}
        id={`${id}-tab-${tab.id}`} role="tab" aria-selected={activeTab === tab.id}
        aria-controls={`${id}-panel`} tabIndex={activeTab === tab.id ? 0 : -1}
        onClick={() => onChange(tab.id)} onKeyDown={event => handleKeyDown(event, index)}
        className={`relative z-10 flex min-w-0 max-w-full items-center rounded-lg px-5 py-2.5 text-left text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${activeTab === tab.id ? 'text-white' : 'text-gray-600 hover:text-gray-900'}`}>
        <i aria-hidden="true" className={`fas ${tab.icon} mr-2 shrink-0`} /><span>{tab.label}</span>
      </button>)}
    </div>
    <div ref={panelRef} id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${activeTab}`} tabIndex={0} className="min-h-[400px]">
      {children}
    </div>
  </>;
}
