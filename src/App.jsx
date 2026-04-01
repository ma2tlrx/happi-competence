import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Participants from './pages/Participants';
import ParticipantDetail from './pages/ParticipantDetail';
import Sessions from './pages/Sessions';
import SessionDetail from './pages/SessionDetail';
import SessionPlayer from './pages/SessionPlayer';
import Presence from './pages/Presence';
import Evaluation from './pages/Evaluation';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import TalentPortal from './pages/TalentPortal';
import Baremes from './pages/Baremes';
import Ressources from './pages/Ressources';

export default function App() {
  const { data, update } = useStore();
  // Default: Espace Talent — formateur accesses via a link inside TalentPortal
  const [showFormateur, setShowFormateur] = useState(false);

  // ── Espace Formateur (authenticated) ──────────────────────────
  if (data.isLoggedIn) {
    // already logged in as formateur — go straight to the app
  } else if (showFormateur) {
    // formateur login page
    return (
      <Login
        users={data.users}
        onLogin={(user) => update({ isLoggedIn: true, user })}
        onBack={() => setShowFormateur(false)}
      />
    );
  } else if (!data.isLoggedIn) {
    // default: show Talent portal (login first)
    return (
      <TalentPortal
        data={data}
        update={update}
        onFormateurAccess={() => setShowFormateur(true)}
      />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Session Player : plein écran, hors Layout ── */}
        <Route path="/sessions/:id/player" element={<SessionPlayer data={data} update={update} />} />

        {/* ── Toutes les autres pages avec sidebar/header ── */}
        <Route path="/*" element={
          <Layout user={data.user} onLogout={() => update({ isLoggedIn: false })}>
            <Routes>
              <Route path="/" element={<Dashboard data={data} update={update} />} />
              <Route path="/participants" element={<Participants data={data} update={update} />} />
              <Route path="/participants/:id" element={<ParticipantDetail data={data} update={update} />} />
              <Route path="/sessions" element={<Sessions data={data} update={update} />} />
              <Route path="/sessions/:id" element={<SessionDetail data={data} update={update} />} />
              <Route path="/presence/:sessionId" element={<Presence data={data} update={update} />} />
              <Route path="/evaluation/:sessionId" element={<Evaluation data={data} update={update} />} />
              <Route path="/reports" element={<Reports data={data} update={update} />} />
              <Route path="/settings" element={<Settings data={data} update={update} />} />
              <Route path="/baremes" element={<Baremes data={data} update={update} />} />
              <Route path="/ressources" element={<Ressources data={data} update={update} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </BrowserRouter>
  );
}
