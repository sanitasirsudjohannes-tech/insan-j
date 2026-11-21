export default function ParameterStatus({ status }) {
  const tone = status === 'memenuhi'
    ? 'bg-emerald-100 text-emerald-800'
    : status === 'tidak_memenuhi'
      ? 'bg-red-100 text-red-800'
      : 'bg-amber-100 text-amber-800';
  const label = status === 'memenuhi' ? 'Memenuhi' : status === 'tidak_memenuhi' ? 'Tidak memenuhi' : 'Belum dinilai';
  return <span role="status" className={`whitespace-nowrap rounded-lg px-2 py-1 font-bold ${tone}`}>{label}</span>;
}
