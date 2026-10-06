import { useState, useEffect, useRef } from 'react';
import { getGalleryItems, saveGalleryItems, uploadGalleryImage, deleteGalleryImage } from './landingSettingsService';
import MySwal from '../presentation/adminAlert';

export default function GalleryManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [galleryFilter, setGalleryFilter] = useState('all'); // 'all' | 'image' | 'youtube'
  
  const [newItemType, setNewItemType] = useState('youtube'); // 'youtube' | 'image'
  const [newYoutubeId, setNewYoutubeId] = useState('');
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef(null);
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
      setNewImageFiles([]);
    }
    // scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetSelectedImages = () => {
    setNewImageFiles([]);
    setUploadInfo(null);
    setFileInputKey((key) => key + 1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeSelectedImage = (index) => {
    setNewImageFiles((files) => files.filter((_, fileIndex) => fileIndex !== index));
    setUploadInfo(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewYoutubeId('');
    setNewImageUrl('');
    setNewImageFiles([]);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    setUploadInfo(null);
    let uploadedImageUrls = [];
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
          if (!newImageFiles.length) throw new Error('Minimal satu file gambar harus dipilih');
          const originalSize = newImageFiles.reduce((total, file) => total + file.size, 0);
          const uploadedUrls = [];
          // Upload satu per satu agar browser/mobile tidak dibebani banyak proses
          // canvas + network request sekaligus. Metadata disimpan satu kali di akhir.
          for (const file of newImageFiles) {
            uploadedUrls.push(await uploadGalleryImage(file));
          }
          uploadedImageUrls = uploadedUrls;
          url = uploadedUrls;
          setUploadInfo({ originalSize, message: `${uploadedUrls.length} foto berhasil dioptimalkan ke WebP sebelum disimpan.` });
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
        const urls = Array.isArray(url) ? url : [url];
        updated = [
          ...items,
          ...urls.map((itemUrl, index) => ({
            id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
            type: newItemType,
            url: itemUrl,
          })),
        ];
      }
      
      await saveGalleryItems(updated);
      setItems(updated);
      
      // Reset form
      cancelEdit();
    } catch (error) {
      if (uploadedImageUrls.length) {
        await Promise.all(uploadedImageUrls.map(uploadedUrl => deleteGalleryImage(uploadedUrl)));
      }
      console.error(error);
      MySwal.fire('Gagal', error.message || 'Terjadi kesalahan saat menambahkan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-slate-500 animate-pulse">Memuat...</div>;

  const filteredItems = galleryFilter === 'all' ? items : items.filter((item) => item.type === galleryFilter);
  const photoCount = items.filter((item) => item.type === 'image').length;
  const videoCount = items.filter((item) => item.type === 'youtube').length;

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
                  <div>
                    <input ref={fileInputRef} key={fileInputKey} id="gallery-image-upload" type="file" accept="image/*" multiple={!editingId}
                      onChange={(e) => { setNewImageFiles(Array.from(e.target.files || [])); setUploadInfo(null); }}
                      className="sr-only" />
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="gallery-image-upload" className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold cursor-pointer hover:bg-blue-100 active:scale-[0.98] transition-all">
                        {newImageFiles.length ? 'Tambah / Ganti Foto' : 'Pilih Foto'}
                      </label>
                      {newImageFiles.length > 0 && <button type="button" onClick={resetSelectedImages} disabled={saving} className="px-4 py-2.5 rounded-xl bg-white border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 disabled:opacity-50">Reset</button>}
                      <span className="text-xs text-slate-400">{newImageFiles.length ? `${newImageFiles.length} foto dipilih` : 'Belum ada foto dipilih'}</span>
                    </div>
                    {newImageFiles.length > 0 && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className="text-xs font-semibold text-slate-700">Foto yang akan di-upload</p>
                          <span className="text-[10px] text-slate-400">{newImageFiles.length} file</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                          {newImageFiles.map((file, index) => (
                            <div key={`${file.name}-${file.size}-${index}`} className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                              <img src={URL.createObjectURL(file)} alt={file.name} className="w-full aspect-video object-cover" onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)} />
                              <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1.5 flex items-center gap-1">
                                <span className="flex-1 min-w-0 truncate text-[10px] text-white">{file.name}</span>
                                <button type="button" onClick={() => removeSelectedImage(index)} disabled={saving} className="shrink-0 w-6 h-6 rounded-md bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 disabled:opacity-50" aria-label={`Hapus ${file.name} dari pilihan`}>×</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
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
                  *Pilih satu atau beberapa foto. Foto akan otomatis di-resize maksimal 1600 px dan dikompresi ke WebP sebelum disimpan.
              </p>
          )}
          {uploadInfo && (
              <p className="text-[10px] text-emerald-600 mt-2">
                  {uploadInfo.message} Ukuran asli: {(uploadInfo.originalSize / 1024 / 1024).toFixed(2)} MB.
              </p>
          )}
        </form>

        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Konten Tersimpan</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Pisahkan tampilan foto dan video agar lebih mudah dikelola.</p>
          </div>
          <select
            value={galleryFilter}
            onChange={(e) => setGalleryFilter(e.target.value)}
            className="w-full sm:w-auto rounded-xl border-slate-200 text-sm text-slate-700 focus:border-blue-500 focus:ring-blue-500 bg-white"
            aria-label="Filter konten galeri"
          >
            <option value="all">Semua Konten ({items.length})</option>
            <option value="image">Foto ({photoCount})</option>
            <option value="youtube">Video YouTube ({videoCount})</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} className="relative group rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
              <div className="absolute top-2 left-2 z-10 bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg backdrop-blur-sm">
                {item.type === 'youtube' ? 'VIDEO YOUTUBE' : 'FOTO'}
              </div>
              <div className="absolute top-2 right-2 z-20 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => handleEdit(item)} className="w-9 h-9 md:w-8 md:h-8 flex items-center justify-center bg-blue-500 text-white rounded-lg shadow-lg active:scale-95 transition-transform" title="Edit" aria-label="Edit item">
                  <i className="fas fa-edit text-xs" />
                </button>
                <button type="button" onClick={() => handleRemove(item.id)} className="w-9 h-9 md:w-8 md:h-8 flex items-center justify-center bg-red-500 text-white rounded-lg shadow-lg active:scale-95 transition-transform" title="Hapus" aria-label="Hapus item">
                  <i className="fas fa-trash-alt text-xs" />
                </button>
              </div>

              <div className="aspect-video bg-slate-200 flex items-center justify-center">
                {item.type === 'youtube' ? (
                  <img src={"https://img.youtube.com/vi/" + item.url + "/mqdefault.jpg"} alt="Thumbnail video" className="w-full h-full object-cover opacity-80" />
                ) : (
                  <img src={item.url} alt="Galeri" className="w-full h-full object-cover" />
                )}
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="col-span-full py-10 text-center text-slate-500 text-sm">
              {galleryFilter === 'image' ? 'Belum ada foto di galeri.' : galleryFilter === 'youtube' ? 'Belum ada video YouTube di galeri.' : 'Belum ada item di galeri.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
