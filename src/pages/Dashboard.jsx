import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Calendar, TrendingUp, Star, ArrowRight, CheckCircle,
  Clock, AlertCircle, Zap, BarChart2, Plus, ClipboardCheck,
  ChevronRight, Target, Activity,
} from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { format, isToday, isThisMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

function avgScore(competences) {
  if (!competences) return 0;
  const vals = Object.values(competences).filter(v => v != null);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function StatusBadge({ statut }) {
  const map = {
    'terminée': { cls: 'bg-green-50 text-green-700', icon: CheckCircle },
    'en cours': { cls: 'bg-blue-50 text-blue-700', icon: Clock },
    'à venir':  { cls: 'bg-amber-50 text-amber-700', icon: AlertCircle },
  };
  const { cls, icon: Icon } = map[statut] || map['à venir'];
  return (
    <span className={`badge ${cls} gap-1`}>
      <Icon size={11} /> {statut}
    </span>
  );
}

export default function Dashboard({ data, user }) {
  const navigate = useNavigate();
  const { participants, sessions, presences } = data;
  const today = new Date();

  /* ── Computed stats ── */
  const stats = useMemo(() => {
    const thisMonthSessions = sessions.filter(s => {
      try { return isThisMonth(new Date(s.date)); } catch { return false; }
    });
    let totalPresent = 0, totalParticipants = 0;
    Object.values(presences || {}).forEach(pmap =>
      Object.values(pmap).forEach(v => { totalParticipants++; if (v === 'présent') totalPresent++; })
    );
    const presenceRate = totalParticipants > 0 ? Math.round((totalPresent / totalParticipants) * 100) : 0;
    const avgComp = participants.length > 0
      ? (participants.reduce((s, p) => s + avgScore(p.competences), 0) / participants.length).toFixed(1)
      : '–';
    return { thisMonth: thisMonthSessions.length, total: sessions.length, presenceRate, avgComp };
  }, [participants, sessions, presences]);

  /* ── Today's / active sessions ── */
  const todaySessions = useMemo(() =>
    sessions.filter(s => {
      try { return isToday(new Date(s.date)) || s.statut === 'en cours'; } catch { return false; }
    }), [sessions]);

  /* ── Top 5 ── */
  const top5 = useMemo(() =>
    [...participants].sort((a, b) => avgScore(b.competences) - avgScore(a.competences)).slice(0, 5),
    [participants]);

  /* ── Radar data (6 CT categories) ── */
  const radarData = useMemo(() => {
    if (!participants.length) return [];
    const keys = Object.keys(participants[0]?.competences || {});
    return keys.map(k => ({
      subject: k.length > 13 ? k.slice(0, 13) + '…' : k,
      fullName: k,
      value: parseFloat((participants.reduce((s, p) => s + (p.competences?.[k] || 0), 0) / participants.length).toFixed(2)),
    }));
  }, [participants]);

  /* ── Recent sessions ── */
  const recentSessions = useMemo(() =>
    [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4),
    [sessions]);

  const greetHour = today.getHours();
  const greet = greetHour < 12 ? 'Bonjour' : greetHour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* ── Hero header ── */}
      <div className="rounded-3xl p-5 md:p-7 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#102C32 0%,#1E4A53 100%)' }}>
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-10" style={{ background: '#FF8650' }} />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-5" style={{ background: '#FF8650' }} />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium mb-1" style={{ color: '#8AABB0' }}>
              {greet} 👋 · {format(today, 'EEEE d MMMM', { locale: fr })}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight" style={{ fontFamily: 'Poppins,sans-serif' }}>
              {user?.prenom ? `${user.prenom} ${user.nom}` : 'Tableau de bord'}
            </h1>
            <p className="text-sm mt-1" style={{ color: '#8AABB0' }}>
              {participants.length} participants · {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={() => navigate('/sessions')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm self-start sm:self-auto flex-shrink-0 transition-all hover:scale-105"
            style={{ background: '#FF8650', color: 'white', boxShadow: '0 4px 20px rgba(255,134,80,0.4)', fontFamily: 'DM Sans,sans-serif' }}>
            <Plus size={16} /> Nouvelle session
          </button>
        </div>
      </div>

      {/* ── Session(s) du jour ── */}
      {todaySessions.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">
            🔴 Session{todaySessions.length > 1 ? 's' : ''} en cours · {todaySessions.length} active{todaySessions.length > 1 ? 's' : ''}
          </h2>
          <div className="space-y-3">
            {todaySessions.map(s => (
              <div key={s.id}
                className="rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                style={{ background: 'linear-gradient(135deg,#FFF7F3,#FFF1EB)', border: '2px solid #FFD4BC' }}>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: '#FF8650' }}>
                    <Zap size={22} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-happi-teal truncate" style={{ fontFamily: 'Poppins,sans-serif' }}>{s.nom}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.lieu && `${s.lieu} · `}{s.participants?.length || 0} participant{(s.participants?.length || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap">
                  <button onClick={() => navigate(`/presence/${s.id}`)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                    style={{ background: '#102C32', color: 'white' }}>
                    <ClipboardCheck size={14} /> Présences
                  </button>
                  <button onClick={() => navigate(`/evaluation/${s.id}`)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                    style={{ background: '#FF8650', color: 'white', boxShadow: '0 2px 10px rgba(255,134,80,0.3)' }}>
                    <Target size={14} /> Évaluer
                  </button>
                  <button onClick={() => navigate(`/sessions/${s.id}`)}
                    className="p-2 rounded-xl transition-all hover:bg-slate-100"
                    style={{ color: '#64748b' }}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Participants', value: participants.length, sub: 'inscrits',        icon: Users,      color: '#3B82F6', bg: '#EFF6FF' },
          { label: 'Ce mois',     value: stats.thisMonth,     sub: `/ ${stats.total} au total`, icon: Calendar,   color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Présence',    value: `${stats.presenceRate}%`, sub: 'toutes sessions', icon: Activity,   color: '#10B981', bg: '#ECFDF5' },
          { label: 'Score moyen', value: stats.avgComp !== '–' ? `${stats.avgComp}/5` : '–', sub: 'compétences CT', icon: Star, color: '#F59E0B', bg: '#FFFBEB' },
        ].map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="card flex items-start gap-3 p-4 md:p-5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-slate-800 leading-tight" style={{ fontFamily: 'Poppins,sans-serif' }}>{value}</p>
              <p className="text-xs font-semibold text-slate-600 truncate">{label}</p>
              <p className="text-[11px] text-slate-400 truncate">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Radar + Top 5 ── */}
      {(radarData.length > 0 || top5.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
          {/* Radar */}
          {radarData.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Compétences moyennes</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Tous participants confondus</p>
                </div>
                <button onClick={() => navigate('/reports')}
                  className="text-xs font-semibold flex items-center gap-1" style={{ color: '#FF8650' }}>
                  Rapports <ChevronRight size={13} />
                </button>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'DM Sans,sans-serif' }} />
                  <Radar name="Moyenne" dataKey="value" stroke="#FF8650" fill="#FF8650" fillOpacity={0.18} strokeWidth={2.5} dot={{ fill: '#FF8650', r: 3 }} />
                  <Tooltip
                    formatter={(v, _name, props) => [`${v}/5`, props.payload?.fullName]}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top 5 */}
          {top5.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Top participants</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Classés par score CT</p>
                </div>
                <button onClick={() => navigate('/participants')}
                  className="text-xs font-semibold flex items-center gap-1" style={{ color: '#FF8650' }}>
                  Tous <ChevronRight size={13} />
                </button>
              </div>
              <div className="space-y-2.5">
                {top5.map((p, i) => {
                  const score = avgScore(p.competences);
                  const pct = Math.min((score / 5) * 100, 100);
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={p.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 transition-all"
                      onClick={() => navigate(`/participants/${p.id}`)}>
                      <span className="text-base flex-shrink-0 w-6 text-center">
                        {medals[i] || <span className="text-xs font-bold text-slate-400">{i + 1}</span>}
                      </span>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, #FF8650, #E86A35)` }}>
                        {p.prenom?.[0]}{p.nom?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{p.prenom} {p.nom}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#FF8650,#7C3AED)' }} />
                          </div>
                          <span className="text-xs font-bold text-slate-600 flex-shrink-0">{score.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sessions récentes (cards) ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Sessions récentes</h2>
            <p className="text-xs text-slate-400 mt-0.5">{sessions.length} au total</p>
          </div>
          <button onClick={() => navigate('/sessions')}
            className="text-xs font-semibold flex items-center gap-1" style={{ color: '#FF8650' }}>
            Toutes <ChevronRight size={13} />
          </button>
        </div>
        {recentSessions.length === 0 ? (
          <div className="text-center py-10">
            <Calendar size={32} className="text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Aucune session créée</p>
            <button onClick={() => navigate('/sessions')}
              className="mt-3 text-sm font-semibold flex items-center gap-1 mx-auto" style={{ color: '#FF8650' }}>
              Créer une session <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {recentSessions.map(s => (
              <div key={s.id}
                className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all group"
                onClick={() => navigate(`/sessions/${s.id}`)}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: s.statut === 'en cours' ? '#FFF1EB' : s.statut === 'terminée' ? '#ECFDF5' : '#F8FAFF' }}>
                  {s.statut === 'en cours' ? <Zap size={16} style={{ color: '#FF8650' }} />
                    : s.statut === 'terminée' ? <CheckCircle size={16} style={{ color: '#10B981' }} />
                    : <Clock size={16} style={{ color: '#3B82F6' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{s.nom}</p>
                  <p className="text-xs text-slate-400">
                    {format(new Date(s.date), 'dd MMM yyyy', { locale: fr })}
                    {s.lieu && ` · ${s.lieu}`}
                    {` · ${s.participants?.length || 0} participants`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge statut={s.statut} />
                  <ChevronRight size={14} className="text-slate-200 group-hover:text-slate-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick actions (si pas de session active) ── */}
      {todaySessions.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Nouvelle session', sub: 'Planifier', icon: Plus,         color: '#FF8650', bg: '#FFF1EB', path: '/sessions' },
            { label: 'Participants',     sub: 'Gérer',     icon: Users,        color: '#3B82F6', bg: '#EFF6FF', path: '/participants' },
            { label: 'Rapports',         sub: 'Analyser',  icon: BarChart2,    color: '#7C3AED', bg: '#F5F3FF', path: '/reports' },
          ].map(({ label, sub, icon: Icon, color, bg, path }) => (
            <button key={label} onClick={() => navigate(path)}
              className="card flex items-center gap-4 p-4 hover:shadow-md transition-all group text-left">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon size={20} style={{ color }} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">{label}</p>
                <p className="text-xs text-slate-400">{sub}</p>
              </div>
              <ChevronRight size={16} className="ml-auto text-slate-200 group-hover:text-slate-400 transition-colors" />
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
