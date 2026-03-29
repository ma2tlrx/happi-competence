import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, BarChart2, Settings, LogOut, SlidersHorizontal, ChevronLeft } from 'lucide-react';
import logo from '../assets/logo.png';

const navSections = [
  {
    label: 'Principal',
    items: [
      { path: '/',             icon: LayoutDashboard,  label: 'Tableau de bord' },
      { path: '/participants', icon: Users,             label: 'Participants'    },
      { path: '/sessions',     icon: Calendar,          label: 'Sessions'        },
      { path: '/reports',      icon: BarChart2,         label: 'Rapports'        },
    ],
  },
  {
    label: 'Outils',
    items: [
      { path: '/baremes',  icon: SlidersHorizontal, label: 'Barèmes'    },
      { path: '/settings', icon: Settings,          label: 'Paramètres' },
    ],
  },
];

export default function Sidebar({ user, onLogout, onClose, isMobile }) {
  return (
    <aside className="w-64 h-screen flex flex-col bg-happi-teal select-none">

      {/* ── Header : logo + collapse ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-happi-teal-light">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Happi" className="w-9 h-9 rounded-xl object-contain bg-white flex-shrink-0" />
          <div>
            <p className="font-bold text-white text-sm leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Happi
            </p>
            <p className="text-[11px] text-happi-teal-muted leading-tight">Compétence</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-happi-teal-muted hover:bg-happi-teal-light hover:text-white transition-colors"
          title="Réduire"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* ── Navigation par sections ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.map(section => (
          <div key={section.label}>
            {/* Section label */}
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-happi-teal-muted px-3 mb-1.5">
              {section.label}
            </p>

            {/* Items */}
            <div className="space-y-0.5">
              {section.items.map(({ path, icon: Icon, label }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === '/'}
                  onClick={isMobile ? onClose : undefined}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-happi-orange text-white shadow-orange'
                        : 'text-happi-teal-muted hover:bg-happi-teal-light hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={17}
                        className={`flex-shrink-0 transition-colors ${
                          isActive ? 'text-white' : 'text-happi-teal-muted group-hover:text-white'
                        }`}
                      />
                      <span className="truncate">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Pied de page : user + déconnexion ── */}
      <div className="px-3 py-4 border-t border-happi-teal-light space-y-1">
        {/* User card */}
        <div className="flex items-center gap-3 px-3 py-2.5 bg-happi-teal-light rounded-xl">
          <div className="w-8 h-8 rounded-full bg-happi-orange flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {user?.prenom} {user?.nom}
            </p>
            <p className="text-[11px] text-happi-teal-muted truncate">{user?.organisation}</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-happi-teal-muted hover:bg-red-900/20 hover:text-red-400 transition-all duration-150"
        >
          <LogOut size={17} className="flex-shrink-0" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
