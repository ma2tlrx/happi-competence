import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, BarChart2, Settings, LogOut, Sparkles, X, SlidersHorizontal } from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { path: '/participants', icon: Users, label: 'Participants' },
  { path: '/sessions', icon: Calendar, label: 'Sessions' },
  { path: '/baremes', icon: SlidersHorizontal, label: 'Barèmes' },
  { path: '/reports', icon: BarChart2, label: 'Rapports' },
  { path: '/settings', icon: Settings, label: 'Paramètres' },
];

export default function Sidebar({ user, onLogout, onClose, isMobile }) {
  return (
    <aside className="w-64 h-screen flex flex-col bg-happi-teal">
      {/* Logo */}
      <div className="p-5 border-b border-happi-teal-light">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-happi-orange flex items-center justify-center shadow-orange">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="font-heading font-bold text-white text-sm leading-tight" style={{fontFamily:'Poppins,sans-serif'}}>Happi</p>
              <p className="text-xs text-happi-teal-muted">Compétence</p>
            </div>
          </div>
          {isMobile && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-happi-teal-muted hover:bg-happi-teal-light transition-colors">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            onClick={isMobile ? onClose : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-happi-orange text-white shadow-orange'
                  : 'text-happi-teal-muted hover:bg-happi-teal-light hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? 'text-white' : 'text-happi-teal-muted'} />
                <span style={{fontFamily:'DM Sans,sans-serif'}}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-happi-teal-light">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-2 bg-happi-teal-light rounded-xl">
          <div className="w-8 h-8 rounded-full bg-happi-orange flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate" style={{fontFamily:'DM Sans,sans-serif'}}>{user?.prenom} {user?.nom}</p>
            <p className="text-xs text-happi-teal-muted truncate">{user?.organisation}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-happi-teal-muted hover:bg-red-900/20 hover:text-red-400 transition-all duration-200"
          style={{fontFamily:'DM Sans,sans-serif'}}
        >
          <LogOut size={16} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
