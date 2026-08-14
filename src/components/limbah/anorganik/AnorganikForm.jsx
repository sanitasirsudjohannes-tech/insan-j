import SearchableBottomSheet from '../../SearchableBottomSheet';

const JENIS_FIELDS = [
  { name: 'infus', label: 'Infus', color: 'text-blue-600', ring: 'focus:ring-blue-400' },
  { name: 'jerigen', label: 'Jerigen', color: 'text-amber-600', ring: 'focus:ring-amber-400' },
  { name: 'kertas', label: 'Kertas', color: 'text-slate-600', ring: 'focus:ring-slate-400' },
  { name: 'kardus', label: 'Kardus', color: 'text-orange-700', ring: 'focus:ring-orange-400' },
  { name: 'botol_mineral', label: 'Botol Mineral', color: 'text-cyan-600', ring: 'focus:ring-cyan-400' },
  { name: 'bayclin_dll', label: 'Bayclin dll', color: 'text-purple-600', ring: 'focus:ring-purple-400' },
];

export { JENIS_FIELDS };

/**
 * AnorganikForm – form input / edit data limbah anorganik.
 *
 * Props:
 *  formData, emptyForm, setFormData, handleInputChange, handleSubmit,
 *  submitting, user, ruanganList,
 *  showRuanganSheet, setShowRuanganSheet
 */
export default function AnorganikForm({
  formData,
  emptyForm,
  setFormData,
  handleInputChange,
  handleSubmit,
  submitting,
  user,
  ruanganList,
  showRuanganSheet,
  setShowRuanganSheet,
}) {
  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 mb-6 overflow-hidden">
        <div className="bg-cyan-600 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <i className="fas fa-edit" />
            {formData.id ? 'Edit Data Limbah Anorganik' : 'Form Input Limbah Anorganik'}
          </h2>
          {formData.id && (
            <span className="text-xs bg-amber-400 text-slate-900 font-bold px-2.5 py-1 rounded-full uppercase">
              Mode Edit
            </span>
          )}
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-gray-700 font-bold text-sm mb-1">Tanggal</label>
                <input
                  type="date"
                  name="tanggal"
                  value={formData.tanggal}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold text-sm mb-1">Ruangan / Unit</label>
                <button
                  type="button"
                  onClick={() => setShowRuanganSheet(true)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-left flex items-center justify-between text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none bg-white"
                >
                  <span className={formData.ruangan ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                    {formData.ruangan || '-- Ketik atau pilih ruangan --'}
                  </span>
                  <i className="fas fa-chevron-down text-gray-400 text-xs" />
                </button>
              </div>

              <div>
                <label className="block text-gray-700 font-bold text-sm mb-1">Petugas Input</label>
                <input
                  type="text"
                  value={user?.nama || 'Petugas'}
                  readOnly
                  className="w-full border border-gray-200 bg-gray-100 text-gray-500 rounded-xl px-3 py-2.5 cursor-not-allowed text-sm font-medium"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-gray-800 font-bold text-sm mb-2">
                Jumlah Timbulan Limbah Anorganik (Kg)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {JENIS_FIELDS.map(f => (
                  <div key={f.name}>
                    <label className={`block text-sm font-semibold ${f.color} mb-1`}>{f.label} (Kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name={f.name}
                      value={formData[f.name]}
                      onChange={handleInputChange}
                      required
                      placeholder="0.0"
                      className={`w-full border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 ${f.ring} outline-none text-sm`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 font-bold text-sm mb-1">Keterangan (Opsional)</label>
              <input
                type="text"
                name="keterangan"
                value={formData.keterangan}
                onChange={handleInputChange}
                placeholder="Catatan tambahan, dll."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
              />
            </div>

            <div className="flex justify-end gap-3">
              {formData.id && (
                <button
                  type="button"
                  onClick={() => setFormData(emptyForm)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-5 py-2.5 rounded-xl transition text-sm font-semibold"
                >
                  Batal Edit
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-7 py-2.5 rounded-xl font-bold transition shadow-md disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                {submitting ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-save" />}
                {formData.id ? 'Update Data' : 'Simpan Data'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <SearchableBottomSheet
        isOpen={showRuanganSheet}
        onClose={() => setShowRuanganSheet(false)}
        options={ruanganList}
        value={formData.ruangan}
        onChange={(val) => setFormData(prev => ({ ...prev, ruangan: val }))}
        label="Pilih Ruangan / Unit"
        placeholder="Cari ruangan atau unit..."
        accentColor="emerald"
      />
    </>
  );
}
