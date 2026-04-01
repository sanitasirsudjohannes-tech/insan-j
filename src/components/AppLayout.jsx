import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function AppLayout({ children, title, showBackButton }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          title={title}
          showBackButton={showBackButton}
          onMenuToggle={() => setSidebarOpen(prev => !prev)}
        />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
