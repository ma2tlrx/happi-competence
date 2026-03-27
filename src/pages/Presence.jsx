import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Download, CheckCircle, XCircle, Clock, Users } from 'lucide-react';

const STATUTS = ['présent', 'absent', 'retard'];

const statutConfig = {
  présent: { color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle, iconColor: 'text-emerald-500' },
  absent: { color: 'bg-red-50 border-red-200 text-red-700', icon: XCircle, iconColor: 'text-red-500' },
  retard: { color: 'bg-amber-50 border-amber-200 text-amber-700', icon: Clock, iconColor: 'text-amber-500' },
};

export default function Presence({ data, update }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const session = data.sessions?.find(s => s.id === sessionId);

  const [presences, setPresences] = useState(() => {
    const existing = data.presences?.[sessionId] || {};
    const initial = {};
    (session?.participants || []).forEach(pid => {
      initial[pid] = existing[pid] || 'présent';
    });
    return initial;
  });
  const [saved, setSaved] = useState(false);

  if (!session) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Session introuvable</p>
        <button onClick={() => navigate('/sessions')} className="btn-primary mx-auto mt-4">Retour</button>
      </div>
    );
  }

  const sessionParticipants = (session.participants || []).map(pid => data.participants?.find(p => p.id === pid)).filter(Boolean);

  const setAll = (statut) => {
    const updated = {};
    sessionParticipants.forEach(p => { updated[p.id] = statut; });
    setPresences(updated);
  };

  const handleSave = () => {
    update(prev => ({
      ...prev,
      presences: { ...prev.presences, [sessionId]: presences }
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const exportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF();
      pdf.setFontSize(16);
      pdf.text(`Feuille de présence - ${session.nom}`, 20, 20);
      pdf.setFontSize(11);
      pdf.text(`Date: ${session.date} à ${session.heure}`, 20, 30);
      pdf.text(`Lieu: ${session.lieu}`, 20, 37);
      let y = 50;
      pdf.setFontSize(10);
      pdf.text('Nom et Prénom', 20, y);
      pdf.text('Statut', 130, y);
      pdf.text('Signature', 165, y);
      y += 3;
      pdf.line(20, y, 190, y);
      y += 7;
      sessionParticipants.forEach(p => {
        pdf.text(`${p.prenom} ${p.nom}`, 20, y);
        pdf.text(presences[p.id] || '—', 130, y);
        y += 8;
        if (y > 270) { pdf.addPage(); y = 20; }
      });
      pdf.save(`presence_${session.nom}.pdf`);
    } catch (e) {
      alert('Erreur lors de l\'export PDF');
    }
  };

  const counts = { présent: 0, absent: 0, retard: 0 };
  Object.values(presences).forEach(v => { if (counts[v] !== undefined) counts[v]++; });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/sessions/${sessionId}`)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-slate-800">Feuille de présence</h2>
          <p className="text-sm text-slate-500">{session.nom} — {session.date}</p>
        </div>
        <button onClick={exportPDF} className="btn-secondary text-sm">
          <Download size={15} /> PDF
        </button>
        <button onClick={handleSave} className={`btn-primary text-sm ${saved ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}>
          <Save size={15} /> {saved ? 'Enregistré !' : 'Enregistrer'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(counts).map(([statut, count]) => {
          const conf = statutConfig[statut];
          const Icon = conf.icon;
          return (
            <div key={statut} className="card flex items-center gap-3">
              <Icon size={22} className={conf.iconColor} />
              <div>
                <p className="text-2xl font-bold text-slate-800">{count}</p>
                <p className="text-sm text-slate-500 capitalize">{statut}{count > 1 ? 's' : ''}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-slate-500 self-center mr-1">Marquer tout :</span>
        {STATUTS.map(s => (
          <button key={s} onClick={() => setAll(s)} className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${statutConfig[s].color}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Participants list */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Users size={16} className="text-blue-400" />
          <h3 className="font-semibold text-slate-800">{sessionParticipants.length} participant(s)</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {sessionParticipants.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">Aucun participant dans cette session</p>
          ) : (
            sessionParticipants.map((p, i) => (
              <div key={p.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-all">
                <span className="text-sm text-slate-400 w-6 flex-shrink-0">{i + 1}</span>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {p.prenom?.[0]}{p.nom?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{p.prenom} {p.nom}</p>
                  <p className="text-xs text-slate-400">{p.email || p.telephone}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {STATUTS.map(statut => {
                    const conf = statutConfig[statut];
                    const Icon = conf.icon;
                    const isSelected = presences[p.id] === statut;
                    return (
                      <button
                        key={statut}
                        onClick={() => setPresences(prev => ({ ...prev, [p.id]: statut }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${isSelected ? conf.color + ' shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                      >
                        <Icon size={12} />
                        {statut.charAt(0).toUpperCase() + statut.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
