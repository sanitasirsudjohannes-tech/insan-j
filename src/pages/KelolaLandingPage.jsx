import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import GalleryManager from '../features/admin/landing/GalleryManager';
import HeroManager from '../features/admin/landing/HeroManager';
import GenericSectionManager from '../features/admin/landing/GenericSectionManager';
import { getLandingContent, saveLandingContent, DEFAULT_LANDING_CONTENT } from '../features/admin/landing/landingSettingsService';

export default function KelolaLandingPage() {
  const [activeTab, setActiveTab] = useState('hero');
  const [content, setContent] = useState(DEFAULT_LANDING_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLandingContent().then(data => {
      if (data) {
        setContent({
          hero: { ...DEFAULT_LANDING_CONTENT.hero, ...data.hero },
          about: { ...DEFAULT_LANDING_CONTENT.about, ...data.about },
          modules: { ...DEFAULT_LANDING_CONTENT.modules, ...data.modules },
          workflow: { ...DEFAULT_LANDING_CONTENT.workflow, ...data.workflow },
          cta: { ...DEFAULT_LANDING_CONTENT.cta, ...data.cta }
        });
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const handleSaveContent = async (newContent) => {
    setSaving(true);
    try {
      await saveLandingContent(newContent);
      setContent(newContent);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'hero', icon: 'fa-heading', label: 'Hero' },
    { id: 'about', icon: 'fa-info-circle', label: 'Tentang' },
    { id: 'modules', icon: 'fa-th-large', label: 'Modul' },
    { id: 'workflow', icon: 'fa-project-diagram', label: 'Alur Kerja' },
    { id: 'cta', icon: 'fa-bullhorn', label: 'CTA' },
    { id: 'gallery', icon: 'fa-images', label: 'Galeri' },
  ];

  const genericFields = [
    { name: 'badge', label: 'Teks Lencana (Badge)', type: 'text', placeholder: 'Teks kecil di atas judul' },
    { name: 'title', label: 'Judul Utama', type: 'text', placeholder: 'Judul besar' },
    { name: 'description', label: 'Deskripsi Lengkap', type: 'textarea', placeholder: 'Penjelasan detail' },
  ];

  return (
    <AppLayout title="Pengaturan Landing Page" showBackButton={false}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6 rounded-2xl bg-white p-2 shadow-sm border border-slate-100 flex flex-wrap gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <i className={`fas ${tab.icon} mr-2`} />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-6 text-center text-slate-500 animate-pulse">Memuat data...</div>
        ) : (
          <>
            {activeTab === 'hero' && <HeroManager content={content} onSave={handleSaveContent} saving={saving} />}
            {activeTab === 'about' && (
              <GenericSectionManager content={content} onSave={handleSaveContent} saving={saving} sectionKey="about" title="Manajemen Tentang Kami" description="Ubah teks pada bagian penjelasan aplikasi." fields={genericFields} />
            )}
            {activeTab === 'modules' && (
              <GenericSectionManager content={content} onSave={handleSaveContent} saving={saving} sectionKey="modules" title="Manajemen Fitur/Modul" description="Ubah teks pengantar daftar fitur dan modul aplikasi." fields={genericFields} />
            )}
            {activeTab === 'workflow' && (
              <GenericSectionManager content={content} onSave={handleSaveContent} saving={saving} sectionKey="workflow" title="Manajemen Alur Kerja" description="Ubah teks pengantar bagian alur kerja sistem." fields={genericFields} />
            )}
            {activeTab === 'cta' && (
              <GenericSectionManager content={content} onSave={handleSaveContent} saving={saving} sectionKey="cta" title="Manajemen Call-to-Action (Bawah)" description="Ubah teks ajakan login di bagian bawah halaman." fields={[...genericFields, { name: 'buttonText', label: 'Teks Tombol', type: 'text', placeholder: 'Contoh: Masuk ke Aplikasi' }]} />
            )}
            {activeTab === 'gallery' && <GalleryManager />}
          </>
        )}
      </div>
    </AppLayout>
  );
}
