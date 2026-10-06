import { useState, useEffect } from 'react';
import { getGalleryItems, saveGalleryItems, uploadGalleryImage, deleteGalleryImage } from './landingSettingsService';
import MySwal from '../presentation/adminAlert';

export default function GalleryManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadInfo, setUploadInfo] = useState(null);
  
  const [newItemType, setNewItemType] = useState('youtube'); // 'youtube' | 'image'
  const [newYoutubeId, setNewYoutubeId] = useState('');
  const [newImageFile, setNewImageFile] = useState(null);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [imageInputType, setImageInputType] = useState('file'); // 'file' | 'url'
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await getGalleryItems();
      setItems(data);
    } catch (error) {
      console.error(error);
      MySwal.fire('Gagal Memuat', 'Galeri tidak dapat dimuat. Periksa koneksi Anda.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updatedItems) => {
    setSaving(true);
    try {
      await saveGalleryItems(updatedItems);
      setItems(updatedItems);
      MySwal.fire({ icon: 'success', title: 'Tersimpan', text: 'Perubahan galeri berhasil disimpan.', timer: 1500, showConfirmButton: false });
    } catch (error) {
      console.error(error);
      MySwal.fire('Gagal Menyimpan', 'Perubahan tidak dapat disimpan. Coba lagi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id) => {
    const { isConfirmed } = await MySwal.fire({
      title: 'Hapus Item?',
      text: 'Item ini akan dihapus dari galeri landing page.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!isConfirmed) return;
    
    const itemToRemove = items.find(item => item.id === id);
    if (itemToRemove && itemToRemove.type === 'image') {
      await deleteGalleryImage(itemToRemove.url);
    }
    
    const updated = items.filter(item => item.id !== id);
    handleSave(updated);
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setNewItemType(item.type);
    if (item.type === 'youtube') {
      setNewYoutubeId(item.url);
    } else {
      setImageInputType('url');
      setNewImageUrl(item.url);
      setNewImageFile(null);
    }
    // scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewYoutubeId('');
    setNewImageUrl('');
    setNewImageFile(null);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    setUploadInfo(null);
    try {
      let url = '';
      if (newItemType === 'youtube') {
        if (!newYoutubeId) throw new Error('ID Youtube harus diisi');
        // Extract ID if URL is given
        let finalId = newYoutubeId;
        const match = newYoutubeId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
        if (match && match[1]) {
            finalId = match[1];
        }
        url = finalId;
      } else {
        if (imageInputType === 'file') {
          if (!newImageFile) throw new Error('File gambar harus dipilih');
          const originalSize = newImageFile.size;
          url = await uploadGalleryImage(newImageFile);
          setUploadInfo({ originalSize, message: 'Foto berhasil dioptimalkan ke WebP sebelum disimpan.' });
        } else {
          if (!newImageUrl) throw new Error('URL Gambar harus diisi');
          url = newImageUrl;
        }
      }

      let updated = [];
      if (editingId) {
        const itemToEdit = items.find(item => item.id === editingId);
        // Hapus file lama di storage jika URL berubah atau tipe diubah ke youtube
        if (itemToEdit && itemToEdit.type === 'image' && itemToEdit.url !== url) {
          await deleteGalleryImage(itemToEdit.url);
        }
        updated = items.map(item => item.id === editingId ? { ...item, type: newItemType, url } : item);
      } else {
        const newItem = {
          id: Date.now().toString(),
          type: newItemType,
          url,
        };
        updated = [...items, newItem];
      }
      
      await saveGalleryItems(updated);
      setItems(updated);
      
      // Reset form
      cancelEdit();
    } catch (error) {
      console.error(error);
      MySwal.fire('Gagal', error.message || 'Terjadi kesalahan saat menambahkan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-slate-500 animate-pulse">Memuat...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Manajemen Galeri</h2>
          <p className="text-xs text-slate-500 mt-1">Atur foto dan video yang tampil di halaman depan.</p>
        </div>
      </div>

      <div className="p-5">
        <form onSubmit={handleAdd} className="mb-8 bg-blue-50/50 p-4 rounded-xl border border-blue-100 transition-all">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm text-slate-700">{editingId ? 'Edit Item Galeri' : 'Tambah Item Baru'}</h3>
            {editingId && <button type="button" onClick={cancelEdit} className="text-xs text-slate-500 hover:text-slate-700 underline">Batal Edit</button>}
          </div>
          
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="radio" checked={newItemType === 'youtube'} onChange={() => setNewItemType('youtube')} className="text-blue-600" />
              Video YouTube
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="radio" checked={newItemType === 'image'} onChange={() => setNewItemType('image')} className="text-blue-600" />
              Foto / Gambar
            </label>
          </div>

          <div className="flex gap-3 items-end">
            {newItemType === 'youtube' ? (
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">ID Video atau URL YouTube</label>
                <input 
                  type="text" 
                  value={newYoutubeId} 
                  onChange={e => setNewYoutubeId(e.target.value)} 
                  placeholder="Contoh: dQw4w9WgXcQ atau https://youtube.com/watch?v=..."
                  className="w-full rounded-xl border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            ) : (
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-2">
                  <label className="text-xs text-slate-500 flex items-center gap-1">
                    <input type="radio" checked={imageInputType === 'file'} onChange={() => setImageInputType('file')} /> Upload File
                  </label>
                  <label className="text-xs text-slate-500 flex items-center gap-1">
                    <input type="radio" checked={imageInputType === 'url'} onChange={() => setImageInputType('url')} /> Link URL Gambar
                  </label>
                </div>
                {imageInputType === 'file' ? (
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={e => setNewImageFile(e.target.files[0])} 
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                ) : (
                  <input 
                    type="url" 
                    value={newImageUrl} 
                    onChange={e => setNewImageUrl(e.target.value)} 
                    placeholder="https://contoh.com/gambar.jpg"
                    className="w-full rounded-xl border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                )}
              </div>
            )}
            <button 
              type="submit" 
              disabled={saving}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Menyimpan...' : (editingId ? 'Simpan' : 'Tambahkan')}
            </button>
          </div>
          {newItemType === 'image' && imageInputType === 'file' && (
              <p className="text-[10px] text-slate-400 mt-2">
                  *Foto akan otomatis di-resize maksimal 1600 px dan dikompresi ke WebP sebelum disimpan.
              </p>
          )}
          {uploadInfo && (
              <p className="text-[10px] text-emerald-600 mt-2">
                  {uploadInfo.message} Ukuran asli: {(uploadInfo.originalSize / 1024 / 1024).toFixed(2)} MB.
              </p>
          )}
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item, index) => (
            <div key={item.id} className="relative group rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
              <div className="absolute top-2 left-2 z-10 bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg backdrop-blur-sm">
                #{index + 1} - {item.type.toUpperCase()}
              </div>
              <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleEdit(item)}
                  className="w-8 h-8 flex items-center justify-center bg-blue-500 text-white rounded-lg shadow-lg"
                  title="Edit"
                >
                  <i className="fas fa-edit text-xs" />
                </button>
                <button 
                  onClick={() => handleRemove(item.id)}
                  className="w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-lg shadow-lg"
                  title="Hapus"
                >
                  <i className="fas fa-trash-alt text-xs" />
                </button>
              </div>

              <div className="aspect-video bg-slate-200 flex items-center justify-center">
                {item.type === 'youtube' ? (
                  <img src={`https://img.youtube.com/vi/${item.url}/mqdefault.jpg`} alt="Thumbnail" className="w-full h-full object-cover opacity-80" />
                ) : (
                  <img src={item.url} alt="Galeri" className="w-full h-full object-cover" />
                )}
              </div>
            </div>
          ))}
          
          {items.length === 0 && (
            <div className="col-span-full py-10 text-center text-slate-500 text-sm">
              Belum ada item di galeri.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
