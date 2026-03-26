import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, BarChart2, Settings, SlidersHorizontal } from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Accueil' },
  { path: '/participants', icon: Users, label: 'Participants' },
  { path: '/sessions', icon: Calendar, label: 'Sessions' },
  { path: '/baremes', icon: SlidersHorizontal, label: 'Barèmes' },
  { path: '/reports', icon: BarChart2, label: 'Rapports' },
  { path: '/settings', icon: Settings, label: 'Réglages' },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md md:hidden"
      style={{
        boxShadow: '0 -1px 0 rgba(16,44,50,0.06), 0 -8px 24px rgba(16,44,50,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center h-16">
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className="flex-1 flex flex-col items-center justify-center h-full gap-0.5 relative"
          >
            {({ isActive }) => (
              <>
                {/* Active pill background */}
                {isActive && (
                  <span
                    className="absolute inset-x-2 top-2 bottom-2 rounded-2xl"
                    style={{ background: 'rgba(255,134,80,0.1)' }}
                  />
                )}
                <div
                  className="relative z-10 w-7 h-7 flex items-center justify-center rounded-xl transition-all duration-200"
                  style={isActive ? { color: '#FF8650' } : { color: '#94A3B8' }}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                </div>
                <span
                  className="relative z-10 text-[10px] font-semibold transition-colors duration-200 leading-none"
                  style={isActive ? { color: '#FF8650', fontFamily: 'DM Sans,sans-serif' } : { color: '#94A3B8', fontFamily: 'DM Sans,sans-serif' }}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
