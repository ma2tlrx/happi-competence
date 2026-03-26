import { useState, useMemo } from 'react';
import { BarChart2, Download, TrendingUp, Users, Calendar } from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';

function avgScore(competences) {
  if (!competences) return 0;
  const vals = Object.values(competences);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export default function Reports({ data }) {
  const { participants, sessions, evaluations } = data;
  const [selectedP1, setSelectedP1] = useState(participants[0]?.id || '');
  const [selectedP2, setSelectedP2] = useState(participants[1]?.id || '');
  const [selectedSession, setSelectedSession] = useState('');

  const competenceKeys = useMemo(
    () => Object.keys(participants[0]?.competences || {}),
    [participants]
  );

  const p1 = participants.find(p => p.id === selectedP1);
  const p2 = participants.find(p => p.id === selectedP2);

  // Radar data for comparison
  const comparisonData = useMemo(() => {
    if (!p1) return [];
    return competenceKeys.map(k => ({
      subject: k.length > 12 ? k.slice(0, 12) + '…' : k,
      fullName: k,
      [p1.prenom + ' ' + p1.nom]: p1.competences?.[k] || 0,
      ...(p2 ? { [p2.prenom + ' ' + p2.nom]: p2.competences?.[k] || 0 } : {})
    }));
  }, [p1, p2, competenceKeys]);

  // Global average per competence
  const globalAvgData = useMemo(() => {
    return competenceKeys.map(k => ({
      name: k.length > 12 ? k.slice(0, 12) + '…' : k,
      fullName: k,
      moyenne: parseFloat((participants.reduce((sum, p) => sum + (p.competences?.[k] || 0), 0) / (participants.length || 1)).toFixed(2))
    }));
  }, [participants, competenceKeys]);

  // Session evaluation data
  const sessionEvalData = useMemo(() => {
    if (!selectedSession) return [];
    const session = sessions.find(s => s.id === selectedSession);
    if (!session) return [];
    const evals = evaluations?.[selectedSession] || {};
    return competenceKeys.map(k => {
      const scores = session.participants.map(pid => evals[pid]?.[k] || 0).filter(Boolean);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        name: k.length > 12 ? k.slice(0, 12) + '…' : k,
        fullName: k,
        moyenne: parseFloat(avg.toFixed(2))
      };
    });
  }, [selectedSession, sessions, evaluations, competenceKeys]);

  // Age distribution
  const ageDistrib = useMemo(() => {
    const map = {};
    participants.forEach(p => {
      const age = p.age || 'Non renseigné';
      map[age] = (map[age] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [participants]);

  // Niveau distribution
  const niveauDistrib = useMemo(() => {
    const map = {};
    participants.forEach(p => {
      const n = p.niveauEtudes || 'Non renseigné';
      map[n] = (map[n] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name: name.length > 15 ? name.slice(0, 15) + '…' : name, fullName: name, value }));
  }, [participants]);

  const exportCSV = () => {
    const headers = ['Prénom', 'Nom', 'Âge', 'Ville', 'Niveau', ...competenceKeys, 'Score moyen'];
    const rows = participants.map(p => [
      p.prenom, p.nom, p.age, p.residence, p.niveauEtudes,
      ...competenceKeys.map(k => p.competences?.[k] || 0),
      avgScore(p.competences).toFixed(2)
    ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'participants_competences.csv';
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={20} className="text-blue-500" />
          <h2 className="text-lg font-semibold text-slate-800">Rapports & Statistiques</h2>
        </div>
        <button onClick={exportCSV} className="btn-secondary text-sm">
          <Download size={15} /> Exporter CSV
        </button>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-blue-500">{participants.length}</p>
          <p className="text-sm text-slate-500 mt-1">Participants total</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-violet-500">{sessions.length}</p>
          <p className="text-sm text-slate-500 mt-1">Sessions total</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-emerald-500">
            {participants.length > 0 ? (participants.reduce((sum, p) => sum + avgScore(p.competences), 0) / participants.length).toFixed(1) : '—'}
          </p>
          <p className="text-sm text-slate-500 mt-1">Score moyen global</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-amber-500">
            {participants.length > 0 ? Math.max(...participants.map(p => avgScore(p.competences))).toFixed(1) : '—'}
          </p>
          <p className="text-sm text-slate-500 mt-1">Score maximum</p>
        </div>
      </div>

      {/* Comparison radar */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <h3 className="text-base font-semibold text-slate-800">Comparaison de participants</h3>
          <div className="flex gap-3 flex-wrap">
            <select
              value={selectedP1}
              onChange={e => setSelectedP1(e.target.value)}
              className="input w-auto text-sm"
            >
              {participants.map(p => (
                <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
              ))}
            </select>
            <select
              value={selectedP2}
              onChange={e => setSelectedP2(e.target.value)}
              className="input w-auto text-sm"
            >
              <option value="">— Comparer avec —</option>
              {participants.filter(p => p.id !== selectedP1).map(p => (
                <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
              ))}
            </select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={comparisonData}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
            {p1 && <Radar name={p1.prenom + ' ' + p1.nom} dataKey={p1.prenom + ' ' + p1.nom} stroke="#4F8EF7" fill="#4F8EF7" fillOpacity={0.25} strokeWidth={2} />}
            {p2 && <Radar name={p2.prenom + ' ' + p2.nom} dataKey={p2.prenom + ' ' + p2.nom} stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.15} strokeWidth={2} />}
            <Legend />
            <Tooltip
              formatter={(value, name, props) => [value + '/5', props.payload?.fullName || name]}
              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Global average bar chart */}
      <div className="card">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Moyennes globales par compétence</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={globalAvgData} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-40} textAnchor="end" interval={0} />
            <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip
              formatter={(value, name, props) => [value + '/5', props.payload?.fullName || name]}
              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
            />
            <Bar dataKey="moyenne" fill="#4F8EF7" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Session evaluation + distributions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Session evaluation */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Calendar size={16} className="text-blue-400" />
            <h3 className="text-base font-semibold text-slate-800">Évaluation par session</h3>
          </div>
          <select
            value={selectedSession}
            onChange={e => setSelectedSession(e.target.value)}
            className="input mb-4"
          >
            <option value="">Sélectionner une session</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.nom}</option>
            ))}
          </select>
          {selectedSession && sessionEvalData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sessionEvalData} margin={{ top: 5, right: 10, left: -10, bottom: 55 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-40} textAnchor="end" interval={0} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v, n, p) => [v + '/5', p.payload?.fullName || n]}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="moyenne" fill="#7C3AED" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">Sélectionnez une session pour voir les résultats</p>
          )}
        </div>

        {/* Niveau distribution */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Users size={16} className="text-violet-400" />
            <h3 className="text-base font-semibold text-slate-800">Répartition par niveau d'études</h3>
          </div>
          <div className="space-y-3">
            {niveauDistrib.map(({ name, fullName, value }) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-28 flex-shrink-0 truncate" title={fullName}>{fullName || name}</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-400 to-blue-500 rounded-full transition-all"
                    style={{ width: `${(value / participants.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-600 w-6 flex-shrink-0">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 10 participants table */}
      <div className="card">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Classement des participants</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                <th className="text-left py-2 px-3 font-medium">#</th>
                <th className="text-left py-2 px-3 font-medium">Participant</th>
                <th className="text-left py-2 px-3 font-medium">Âge</th>
                <th className="text-left py-2 px-3 font-medium">Score</th>
                <th className="text-left py-2 px-3 font-medium">Progression</th>
              </tr>
            </thead>
            <tbody>
              {[...participants]
                .sort((a, b) => avgScore(b.competences) - avgScore(a.competences))
                .slice(0, 10)
                .map((p, i) => {
                  const score = avgScore(p.competences);
                  return (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 px-3 text-sm text-slate-400">{i + 1}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                            {p.prenom?.[0]}{p.nom?.[0]}
                          </div>
                          <span className="text-sm font-medium text-slate-700">{p.prenom} {p.nom}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-sm text-slate-500">{p.age}</td>
                      <td className="py-2 px-3">
                        <span className={`badge ${score >= 4 ? 'bg-emerald-50 text-emerald-700' : score >= 3 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                          {score.toFixed(1)}/5
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-400 to-violet-500 rounded-full" style={{ width: `${(score / 5) * 100}%` }} />
                          </div>
                          <span className="text-xs text-slate-400">{Math.round((score / 5) * 100)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
