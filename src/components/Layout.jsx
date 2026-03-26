import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';

export default function Layout({ children, user, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
      else setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={[
          isMobile ? 'fixed inset-y-0 left-0 z-30' : 'relative flex-shrink-0',
          'transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <Sidebar
          user={user}
          onLogout={onLogout}
          isMobile={isMobile}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          user={user}
          onToggleSidebar={() => setSidebarOpen(v => !v)}
          onLogout={onLogout}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-safe-nav md:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom nav on mobile */}
      {isMobile && <BottomNav />}
    </div>
  );
}
