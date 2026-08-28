export default function PengangkutanForm({
  form,
  handleChange,
  handleSubmit,
  submitting,
  emptyForm,
  setForm
}) {
  return (
    <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
      <div className="bg-orange-600 text-white px-6 py-4 flex items-center gap-3">
        <i className="fas fa-truck text-xl"></i>
        <h2 className="text-lg font-bold">Form Input Pengangkutan Limbah</h2>
      </div>
      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 font-medium mb-1">Tanggal Pengangkutan</label>
            <input
              type="date"
              name="tanggal"
              value={form.tanggal}
              onChange={handleChange}
              required
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">Jumlah Diangkut (Kg)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="jumlah_kg"
              value={form.jumlah_kg}
              onChange={handleChange}
              required
              placeholder="0.00"
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">Keterangan</label>
            <input
              type="text"
              name="keterangan"
              value={form.keterangan}
              onChange={handleChange}
              placeholder="Pengangkutan rutin, dll."
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-400 outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          {form.id && (
            <button
              type="button"
              onClick={() => setForm(emptyForm)}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
            >
              Batal Edit
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
            {form.id ? 'Update Data' : 'Simpan Data'}
          </button>
        </div>
      </form>
    </div>
  );
}
