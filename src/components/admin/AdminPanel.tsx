import { Shield, Users, UserCheck } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminUsers, useAdminVacations } from '../../hooks/useAdmin';
import { UserTable } from './UserTable';
import { SettingsCard } from './SettingsCard';

export function AdminPanel() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const usersQuery = useAdminUsers(isAdmin);
  const vacationsQuery = useAdminVacations(isAdmin);

  if (!isAdmin) return null;

  const users = usersQuery.data ?? [];
  const activeCount = users.filter((u) => u.isActive).length;
  const loading = usersQuery.isLoading || vacationsQuery.isLoading;
  const error = usersQuery.isError || vacationsQuery.isError;

  return (
    <main className="main admin-page">
      <header className="admin-hero">
        <div className="admin-hero-text">
          <div className="admin-hero-badge">
            <Shield size={16} strokeWidth={2.25} aria-hidden="true" />
            <span>{t('nav.admin')}</span>
          </div>
          <h1 className="admin-hero-title">{t('admin.title')}</h1>
          <p className="admin-hero-subtitle">{t('admin.subtitle')}</p>
        </div>
        {!loading && !error && (
          <div className="admin-stats">
            <div className="admin-stat-card">
              <span className="admin-stat-icon admin-stat-icon--users">
                <Users size={18} aria-hidden="true" />
              </span>
              <div className="admin-stat-body">
                <span className="admin-stat-value">{users.length}</span>
                <span className="admin-stat-label">{t('admin.statUsers')}</span>
              </div>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-icon admin-stat-icon--active">
                <UserCheck size={18} aria-hidden="true" />
              </span>
              <div className="admin-stat-body">
                <span className="admin-stat-value">{activeCount}</span>
                <span className="admin-stat-label">{t('admin.statActive')}</span>
              </div>
            </div>
          </div>
        )}
      </header>

      {loading ? (
        <div className="admin-loading">
          <div className="admin-loading-pulse" aria-hidden="true" />
          <p>{t('common.loading')}</p>
        </div>
      ) : error ? (
        <div className="admin-error">{t('common.loadFailed')}</div>
      ) : (
        <div className="admin-layout">
          <UserTable users={users} allRecords={vacationsQuery.data ?? []} />
          <SettingsCard />
        </div>
      )}
    </main>
  );
}
