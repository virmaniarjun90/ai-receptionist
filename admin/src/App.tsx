import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from './api';
import { Layout } from './components/Layout';
import { Config } from './pages/Config';
import { Conversations } from './pages/Conversations';
import { Dashboard } from './pages/Dashboard';
import { GuestRegistration } from './pages/GuestRegistration';
import { Login } from './pages/Login';
import { Properties } from './pages/Properties';
import { Home } from './pages/Home';
import { HostLogin } from './pages/HostLogin';
import { HostDashboard } from './pages/HostDashboard';

export default function App() {
  const [authed, setAuthed] = useState(() => api.auth.isLoggedIn());

  const handleLogout = () => {
    api.auth.logout();
    setAuthed(false);
  };

  return (
    <Routes>
      {/* Root redirects to /main */}
      <Route path="/" element={<Navigate to="/main" replace />} />

      {/* Landing page - choose Admin or Host */}
      <Route path="/main" element={<Home />} />

      {/* Guest registration */}
      <Route path="/register" element={<GuestRegistration />} />

      {/* Admin Portal */}
      <Route
        path="/admin/login"
        element={
          !authed ? (
            <Login onLogin={() => setAuthed(true)} />
          ) : (
            <Navigate to="/admin" replace />
          )
        }
      />
      <Route
        path="/admin/*"
        element={
          !authed ? (
            <Navigate to="/admin/login" replace />
          ) : (
            <Layout onLogout={handleLogout}>
              {(page, setPage) => {
                if (page === 'properties') return <Properties />;
                if (page === 'conversations') return <Conversations />;
                if (page === 'config') return <Config />;
                return <Dashboard onNavigate={setPage} />;
              }}
            </Layout>
          )
        }
      />

      {/* Host Portal */}
      <Route path="/host/login" element={<HostLogin />} />
      <Route path="/host/*" element={<HostDashboard />} />
    </Routes>
  );
}
