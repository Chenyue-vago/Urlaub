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

  return (
    <main className="main">
      <h1 className="admin-heading">{t('admin.title')}</h1>
      {usersQuery.isLoading || vacationsQuery.isLoading ? (
        <div className="app-loading">{t('common.loading')}</div>
      ) : usersQuery.isError || vacationsQuery.isError ? (
        <div className="form-error">{t('common.loadFailed')}</div>
      ) : (
        <>
          <UserTable
            users={usersQuery.data ?? []}
            allRecords={vacationsQuery.data ?? []}
          />
          <SettingsCard />
        </>
      )}
    </main>
  );
}
