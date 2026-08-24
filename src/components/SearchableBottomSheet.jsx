import { useState, useEffect, useRef } from 'react';

/**
 * SearchableBottomSheet
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - options: string[]
 * - value: string
 * - onChange: (val: string) => void
 * - placeholder: string
 * - label: string
 * - accentColor: 'emerald' | 'blue'
 */
export default function SearchableBottomSheet({
  isOpen,
  onClose,
  options = [],
  value,
  onChange,
  placeholder = 'Ketik untuk mencari...',
  label = 'Pilih Ruangan',
  accentColor = 'blue',
  optionNoun = 'ruangan',
  iconClass = 'fas fa-door-open',
}) {
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  // Tinggi area viewport yang benar-benar terlihat
  const [viewportHeight, setViewportHeight] = useState(null);

  // Jarak sheet dari bawah ketika keyboard muncul
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const inputRef = useRef(null);

  const accentMap = {
    blue: {
      header: 'from-blue-600 to-blue-700',
      ring: 'focus:ring-blue-400',
      border: 'border-blue-500',
      badge: 'bg-blue-100 text-blue-700',
      hoverBg: 'hover:bg-blue-50',
      activeBg: 'bg-blue-600 text-white',
      icon: 'text-blue-500',
    },

    emerald: {
      header: 'from-emerald-600 to-teal-700',
      ring: 'focus:ring-emerald-400',
      border: 'border-emerald-500',
      badge: 'bg-emerald-100 text-emerald-700',
      hoverBg: 'hover:bg-emerald-50',
      activeBg: 'bg-emerald-600 text-white',
      icon: 'text-emerald-500',
    },
  };

  const colors = accentMap[accentColor] || accentMap.blue;

  // =========================================================
  // FILTER RUANGAN
  // =========================================================

  const filtered = options.filter((opt) =>
    String(opt)
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  // =========================================================
  // HANDLE VIEWPORT / KEYBOARD ANDROID
  // =========================================================

  useEffect(() => {
    if (!isOpen) return;

    const updateViewport = () => {
      const vv = window.visualViewport;

      if (!vv) {
        setViewportHeight(window.innerHeight);
        setKeyboardOffset(0);
        return;
      }

      const height = vv.height;

      /*
       * Menghitung tinggi keyboard.
       *
       * Pada Android/Samsung, ketika keyboard muncul,
       * visualViewport.height akan mengecil.
       */
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - (vv.height + vv.offsetTop)
      );

      /*
       * Abaikan perubahan kecil seperti address bar/browser UI.
       * Anggap keyboard muncul jika > 100px.
       */
      const isKeyboardVisible = keyboardHeight > 100;

      setViewportHeight(height);

      setKeyboardOffset(
        isKeyboardVisible ? keyboardHeight : 0
      );
    };

    updateViewport();

    const vv = window.visualViewport;

    if (vv) {
      vv.addEventListener('resize', updateViewport);
      vv.addEventListener('scroll', updateViewport);
    }

    window.addEventListener('resize', updateViewport);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', updateViewport);
        vv.removeEventListener('scroll', updateViewport);
      }

      window.removeEventListener('resize', updateViewport);
    };
  }, [isOpen]);

  // =========================================================
  // OPEN / CLOSE SHEET
  // =========================================================

  useEffect(() => {
    if (isOpen) {
      setVisible(true);

      // Beri kesempatan React merender sheet terlebih dahulu
      requestAnimationFrame(() => {
        setAnimating(true);
      });

      setQuery('');

      /*
       * Fokus search setelah sheet mulai tampil.
       *
       * Karena kita menggunakan visualViewport,
       * sheet akan menyesuaikan ketika keyboard Samsung muncul.
       */
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 250);

      return () => clearTimeout(timer);
    }

    setAnimating(false);

    const timer = setTimeout(() => {
      setVisible(false);
      setKeyboardOffset(0);
    }, 350);

    return () => clearTimeout(timer);
  }, [isOpen]);

  // =========================================================
  // LOCK BODY SCROLL SAAT SHEET TERBUKA
  // =========================================================

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // =========================================================
  // CLOSE DENGAN ESC
  // =========================================================

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // =========================================================
  // HANDLER
  // =========================================================

  const handleSelect = (opt) => {
    onChange(opt);
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!visible) return null;

  // =========================================================
  // HITUNG TINGGI SHEET
  // =========================================================

  /*
   * Saat keyboard tidak muncul:
   *   maksimal 80% viewport
   *
   * Saat keyboard muncul:
   *   gunakan viewport yang tersisa.
   *
   * Kita beri sedikit ruang supaya sheet tidak terlalu memenuhi
   * layar dan bagian search tetap nyaman.
   */

  const availableHeight =
    viewportHeight || window.innerHeight;

  const maxSheetHeight = Math.min(
    availableHeight * 0.85,
    650
  );

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end"
      onClick={handleBackdropClick}
      style={{
        background: animating
          ? 'rgba(0,0,0,0.5)'
          : 'rgba(0,0,0,0)',

        transition: 'background 0.35s ease',

        /*
         * Supaya backdrop tetap mengikuti viewport.
         */
        height: '100dvh',
      }}
    >
      {/* =====================================================
          BOTTOM SHEET
      ====================================================== */}

      <div
        className="w-full max-w-lg mx-auto bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          /*
           * Tinggi dinamis berdasarkan viewport.
           */
          height: `${maxSheetHeight}px`,

          maxHeight: `${maxSheetHeight}px`,

          /*
           * INI YANG MEMBUAT SHEET NAIK DI ATAS KEYBOARD.
           *
           * keyboardOffset = tinggi keyboard Android.
           */
          bottom: `${keyboardOffset}px`,

          position: 'fixed',
          left: '0',
          right: '0',
          marginLeft: 'auto',
          marginRight: 'auto',

          transform: animating
            ? 'translateY(0)'
            : 'translateY(100%)',

          transition:
            'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',

          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* =================================================
            HANDLE BAR
        ================================================== */}

        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* =================================================
            HEADER
        ================================================== */}

        <div
          className={`bg-linear-to-r ${colors.header} px-5 py-4 flex items-center justify-between mx-3 rounded-2xl mb-3 shrink-0`}
        >
          <div className="flex items-center gap-2 text-white">
            <i className={\`${iconClass} text-lg\`} />

            <span className="font-bold text-base">
              {label}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition"
            aria-label="Tutup"
          >
            <i className="fas fa-times text-sm" />
          </button>
        </div>

        {/* =================================================
            SEARCH
        ================================================== */}

        <div className="px-4 mb-3 shrink-0">
          <div className="relative">
            <i
              className={`fas fa-search absolute left-3 top-1/2 -translate-y-1/2 ${colors.icon} text-sm`}
            />

            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className={`w-full pl-9 pr-10 py-3 border-2 ${colors.border} rounded-xl text-sm focus:outline-none ${colors.ring} focus:ring-2 transition`}
            />

            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  requestAnimationFrame(() => {
                    inputRef.current?.focus({ preventScroll: true });
                  });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Hapus pencarian"
              >
                <i className="fas fa-times-circle text-sm" />
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 mt-1 pl-1">
            {filtered.length} {optionNoun} ditemukan
          </p>
        </div>

        {/* =================================================
            LIST
        ================================================== */}

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-6">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <i className="fas fa-search text-3xl mb-2 block opacity-40" />

              <p className="text-sm">
                Tidak ada {optionNoun} yang cocok
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((opt) => {
                const isSelected = opt === value;

                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all font-medium text-sm
                      ${isSelected
                        ? `${colors.activeBg} shadow-md`
                        : `bg-gray-50 text-gray-700 ${colors.hoverBg} hover:shadow-sm`
                      }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <i
                        className={`${iconClass} text-xs shrink-0 ${isSelected
                          ? 'text-white'
                          : colors.icon
                          }`}
                      />

                      <span className="truncate">
                        {opt}
                      </span>
                    </span>

                    {isSelected && (
                      <i className="fas fa-check-circle text-white text-base shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}