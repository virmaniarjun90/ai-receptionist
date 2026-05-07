import { Layout } from './components/Layout';
import { Conversations } from './pages/Conversations';
import { Dashboard } from './pages/Dashboard';
import { Properties } from './pages/Properties';

export default function App() {
  return (
    <Layout>
      {(page, setPage) => {
        if (page === 'properties') return <Properties />;
        if (page === 'conversations') return <Conversations />;
        return <Dashboard onNavigate={setPage} />;
      }}
    </Layout>
  );
}
