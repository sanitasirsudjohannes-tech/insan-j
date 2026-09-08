import Button from './Button';

export function EmptyState({
  title = 'Belum ada data',
  description = 'Data belum tersedia untuk periode yang dipilih.',
  icon = 'fas fa-inbox',
  action,
  compact = false,
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center text-slate-500 ${compact ? 'px-4 py-8' : 'px-6 py-14'}`}>
      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
        <i className={`${icon} text-xl`} aria-hidden="true" />
      </div>
      <p className="text-sm font-bold text-slate-700">{title}</p>
      {description && <p className="text-xs mt-1 max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Data tidak dapat dimuat',
  description = 'Periksa koneksi lalu coba kembali.',
  onRetry,
  compact = false,
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 ${compact ? 'px-4 py-7' : 'px-6 py-12'}`} role="alert">
      <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center mb-3">
        <i className="fas fa-exclamation-triangle text-xl" aria-hidden="true" />
      </div>
      <p className="text-sm font-bold text-rose-800">{title}</p>
      <p className="text-xs mt-1 max-w-sm leading-relaxed">{description}</p>
      {onRetry && (
        <Button variant="danger" size="sm" icon="fas fa-redo-alt" onClick={onRetry} className="mt-4">Coba Lagi</Button>
      )}
    </div>
  );
}

const SkeletonLine = ({ className = '' }) => (
  <div className={`h-3 rounded-full bg-slate-200 animate-pulse ${className}`} />
);

export function TableRowsSkeleton({ columns = 6, rows = 5 }) {
  return Array.from({ length: rows }, (_, row) => (
    <tr key={row} className="border-b border-slate-100" aria-hidden="true">
      {Array.from({ length: columns }, (__, column) => (
        <td key={column} className="px-3 py-3">
          <SkeletonLine className={column === 0 ? 'w-6' : column % 3 === 0 ? 'w-20' : 'w-full max-w-28'} />
        </td>
      ))}
    </tr>
  ));
}

export function MobileListSkeleton({ rows = 4 }) {
  return (
    <div className="divide-y divide-slate-100" aria-hidden="true">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="px-4 py-4 flex gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-200 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="w-2/5" />
            <SkeletonLine className="w-4/5" />
            <SkeletonLine className="w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton({ cards = 6 }) {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="bg-white border border-slate-100 rounded-xl p-4 space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-slate-200 animate-pulse" />
            <SkeletonLine className="w-2/3 mx-auto" />
            <SkeletonLine className="w-1/2 mx-auto h-5" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 bg-white border border-slate-100 rounded-xl p-5"><SkeletonLine className="w-1/3 mb-6" /><div className="h-52 rounded-xl bg-slate-100 animate-pulse" /></div>
        <div className="h-72 bg-white border border-slate-100 rounded-xl p-5"><SkeletonLine className="w-1/3 mb-6" /><div className="h-52 rounded-xl bg-slate-100 animate-pulse" /></div>
      </div>
    </div>
  );
}
