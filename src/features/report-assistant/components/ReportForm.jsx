import { REPORT_TYPES } from '../constants/reportTypes.js';

const formatDate = value => {
  if (!value) return '';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
};

export default function ReportForm({ form, errors, handleTypeChange, updateForm, navigate, availableWaterDates, waterDatesLoading }) {
  const isWaterReport = ['clean_water', 'wastewater'].includes(form.reportType);
  return (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-slate-800">1. Pilih laporan dan {isWaterReport ? 'tanggal sampling' : 'periode'}</h2>
              <p className="mt-1 text-xs text-slate-500">Data tidak disimpan ke database.</p>
            </div>
            <button type="button" onClick={() => navigate('/rekap-limbah')} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200">
              Ke Rekap
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Object.entries(REPORT_TYPES).map(([key, type]) => (
              <button key={key} type="button" onClick={() => handleTypeChange(key)} className={`rounded-2xl border p-3 text-left transition ${form.reportType === key ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-blue-200'}`}>
                <i className={`${type.icon} mb-2 block`} />
                <span className="text-xs font-bold leading-tight">{type.shortLabel}</span>
              </button>
            ))}
          </div>
          <div className={`mt-5 grid gap-4 ${isWaterReport ? '' : 'sm:grid-cols-2'}`}>
            {isWaterReport ? (
              <label className="block text-sm font-bold text-slate-700">
                Tanggal pengambilan sampel
                <select
                  value={form.period.start}
                  disabled={waterDatesLoading || availableWaterDates.length === 0}
                  onChange={event => updateForm('period', { start: event.target.value, end: event.target.value })}
                  className={`mt-2 w-full rounded-xl border bg-white px-3 py-3 font-normal outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 ${errors.periodStart ? 'border-red-400' : 'border-slate-300'}`}
                >
                  {waterDatesLoading ? (
                    <option value="">Memuat tanggal pemeriksaan...</option>
                  ) : availableWaterDates.length === 0 ? (
                    <option value="">Belum ada pemeriksaan</option>
                  ) : (
                    availableWaterDates.map(date => <option key={date} value={date}>{formatDate(date)}</option>)
                  )}
                </select>
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  {availableWaterDates.length > 0 ? 'Hanya tanggal yang memiliki data pemeriksaan yang ditampilkan.' : ''}
                </span>
                <span className="mt-1 block text-xs font-normal text-red-600">{errors.periodStart}</span>
              </label>
            ) : ([
              ['start', 'Tanggal awal'],
              ['end', 'Tanggal akhir']
            ].map(([key, label]) => (
              <label key={key} className="block text-sm font-bold text-slate-700">
                {label}
                <input
                  type="date"
                  value={form.period[key]}
                  onChange={event => updateForm('period', { ...form.period, [key]: event.target.value })}
                  className={`mt-2 w-full rounded-xl border px-3 py-3 font-normal outline-none focus:ring-2 focus:ring-blue-500 ${errors[`period${key === 'start' ? 'Start' : 'End'}`] ? 'border-red-400' : 'border-slate-300'}`}
                />
                <span className="mt-1 block text-xs font-normal text-red-600">{errors[`period${key === 'start' ? 'Start' : 'End'}`]}</span>
              </label>
            )))}
          </div>
        </section>


  );
}
