import { useState, useEffect } from 'react';
import MySwal from '../presentation/adminAlert';

export default function GenericSectionManager({ content, onSave, saving, sectionKey, title, description, fields }) {
  const [formData, setFormData] = useState(content[sectionKey]);

  useEffect(() => {
    setFormData(content[sectionKey]);
  }, [content, sectionKey]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSave({ ...content, [sectionKey]: formData });
      MySwal.fire({
        icon: 'success',
        title: 'Tersimpan',
        text: `Perubahan ${title} berhasil disimpan.`,
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      console.error(error);
      MySwal.fire('Gagal Menyimpan', 'Perubahan tidak dapat disimpan. Coba lagi.', 'error');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>

      <div className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
          {fields.map(field => (
            <div key={field.name}>
              <label className="block text-sm font-semibold text-slate-700 mb-1">{field.label}</label>
              {field.type === 'textarea' ? (
                <textarea 
                  name={field.name}
                  value={formData[field.name] || ''} 
                  onChange={handleChange}
                  rows={4}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              ) : (
                <input 
                  type="text" 
                  name={field.name}
                  value={formData[field.name] || ''} 
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              )}
            </div>
          ))}

          <div className="pt-4 border-t border-slate-100">
            <button 
              type="submit" 
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
