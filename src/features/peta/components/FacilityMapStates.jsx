import { ErrorState } from '../../../components/ui/DataStates';

export function FacilityMapLoadingState() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500" role="status">
      <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      <p className="text-sm font-bold">Memuat data peta...</p>
    </div>
  );
}

export function FacilityMapErrorState({ onRetry }) {
  return (
    <ErrorState
      title="Data peta tidak dapat dimuat"
      description="Periksa koneksi internet lalu coba kembali."
      onRetry={onRetry}
    />
  );
}

export function FacilityMapOfflineNotice() {
  if (typeof navigator === 'undefined' || navigator.onLine) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
      <i className="fas fa-wifi mt-0.5 text-amber-600" aria-hidden="true" />
      <p>Peta membutuhkan koneksi internet untuk memuat gambar peta. Data fasilitas yang sudah tersimpan tetap dapat dilihat.</p>
    </div>
  );
}
