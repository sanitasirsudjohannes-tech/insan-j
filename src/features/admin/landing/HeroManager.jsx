import { useState, useEffect } from 'react';
import MySwal from '../presentation/adminAlert';

export default function HeroManager({ content, onSave, saving }) {
  const [formData, setFormData] = useState(content.hero);

  // Sync state if content changes from outside
  useEffect(() => {
    setFormData(content.hero);
  }, [content.hero]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSave({ ...content, hero: formData });
      MySwal.fire({
        icon: 'success',
        title: 'Tersimpan',
        text: 'Perubahan Hero Section berhasil disimpan.',
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
        <h2 className="text-lg font-bold text-slate-800">Manajemen Hero Section</h2>
        <p className="text-xs text-slate-500 mt-1">Atur teks utama yang pertama kali dilihat oleh pengunjung web.</p>
      </div>

      <div className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Teks Lencana (Badge)</label>
            <input 
              type="text" 
              name="badge"
              value={formData.badge} 
              onChange={handleChange}
              placeholder="Contoh: Sistem Informasi Sanitasi RSUD Johannes"
              className="w-full rounded-xl border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Judul Utama</label>
              <input 
                type="text" 
                name="title"
                value={formData.title} 
                onChange={handleChange}
                placeholder="Contoh: INSAN-J"
                className="w-full rounded-xl border-slate-200 text-sm font-bold focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Sub-judul (Teks Gradient)</label>
              <input 
                type="text" 
                name="subtitle"
                value={formData.subtitle} 
                onChange={handleChange}
                placeholder="Contoh: Informasi Sanitasi Johannes"
                className="w-full rounded-xl border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Deskripsi Lengkap</label>
            <textarea 
              name="description"
              value={formData.description} 
              onChange={handleChange}
              rows={4}
              placeholder="Sistem informasi untuk mendukung pekerjaan sanitasi..."
              className="w-full rounded-xl border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Teks Tombol Aksi</label>
            <input 
              type="text" 
              name="buttonText"
              value={formData.buttonText} 
              onChange={handleChange}
              placeholder="Contoh: Masuk ke Aplikasi"
              className="w-full sm:w-1/2 rounded-xl border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

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
