import { useState } from 'react';
import SearchableBottomSheet from '../../SearchableBottomSheet';

/**
 * RuanganForm – form input / edit data limbah per ruangan.
 */
export default function RuanganForm({
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
  const [distributionDateError, setDistributionDateError] = useState('');
  const uniqueDistributionDates = new Set(
    (formData.distribusiDates || []).filter(date => date && date !== formData.tanggal)
  );

  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 mb-6 overflow-hidden">
        <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <i className="fas fa-edit" />
            {formData.id ? 'Edit Data Limbah Ruangan' : 'Form Input Limbah Ruangan'}
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
              <div className="md:order-1">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-gray-700 font-bold text-sm">Tanggal</label>
                  {!formData.id && (
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 hover:bg-emerald-100 transition">
                      <input
                        type="checkbox"
                        checked={formData.isDistribusi || false}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setDistributionDateError('');
                          setFormData(prev => ({
                            ...prev,
                            isDistribusi: checked,
                            distribusiDates: checked ? (prev.distribusiDates?.length ? prev.distribusiDates : ['']) : []
                          }));
                        }}
                        className="accent-emerald-600 w-3.5 h-3.5"
                      />
                      Distribusi ke Tgl Lain
                    </label>
                  )}
                </div>
                <input
                  type="date"
                  name="tanggal"
                  value={formData.tanggal}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                />
              </div>

              {formData.isDistribusi && !formData.id && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl md:order-4 md:col-span-3">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-emerald-800 font-bold text-sm">Tanggal Distribusi Tambahan</label>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, distribusiDates: [...(prev.distribusiDates || []), ''] }))}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 shadow-sm font-semibold"
                  >
                    <i className="fas fa-plus"></i> Tambah
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {(formData.distribusiDates || []).map((tgl, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-emerald-200 shadow-sm">
                      <input
                        type="date"
                        value={tgl}
                        onChange={(e) => {
                          const selectedDate = e.target.value;
                          if (selectedDate === formData.tanggal) {
                            setDistributionDateError('Tanggal tambahan tidak boleh sama dengan tanggal utama.');
                            return;
                          }
                          if (selectedDate && (formData.distribusiDates || []).some((date, dateIndex) => dateIndex !== idx && date === selectedDate)) {
                            setDistributionDateError('Tanggal tambahan sudah dipilih. Gunakan tanggal yang berbeda.');
                            return;
                          }

                          setDistributionDateError('');
                          const newDates = [...formData.distribusiDates];
                          newDates[idx] = selectedDate;
                          setFormData(prev => ({ ...prev, distribusiDates: newDates }));
                        }}
                        required
                        className="border-none bg-transparent px-2 py-1 outline-none text-sm text-emerald-900 font-medium w-[130px]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setDistributionDateError('');
                          const newDates = formData.distribusiDates.filter((_, i) => i !== idx);
                          setFormData(prev => ({ ...prev, distribusiDates: newDates }));
                        }}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition"
                        title="Hapus Tanggal"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))}
                  {formData.distribusiDates?.length === 0 && (
                    <span className="text-xs text-emerald-600 italic py-2">Silakan tambah tanggal untuk distribusi.</span>
                  )}
                </div>
                {distributionDateError && (
                  <p className="mt-2 text-xs font-semibold text-red-600" role="alert">
                    <i className="fas fa-exclamation-circle mr-1" />{distributionDateError}
                  </p>
                )}
                <div className="mt-3 text-xs text-emerald-700 bg-emerald-100/50 p-2 rounded-lg border border-emerald-100">
                  <i className="fas fa-info-circle mr-1"></i>
                  Total jumlah limbah akan <strong>dibagi rata</strong> ke <strong>{1 + uniqueDistributionDates.size} hari</strong> (termasuk tanggal utama).
                </div>
              </div>
              )}

              <div className="md:order-2">
                <label className="block text-gray-700 font-bold text-sm mb-1">Ruangan / Unit</label>
                <button
                  type="button"
                  onClick={() => setShowRuanganSheet(true)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-left flex items-center justify-between text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                >
                  <span className={formData.ruangan ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                    {formData.ruangan || '-- Ketik atau pilih ruangan --'}
                  </span>
                  <i className="fas fa-chevron-down text-gray-400 text-xs" />
                </button>
              </div>

              <div className="md:order-3">
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
              <label className="block text-gray-800 font-bold text-sm mb-2">Jumlah Timbulan Limbah (Kg)</label>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { name: 'infeksius', label: 'Infeksius', color: 'text-red-600', ring: 'focus:ring-red-400' },
                  { name: 'jarum_suntik', label: 'Jarum Suntik', color: 'text-orange-600', ring: 'focus:ring-orange-400' },
                  { name: 'botol_obat', label: 'Botol Obat', color: 'text-blue-600', ring: 'focus:ring-blue-400' },
                  { name: 'sitotoksik', label: 'Sitotoksik', color: 'text-purple-600', ring: 'focus:ring-purple-400' },
                ].map(f => (
                  <div key={f.name}>
                    <label className={`block text-sm font-semibold ${f.color} mb-1`}>{f.label}</label>
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
                placeholder="Catatan khusus, kondisi tempat sampah, dll."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-2.5 rounded-xl font-bold transition shadow-md disabled:opacity-50 flex items-center gap-2 text-sm"
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
