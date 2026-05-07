import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Conversations } from './pages/Conversations';
import { Dashboard } from './pages/Dashboard';
import { GuestRegistration } from './pages/GuestRegistration';
import { Properties } from './pages/Properties';

export default function App() {
  return (
    <Routes>
      {/* Public — no sidebar, no auth */}
      <Route path="/register" element={<GuestRegistration />} />

      {/* Admin dashboard */}
      <Route
        path="/*"
        element={
          <Layout>
            {(page, setPage) => {
              if (page === 'properties') return <Properties />;
              if (page === 'conversations') return <Conversations />;
              return <Dashboard onNavigate={setPage} />;
            }}
          </Layout>
        }
      />
    </Routes>
  );
}
