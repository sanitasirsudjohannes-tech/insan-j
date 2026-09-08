const VARIANTS = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-600',
};

const SIZES = {
  sm: 'min-h-9 px-3 py-2 text-xs rounded-lg',
  md: 'min-h-11 px-4 py-2.5 text-sm rounded-xl',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-bold transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`}
      {...props}
    >
      {loading ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : icon ? <i className={icon} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
