export default function PengaturanTab({
  formLimbahPadatEnabled,
  savingSettings,
  handleToggleFormLimbahPadat
}) {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-slate-50 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
          <i className="fas fa-sliders-h text-indigo-600"></i>
        </div>
        <div>
          <h2 className="font-bold text-gray-800 text-sm">Pengaturan Modul</h2>
          <p className="text-xs text-gray-500">Aktifkan atau nonaktifkan fitur input data untuk petugas</p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Toggle Form Limbah Padat */}
        <div className={`rounded-2xl border-2 p-5 transition-all ${
          formLimbahPadatEnabled
            ? 'border-green-200 bg-green-50'
            : 'border-red-200 bg-red-50'
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                formLimbahPadatEnabled ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <i className={`fas fa-trash-alt text-xl ${
                  formLimbahPadatEnabled ? 'text-green-600' : 'text-red-500'
                }`}></i>
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Form Input Limbah Padat</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Kontrol akses petugas untuk menginput data limbah padat secara manual.
                  Tabel data & export tetap bisa diakses meski form dimatikan.
                </p>
                <span className={`mt-2 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                  formLimbahPadatEnabled
                    ? 'bg-green-200 text-green-800'
                    : 'bg-red-200 text-red-800'
                }`}>
                  <i className={`fas ${ formLimbahPadatEnabled ? 'fa-check-circle' : 'fa-ban' } text-[10px]`}></i>
                  {formLimbahPadatEnabled ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              onClick={() => handleToggleFormLimbahPadat(!formLimbahPadatEnabled)}
              disabled={savingSettings}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none shrink-0 ${
                formLimbahPadatEnabled ? 'bg-green-500' : 'bg-gray-300'
              } disabled:opacity-60`}
              title={formLimbahPadatEnabled ? 'Klik untuk menonaktifkan' : 'Klik untuk mengaktifkan'}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                formLimbahPadatEnabled ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => handleToggleFormLimbahPadat(true)}
              disabled={formLimbahPadatEnabled || savingSettings}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="fas fa-power-off"></i> Aktifkan Form
            </button>
            <button
              onClick={() => handleToggleFormLimbahPadat(false)}
              disabled={!formLimbahPadatEnabled || savingSettings}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="fas fa-ban"></i> Nonaktifkan Form
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 px-1">
          <i className="fas fa-info-circle mr-1"></i>
          Pengaturan disimpan ke database dan berlaku untuk semua petugas yang login.
        </p>
      </div>
    </div>
  );
}
