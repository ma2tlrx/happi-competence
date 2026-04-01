import { useState } from 'react';
import { FileText, Link2, Plus, Trash2, ExternalLink } from 'lucide-react';

const SESSION_LABELS = {
  sess_1: 'SESSION 1 - LA COMMUNICATION',
  sess_2: 'SESSION 2 - ADAPTABILITÉ & GESTION DU STRESS',
  sess_3: 'SESSION 3 - LEADERSHIP',
  sess_4: 'SESSION 4 - ANALYSE DES PROBLÈMES',
  sess_5: 'SESSION 5 - AUTONOMIE & COMPÉTITIVITÉ',
};

export default function Ressources({ data, update }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newRes, setNewRes] = useState({ nom: '', url: '', sessionId: '', type: 'lien' });

  const ressources = data.ressources || [];

  const handleAdd = () => {
    if (!newRes.nom.trim()) return;
    const res = {
      id: 'res_' + Date.now(),
      nom: newRes.nom.trim(),
      url: newRes.url.trim(),
      sessionId: newRes.sessionId || null,
      type: newRes.type,
      createdAt: new Date().toISOString(),
    };
    update(prev => ({
      ...prev,
      ressources: [...(prev.ressources || []), res],
    }));
    setNewRes({ nom: '', url: '', sessionId: '', type: 'lien' });
    setShowAdd(false);
  };

  const handleDelete = (id) => {
    update(prev => ({
      ...prev,
      ressources: (prev.ressources || []).filter(r => r.id !== id),
    }));
  };

  // Group by session
  const grouped = {};
  const unlinked = [];
  ressources.forEach(r => {
    if (r.sessionId && SESSION_LABELS[r.sessionId]) {
      if (!grouped[r.sessionId]) grouped[r.sessionId] = [];
      grouped[r.sessionId].push(r);
    } else {
      unlinked.push(r);
    }
  });

  // PDF files attached to sessions
  const sessionPdfs = (data.sessions || [])
    .filter(s => s.pdfUrl || s.pdfData)
    .map(s => ({ id: s.id, nom: s.nom, pdfUrl: s.pdfUrl }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-happi-teal font-heading">Ressources</h1>
          <p className="text-sm text-gray-500 mt-1">
            Documents et liens rattachés aux sessions de formation
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-happi-orange text-white font-semibold text-sm hover:bg-happi-orange-dark transition-colors shadow-orange"
        >
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
          <h3 className="text-sm font-semibold text-happi-teal">Nouvelle ressource</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nom</label>
              <input
                type="text"
                value={newRes.nom}
                onChange={e => setNewRes(p => ({ ...p, nom: e.target.value }))}
                placeholder="Ex: Guide du formateur"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-happi-orange/30 focus:border-happi-orange"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">URL / Lien</label>
              <input
                type="text"
                value={newRes.url}
                onChange={e => setNewRes(p => ({ ...p, url: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-happi-orange/30 focus:border-happi-orange"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={newRes.type}
                onChange={e => setNewRes(p => ({ ...p, type: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-happi-orange/30 focus:border-happi-orange"
              >
                <option value="lien">Lien</option>
                <option value="document">Document</option>
                <option value="video">Video</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Rattacher à une session</label>
              <select
                value={newRes.sessionId}
                onChange={e => setNewRes(p => ({ ...p, sessionId: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-happi-orange/30 focus:border-happi-orange"
              >
                <option value="">Aucune session</option>
                {Object.entries(SESSION_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              disabled={!newRes.nom.trim()}
              className="px-4 py-2 rounded-xl bg-happi-orange text-white text-sm font-semibold hover:bg-happi-orange-dark disabled:opacity-40 transition-colors"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      {/* Session PDFs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="text-sm font-bold text-happi-teal flex items-center gap-2">
            <FileText size={16} className="text-happi-orange" />
            Documents PDF des sessions
          </h2>
        </div>
        <div className="divide-y divide-gray-50">
          {sessionPdfs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Aucun PDF rattaché</p>
          ) : (
            sessionPdfs.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-happi-orange/10 flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-happi-orange" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-happi-teal truncate">{s.nom}</p>
                  <p className="text-xs text-gray-400">PDF rattaché</p>
                </div>
                <a
                  href={`/sessions/${s.id}/player`}
                  className="text-xs text-happi-orange hover:text-happi-orange-dark font-medium"
                >
                  Ouvrir
                </a>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Linked resources by session */}
      {Object.entries(grouped).map(([sessId, items]) => (
        <div key={sessId} className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-bold text-happi-teal flex items-center gap-2">
              <Link2 size={16} className="text-happi-orange" />
              {SESSION_LABELS[sessId]}
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {items.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-happi-teal/5 flex items-center justify-center flex-shrink-0">
                  <Link2 size={16} className="text-happi-teal-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-happi-teal truncate">{r.nom}</p>
                  <p className="text-xs text-gray-400 truncate">{r.type} {r.url && `· ${r.url}`}</p>
                </div>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-happi-orange transition-colors"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                <button
                  onClick={() => handleDelete(r.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Unlinked resources */}
      {unlinked.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-bold text-happi-teal flex items-center gap-2">
              <Link2 size={16} className="text-gray-400" />
              Ressources non rattachées
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {unlinked.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Link2 size={16} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-happi-teal truncate">{r.nom}</p>
                  <p className="text-xs text-gray-400 truncate">{r.type} {r.url && `· ${r.url}`}</p>
                </div>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-happi-orange transition-colors"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                <button
                  onClick={() => handleDelete(r.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {ressources.length === 0 && sessionPdfs.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-happi-orange/10 flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-happi-orange" />
          </div>
          <p className="text-gray-500 text-sm">Aucune ressource pour le moment</p>
          <p className="text-gray-400 text-xs mt-1">Ajoutez des documents ou liens pour vos sessions</p>
        </div>
      )}
    </div>
  );
}
