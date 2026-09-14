const formatCachedAt = value => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'waktu pembaruan tidak tersedia';
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function OfflineDashboardNotice({ source, updatedAt }) {
  if (source !== 'offline') return null;

  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800" role="status">
      <i className="fas fa-database mr-2" />
      <strong>Menampilkan data tersimpan di perangkat.</strong>{' '}
      Pembaruan terakhir {formatCachedAt(updatedAt)}. Hubungkan internet untuk memperbarui.
    </div>
  );
}
