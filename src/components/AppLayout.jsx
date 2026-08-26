import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import OfflineSyncIndicator from './OfflineSyncIndicator';
import BottomNavigation from './BottomNavigation';

export default function AppLayout({ children, title, showBackButton }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-100 print:bg-white relative">
      <div className="print:hidden">
        <OfflineSyncIndicator />
      </div>
      <div className="print:hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>
      
      <div className="flex-1 flex flex-col min-w-0">
        <div className="print:hidden">
          <Navbar
            title={title}
            showBackButton={showBackButton}
            onMenuToggle={() => setSidebarOpen(prev => !prev)}
          />
        </div>
        <main className="flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
}
