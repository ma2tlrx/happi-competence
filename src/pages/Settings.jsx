import { useState } from 'react';
import { Save, User, Shield, Database, Download, Upload, RefreshCw, AlertTriangle, Check, Users, Plus, Trash2, Eye, EyeOff, Crown } from 'lucide-react';
import { initialParticipants, initialSessions, initialPresences, initialEvaluations } from '../data/initialData';

export default function Settings({ data, update }) {
  const { user } = data;
  const isAdmin = user.id === 'admin' || user.role === 'admin';

  const [profileForm, setProfileForm] = useState({ ...user });
  const [profileSaved, setProfileSaved] = useState(false);
  const [newPassword, setNewPassword]   = useState('');
  const [confirmPwd, setConfirmPwd]     = useState('');
  const [pwdError, setPwdError]         = useState('');
  const [pwdSaved, setPwdSaved]         = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [importError, setImportError]   = useState('');

  // Account management (admin only)
  const [newAccount, setNewAccount]       = useState({ prenom: '', nom: '', email: '', password: '', organisation: '', role: 'formateur' });
  const [accountError, setAccountError]   = useState('');
  const [accountSaved, setAccountSaved]   = useState(false);
  const [showNewPwd, setShowNewPwd]       = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const saveProfile = () => {
    update(prev => ({ ...prev, user: { ...profileForm } }));
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const savePassword = () => {
    setPwdError('');
    if (newPassword.length < 6) { setPwdError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (newPassword !== confirmPwd) { setPwdError('Les mots de passe ne correspondent pas.'); return; }
    update(prev => ({ ...prev, user: { ...prev.user, password: newPassword } }));
    setNewPassword(''); setConfirmPwd(''); setPwdSaved(true);
    setTimeout(() => setPwdSaved(false), 2000);
  };

  const createAccount = () => {
    setAccountError('');
    const { prenom, nom, email, password, role } = newAccount;
    if (!email.trim()) { setAccountError("L'email est requis."); return; }
    if (password.length < 6) { setAccountError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    const users = data.users || [];
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      setAccountError('Un compte avec cet email existe déjà.'); return;
    }
    const account = {
      id: 'user_' + Date.now(),
      email: email.trim(),
      password,
      nom: nom.trim(),
      prenom: prenom.trim(),
      organisation: newAccount.organisation.trim() || user.organisation,
      role: role || 'formateur',
    };
    update(prev => ({ ...prev, users: [...(prev.users || []), account] }));
    setNewAccount({ prenom: '', nom: '', email: '', password: '', organisation: '', role: 'formateur' });
    setAccountSaved(true);
    setTimeout(() => setAccountSaved(false), 2000);
  };

  const deleteAccount = (id) => {
    update(prev => ({ ...prev, users: (prev.users || []).filter(u => u.id !== id) }));
    setDeleteConfirm(null);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'happi_backup_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.participants && parsed.sessions) {
          update(() => ({ ...parsed, isLoggedIn: true }));
          setImportError('');
          alert('Données importées avec succès !');
        } else {
          setImportError('Format de fichier invalide');
        }
      } catch {
        setImportError('Impossible de lire le fichier');
      }
    };
    reader.readAsText(file);
  };

  const resetData = () => {
    update(() => ({
      user: data.user,
      users: data.users,
      participants: initialParticipants,
      sessions: initialSessions,
      presences: initialPresences,
      evaluations: initialEvaluations,
      isLoggedIn: true
    }));
    setResetConfirm(false);
  };

  return (
    <div className="space-y-6 w-full max-w-4xl">

      {/* Profile + Sécurité côte à côte sur PC */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Profile */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <User size={18} className="text-blue-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">Profil formateur</h2>
            <p className="text-sm text-slate-500">Informations personnelles et organisation</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Prénom', key: 'prenom' },
            { label: 'Nom', key: 'nom' },
            { label: 'Email', key: 'email', type: 'email' },
            { label: 'Organisation', key: 'organisation' },
          ].map(({ label, key, type = 'text' }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type={type}
                value={profileForm[key] || ''}
                onChange={e => setProfileForm(f => ({ ...f, [key]: e.target.value }))}
                className="input"
              />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <button onClick={saveProfile} className={`btn-primary text-sm ${profileSaved ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}>
            {profileSaved ? <><Check size={15} /> Enregistré !</> : <><Save size={15} /> Enregistrer</>}
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
            <Shield size={18} className="text-violet-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">Sécurité</h2>
            <p className="text-sm text-slate-500">Mot de passe et accès</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nouveau mot de passe</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setPwdError(''); }}
              placeholder="••••••••"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirmer</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); }}
              placeholder="••••••••"
              className={`input ${pwdError ? 'border-red-300' : ''}`}
            />
          </div>
        </div>
        {pwdError && <p className="text-sm text-red-500 mt-2">{pwdError}</p>}
        <div className="mt-4">
          <button onClick={savePassword} className={`btn-secondary text-sm ${pwdSaved ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500' : ''}`}>
            {pwdSaved ? <><Check size={15} /> Modifié !</> : <><Save size={15} /> Changer le mot de passe</>}
          </button>
        </div>
      </div>

      </div>{/* end lg:grid-cols-2 */}

      {/* Account management — admin only */}
      {isAdmin && (
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Users size={18} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Gestion des comptes</h2>
              <p className="text-sm text-slate-500">Créer et gérer les accès formateurs et admins</p>
            </div>
          </div>

          {/* Existing accounts */}
          <div className="space-y-2 mb-6">
            {(data.users || []).map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-sm font-semibold text-emerald-700 flex-shrink-0">
                    {(u.prenom?.[0] || u.email[0]).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-700 truncate">{u.prenom} {u.nom} {u.id === user.id && <span className="text-xs text-slate-400">(vous)</span>}</p>
                      {(u.role === 'admin' || u.id === 'admin') && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                          <Crown size={9} /> Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                </div>
                {u.id !== user.id && u.id !== 'admin' && (
                  <button onClick={() => setDeleteConfirm(u.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Create new account */}
          <div className="border-t border-slate-100 pt-5">
            <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Plus size={15} /> Créer un nouveau compte</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Prénom', key: 'prenom' },
                { label: 'Nom', key: 'nom' },
                { label: 'Email', key: 'email', type: 'email' },
                { label: 'Organisation', key: 'organisation' },
              ].map(({ label, key, type = 'text' }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                  <input type={type} value={newAccount[key]} onChange={e => setNewAccount(f => ({ ...f, [key]: e.target.value }))} className="input text-sm" placeholder={label} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe</label>
                <div className="relative">
                  <input type={showNewPwd ? 'text' : 'password'} value={newAccount.password} onChange={e => { setNewAccount(f => ({ ...f, password: e.target.value })); setAccountError(''); }} className={`input text-sm pr-10 w-full ${accountError ? 'border-red-300' : ''}`} placeholder="Min. 6 caractères" />
                  <button type="button" onClick={() => setShowNewPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNewPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Rôle</label>
                <select
                  value={newAccount.role}
                  onChange={e => setNewAccount(f => ({ ...f, role: e.target.value }))}
                  className="input text-sm"
                >
                  <option value="formateur">Formateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
            </div>
            {accountError && <p className="text-sm text-red-500 mt-2">{accountError}</p>}
            <div className="mt-3">
              <button onClick={createAccount} className={`btn-primary text-sm ${accountSaved ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}>
                {accountSaved ? <><Check size={15} /> Compte créé !</> : <><Plus size={15} /> Créer le compte</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data management */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Database size={18} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">Gestion des données</h2>
            <p className="text-sm text-slate-500">Exporter, importer ou réinitialiser</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-2xl gap-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Exporter les données</p>
              <p className="text-xs text-slate-400 mt-0.5">Sauvegarde complète en JSON</p>
            </div>
            <button onClick={exportData} className="btn-secondary text-sm self-start sm:self-auto">
              <Download size={15} /> Exporter
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-2xl gap-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Importer des données</p>
              <p className="text-xs text-slate-400 mt-0.5">Restaurer depuis un fichier JSON</p>
            </div>
            <label className="btn-secondary text-sm cursor-pointer self-start sm:self-auto">
              <Upload size={15} /> Importer
              <input type="file" accept=".json" onChange={importData} className="hidden" />
            </label>
          </div>
          {importError && <p className="text-sm text-red-500">{importError}</p>}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-100 gap-3">
            <div>
              <p className="text-sm font-medium text-red-700">Réinitialiser les données</p>
              <p className="text-xs text-red-400 mt-0.5">Revenir aux données d'origine — action irréversible</p>
            </div>
            <button onClick={() => setResetConfirm(true)} className="btn-danger text-sm self-start sm:self-auto">
              <RefreshCw size={15} /> Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* App info */}
      <div className="card bg-gradient-to-br from-blue-50 to-violet-50 border-blue-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-lg">✦</span>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Happi Compétence — Plateforme Formateur</p>
            <p className="text-sm text-slate-500">Version 1.0.0 · {data.participants?.length || 0} participants · {data.sessions?.length || 0} sessions</p>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Supprimer ce compte ?</h3>
            <p className="text-sm text-slate-500 mb-6">
              {(data.users || []).find(u => u.id === deleteConfirm)?.email}<br/>
              Cette action est irréversible.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Annuler</button>
              <button onClick={() => deleteAccount(deleteConfirm)} className="btn-danger">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirm Modal */}
      {resetConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Réinitialiser toutes les données ?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Toutes les modifications seront perdues. Les données d'origine seront restaurées.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setResetConfirm(false)} className="btn-secondary">Annuler</button>
              <button onClick={resetData} className="btn-danger">Réinitialiser</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
