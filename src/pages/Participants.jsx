import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, ArrowRight, Filter, X, UserPlus } from 'lucide-react';

function avgScore(competences) {
  if (!competences) return 0;
  const vals = Object.values(competences);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function ScoreBadge({ score }) {
  const s = parseFloat(score);
  const color = s >= 4 ? 'bg-emerald-50 text-emerald-700' : s >= 3 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700';
  return <span className={`badge ${color}`}>{s.toFixed(1)}/5</span>;
}

const EMPTY_FORM = {
  prenom: '', nom: '', email: '', telephone: '', age: '19 - 21 ans',
  residence: '', village: '', niveauEtudes: '', domainesEtudes: '',
  etablissement: '', ambitions: '', experiences: 'Non', benevole: 'Non'
};

export default function Participants({ data, update }) {
  const navigate = useNavigate();
  const { participants } = data;

  const [search, setSearch] = useState('');
  const [filterAge, setFilterAge] = useState('');
  const [filterVille, setFilterVille] = useState('');
  const [filterNiveau, setFilterNiveau] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const filtered = useMemo(() => {
    return participants.filter(p => {
      const fullName = `${p.prenom} ${p.nom}`.toLowerCase();
      const q = search.toLowerCase();
      if (q && !fullName.includes(q) && !(p.email || '').toLowerCase().includes(q) && !(p.residence || '').toLowerCase().includes(q)) return false;
      if (filterAge && p.age !== filterAge) return false;
      if (filterVille && p.residence !== filterVille) return false;
      if (filterNiveau && p.niveauEtudes !== filterNiveau) return false;
      return true;
    });
  }, [participants, search, filterAge, filterVille, filterNiveau]);

  const ages = [...new Set(participants.map(p => p.age).filter(Boolean))].sort();
  const villes = [...new Set(participants.map(p => p.residence).filter(Boolean))].sort();
  const niveaux = [...new Set(participants.map(p => p.niveauEtudes).filter(Boolean))].sort();

  const handleAdd = () => {
    const id = 'p' + Date.now();
    const competences = {};
    const COMPETENCE_KEYS = ["Relationnel","Esprit d'équipe","Compréhension","Sensibilité sociale","Adaptation relationnelle","Coopération","Planification","Traitement de l'information"];
    COMPETENCE_KEYS.forEach(k => { competences[k] = 3; });
    const newP = {
      ...form,
      id,
      village: form.village || null,
      competences,
      dateInscription: new Date().toISOString().split('T')[0],
      tags: [],
      sessions: []
    };
    update(prev => ({ ...prev, participants: [...prev.participants, newP] }));
    setShowModal(false);
    setForm(EMPTY_FORM);
  };

  const handleDelete = (id) => {
    update(prev => ({ ...prev, participants: prev.participants.filter(p => p.id !== id) }));
    setDeleteConfirm(null);
  };

  const hasFilters = filterAge || filterVille || filterNiveau;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un participant..."
            className="input pl-10"
          />
        </div>

        <select value={filterAge} onChange={e => setFilterAge(e.target.value)} className="input w-auto min-w-32">
          <option value="">Tous les âges</option>
          {ages.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <select value={filterVille} onChange={e => setFilterVille(e.target.value)} className="input w-auto min-w-36">
          <option value="">Toutes les villes</option>
          {villes.map(v => <option key={v} value={v}>{v}</option>)}
        </select>

        <select value={filterNiveau} onChange={e => setFilterNiveau(e.target.value)} className="input w-auto min-w-36">
          <option value="">Tous les niveaux</option>
          {niveaux.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        {hasFilters && (
          <button onClick={() => { setFilterAge(''); setFilterVille(''); setFilterNiveau(''); }} className="btn-secondary gap-1 text-sm">
            <X size={14} /> Effacer
          </button>
        )}

        <button onClick={() => setShowModal(true)} className="btn-primary ml-auto">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Count */}
      <p className="text-sm text-slate-500">{filtered.length} participant{filtered.length > 1 ? 's' : ''} {hasFilters || search ? 'trouvé' + (filtered.length > 1 ? 's' : '') : 'au total'}</p>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-xs text-slate-500">
                <th className="text-left py-3 px-4 font-medium">Participant</th>
                <th className="text-left py-3 px-4 font-medium">Contact</th>
                <th className="text-left py-3 px-4 font-medium">Âge</th>
                <th className="text-left py-3 px-4 font-medium">Localisation</th>
                <th className="text-left py-3 px-4 font-medium">Niveau</th>
                <th className="text-left py-3 px-4 font-medium">Score moy.</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const score = avgScore(p.competences);
                const ville = p.village ? `${p.village}` : p.residence;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-slate-50 hover:bg-blue-50/30 cursor-pointer transition-all"
                    onClick={() => navigate(`/participants/${p.id}`)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {p.prenom?.[0] || '?'}{p.nom?.[0] || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{p.prenom} {p.nom}</p>
                          {p.tags?.includes('doublon') && (
                            <span className="badge bg-orange-50 text-orange-600 text-xs">doublon</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-slate-600">{p.email || '—'}</p>
                      <p className="text-xs text-slate-400">{p.telephone}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">{p.age}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{ville}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{p.niveauEtudes || '—'}</td>
                    <td className="py-3 px-4"><ScoreBadge score={score} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/participants/${p.id}`)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
                        >
                          <ArrowRight size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(p.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    Aucun participant trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white w-full md:max-w-2xl md:rounded-3xl rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <UserPlus size={20} className="text-blue-500" />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">Ajouter un participant</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              {[
                { label: 'Prénom', key: 'prenom' },
                { label: 'Nom', key: 'nom' },
                { label: 'Email', key: 'email', type: 'email' },
                { label: 'Téléphone', key: 'telephone' },
                { label: 'Lieu de résidence', key: 'residence' },
                { label: 'Village (si hors ville)', key: 'village' },
                { label: 'Établissement', key: 'etablissement' },
                { label: 'Domaines d\'études', key: 'domainesEtudes' },
              ].map(({ label, key, type = 'text' }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="input"
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Ambitions professionnelles</label>
                <input
                  type="text"
                  value={form.ambitions}
                  onChange={e => setForm(f => ({ ...f, ambitions: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tranche d'âge</label>
                <select value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} className="input">
                  {['16 - 18 ans','19 - 21 ans','22 - 24 ans','25 - 28 ans','29 - 35 ans','36 ans et +'].map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Niveau d'études</label>
                <select value={form.niveauEtudes} onChange={e => setForm(f => ({ ...f, niveauEtudes: e.target.value }))} className="input">
                  {['Aucun diplôme','Brevet des collèges','CAP/BEP','Bac général','Bac technologique','Bac professionnel','Bac+1','Bac+2','Bac+3','Bac+4','Bac+5','Bac+5 et +'].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-4 md:p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
              <button onClick={handleAdd} className="btn-primary" disabled={!form.prenom || !form.nom}>
                <Plus size={16} /> Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white w-full md:max-w-sm md:rounded-3xl rounded-t-3xl shadow-2xl p-6 text-center">
            <div className="md:hidden flex justify-center pb-4">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Supprimer le participant ?</h3>
            <p className="text-sm text-slate-500 mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Annuler</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
