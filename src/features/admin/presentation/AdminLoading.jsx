export default function AdminLoading({ label = "Memuat bagian ini…" }) {
  return <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{label}</div>;
}
