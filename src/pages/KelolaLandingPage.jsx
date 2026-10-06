import { useState } from 'react';
import AppLayout from '../components/AppLayout';
import GalleryManager from '../features/admin/landing/GalleryManager';

export default function KelolaLandingPage() {
  const [activeTab, setActiveTab] = useState('gallery');

  return (
    <AppLayout title="Pengaturan Landing Page" showBackButton={false}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6 rounded-2xl bg-white p-2 shadow-sm border border-slate-100 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('gallery')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'gallery'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <i className="fas fa-images mr-2" />
            Galeri (Foto & Video)
          </button>
        </div>

        {activeTab === 'gallery' && <GalleryManager />}
      </div>
    </AppLayout>
  );
}
