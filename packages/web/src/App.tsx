import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { Palmtree, Globe } from 'lucide-react';
import { LOCALES, Locale, useTranslation } from './i18n';
import { useMe } from './hooks/useMe';
import { MyDashboard } from './components/dashboard/MyDashboard';
import { Team } from './pages/Team';
import { Admin } from './pages/Admin';

function AdminRoute() {
  const me = useMe();
  if (me.isLoading) return null;
  if (me.data?.role !== 'admin') return <Navigate to="/" replace />;
  return <Admin />;
}

function App() {
  const { locale, setLocale, t } = useTranslation();
  const me = useMe();
  const isAdmin = me.data?.role === 'admin';

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="header-top">
            <div className="logo">
              <Palmtree size={32} />
              <h1>{t('app.title')}</h1>
            </div>
            <nav className="nav-links">
              <Link to="/">{t('nav.home')}</Link>
              <Link to="/team">{t('nav.team')}</Link>
              {isAdmin && <Link to="/admin">{t('nav.admin')}</Link>}
            </nav>
            <div className="header-controls">
              <label className="header-select">
                <Globe size={16} />
                <span className="sr-only">{t('header.language')}</span>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                  aria-label={t('header.language')}
                >
                  {LOCALES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeLabel}
                    </option>
                  ))}
                </select>
              </label>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<MyDashboard />} />
        <Route path="/team" element={<Team />} />
        <Route path="/admin" element={<AdminRoute />} />
      </Routes>
    </div>
  );
}

export default App;
