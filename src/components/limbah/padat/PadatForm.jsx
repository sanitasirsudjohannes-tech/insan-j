import { getLocalDateString } from '../../../lib/localDate';

/**
 * PadatForm – form input / edit data limbah padat.
 *
 * Props:
 *  formData, setFormData, handleInputChange, handleSubmit,
 *  submitting, user
 */

const EMPTY_FORM = {
  id: null,
  tanggal: getLocalDateString(),
  infeksius: '',
  jarum_suntik: '',
  botol_obat: '',
  sitotoksik: '',
};

export { EMPTY_FORM };

const FIELDS = [
  { name: 'infeksius', label: 'Infeksius' },
  { name: 'jarum_suntik', label: 'Jarum Suntik' },
  { name: 'botol_obat', label: 'Botol Obat' },
  { name: 'sitotoksik', label: 'Sitotoksik' },
];

export default function PadatForm({
  formData,
  setFormData,
  handleInputChange,
  handleSubmit,
  submitting,
  user,
}) {
  return (
    <div className="bg-white rounded-lg shadow-lg mb-6 overflow-hidden">
      <div className="bg-blue-600 text-white px-6 py-4">
        <h2 className="text-lg font-bold">
          <i className="fas fa-edit mr-2" /> Form Input Limbah Padat (Kg)
        </h2>
      </div>
      <div className="p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 font-medium mb-1">Tanggal</label>
              <input
                type="date"
                name="tanggal"
                value={formData.tanggal}
                onChange={handleInputChange}
                required
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">Petugas</label>
              <input
                type="text"
                value={user?.nama || ''}
                readOnly
                className="w-full border bg-gray-100 text-gray-500 rounded-lg px-3 py-2 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {FIELDS.map(field => (
              <div key={field.name}>
                <label className="block text-gray-700 font-medium mb-1">{field.label}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name={field.name}
                  value={formData[field.name]}
                  onChange={handleInputChange}
                  required
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0.0"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-3">
            {formData.id && (
              <button
                type="button"
                onClick={() => setFormData(EMPTY_FORM)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
              >
                Batal Edit
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50"
            >
              {submitting ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-save mr-2" />}
              {formData.id ? 'Update Data' : 'Simpan Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
