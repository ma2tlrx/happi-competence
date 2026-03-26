import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Bell, Search, X, User, Settings, LogOut, Sparkles } from 'lucide-react';

const pageTitles = {
  '/': 'Tableau de bord',
  '/participants': 'Participants',
  '/sessions': 'Sessions',
  '/reports': 'Rapports',
  '/settings': 'Paramètres',
};

export default function Header({ user, onToggleSidebar, onLogout }) {
  const location = useLocation();
  const navigate   = useNavigate();
  const [search, setSearch]           = useState('');
  const [searchOpen, setSearchOpen]   = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const getTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/participants/')) return 'Détail participant';
    if (path.startsWith('/sessions/')) return 'Détail session';
    if (path.startsWith('/presence/')) return 'Feuille de présence';
    if (path.startsWith('/evaluation/')) return 'Évaluation';
    return pageTitles[path] || 'Happi Compétence';
  };

  return (
    <header className="h-14 md:h-16 bg-white border-b border-slate-100 flex items-center px-4 md:px-6 gap-3 flex-shrink-0" style={{boxShadow:'0 1px 4px rgba(16,44,50,0.06)'}}>
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-xl text-slate-400 hover:bg-happi-orange-light hover:text-happi-orange transition-all"
      >
        <Menu size={20} />
      </button>

      {!searchOpen && (
        <h1 className="text-base md:text-lg font-semibold text-happi-teal truncate" style={{fontFamily:'Poppins,sans-serif'}}>{getTitle()}</h1>
      )}

      <div className={`flex-1 flex items-center justify-end gap-2 ${searchOpen ? 'w-full' : ''}`}>
        {searchOpen ? (
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-9"
              />
            </div>
            <button onClick={() => { setSearchOpen(false); setSearch(''); }} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
        ) : (
          <>
            <div className="hidden md:block relative max-w-xs w-full">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-9"
              />
            </div>

            <button
              onClick={() => setSearchOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-400 hover:bg-happi-orange-light hover:text-happi-orange transition-all"
            >
              <Search size={20} />
            </button>

            <button className="relative p-2 rounded-xl text-slate-400 hover:bg-happi-orange-light hover:text-happi-orange transition-all">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-happi-orange rounded-full" />
            </button>

            {/* ── Avatar bubble → profil dropdown ── */}
            <div className="relative">
              <button
                onClick={() => setShowProfile(v => !v)}
                className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-happi-orange flex items-center justify-center text-white text-xs font-bold flex-shrink-0 transition-transform active:scale-95"
                style={{ boxShadow: showProfile ? '0 0 0 3px rgba(255,134,80,0.3)' : '0 2px 8px rgba(255,134,80,0.35)', fontFamily: 'Poppins,sans-serif' }}
                aria-label="Mon profil"
              >
                {user?.prenom?.[0]}{user?.nom?.[0]}
              </button>

              {showProfile && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />

                  {/* Dropdown */}
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl z-50 overflow-hidden"
                    style={{ boxShadow: '0 8px 40px rgba(16,44,50,0.18)', border: '1px solid rgba(0,0,0,0.06)' }}>

                    {/* En-tête profil */}
                    <div className="px-4 py-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,#102C32,#1A3F48)' }}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                        style={{ background: 'rgba(255,134,80,0.3)', border: '2px solid rgba(255,134,80,0.5)', fontFamily: 'Poppins,sans-serif' }}>
                        {user?.prenom?.[0]}{user?.nom?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white leading-tight truncate">{user?.prenom} {user?.nom}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: '#8AABB0' }}>Formateur</p>
                        {user?.organisation && (
                          <p className="text-[10px] mt-0.5 truncate" style={{ color: '#8AABB0' }}>{user.organisation}</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-2">
                      <button
                        onClick={() => { navigate('/settings'); setShowProfile(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-happi-teal transition-colors hover:bg-slate-50 active:bg-slate-100">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#FFF1EB' }}>
                          <User size={14} style={{ color: '#FF8650' }} />
                        </div>
                        Mon profil
                      </button>
                      <button
                        onClick={() => { navigate('/settings'); setShowProfile(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-happi-teal transition-colors hover:bg-slate-50 active:bg-slate-100">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#EFF6FF' }}>
                          <Settings size={14} style={{ color: '#3B82F6' }} />
                        </div>
                        Paramètres
                      </button>
                      <div className="my-1.5 border-t border-slate-100" />
                      <button
                        onClick={() => { setShowProfile(false); onLogout?.(); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-red-50 active:bg-red-100"
                        style={{ color: '#EF4444' }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#FEF2F2' }}>
                          <LogOut size={14} style={{ color: '#EF4444' }} />
                        </div>
                        Se déconnecter
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
