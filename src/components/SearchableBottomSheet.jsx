import { useState, useEffect, useRef } from 'react';

/**
 * SearchableBottomSheet
 * Props:
 *   - isOpen: bool
 *   - onClose: () => void
 *   - options: string[]
 *   - value: string
 *   - onChange: (val: string) => void
 *   - placeholder: string
 *   - label: string
 *   - accentColor: string (tailwind class, e.g. 'emerald' | 'blue')
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
}) {
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
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

  const filtered = options.filter(opt =>
    opt.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setAnimating(true);
      setQuery('');
      // Auto-focus search after animation
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 350);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!visible) return null;

  const handleSelect = (opt) => {
    onChange(opt);
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end"
      onClick={handleBackdropClick}
      style={{
        background: animating ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
        transition: 'background 0.35s ease',
      }}
    >
      {/* Sheet */}
      <div
        className="w-full max-w-lg mx-auto bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{
          maxHeight: '80vh',
          transform: animating ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className={`bg-linear-to-r ${colors.header} px-5 py-4 flex items-center justify-between mx-3 rounded-2xl mb-3`}>
          <div className="flex items-center gap-2 text-white">
            <i className="fas fa-door-open text-lg" />
            <span className="font-bold text-base">{label}</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition"
          >
            <i className="fas fa-times text-sm" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 mb-3">
          <div className="relative">
            <i className={`fas fa-search absolute left-3 top-3 ${colors.icon} text-sm`} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={placeholder}
              className={`w-full pl-9 pr-10 py-2.5 border-2 ${colors.border} rounded-xl text-sm focus:outline-none ${colors.ring} focus:ring-2 transition`}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times-circle text-sm" />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1 pl-1">
            {filtered.length} ruangan ditemukan
          </p>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-4 pb-6">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <i className="fas fa-search text-3xl mb-2 block opacity-40" />
              <p className="text-sm">Tidak ada ruangan yang cocok</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(opt => {
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
                    <span className="flex items-center gap-2">
                      <i className={`fas fa-door-open text-xs ${isSelected ? 'text-white' : colors.icon}`} />
                      {opt}
                    </span>
                    {isSelected && (
                      <i className="fas fa-check-circle text-white text-base" />
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
