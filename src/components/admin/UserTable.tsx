import { useState } from 'react';
import { Profile, VacationRecord } from '../../types';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { useSetUserActive, useSetUserRole } from '../../hooks/useAdmin';
import { useEntitlementConfig } from '../../hooks/useSettings';
import { calculateYearlyStats } from '../../utils';
import { useToast } from '../Toast';
import { UserRecordsModal } from './UserRecordsModal';

interface UserTableProps {
  users: Profile[];
  allRecords: VacationRecord[];
}

export function UserTable({ users, allRecords }: UserTableProps) {
  const { t } = useTranslation();
  const { profile: me } = useAuth();
  const entitlement = useEntitlementConfig();
  const setRoleMutation = useSetUserRole();
  const setActiveMutation = useSetUserActive();
  const { showError } = useToast();
  const [viewingUser, setViewingUser] = useState<Profile | null>(null);

  const year = new Date().getFullYear();
  const recordsByUser = new Map<string, VacationRecord[]>();
  for (const record of allRecords) {
    const list = recordsByUser.get(record.userId) ?? [];
    list.push(record);
    recordsByUser.set(record.userId, list);
  }

  const onError = () => showError(t('common.saveFailed'));

  return (
    <div className="section">
      <h2>{t('admin.usersTitle')}</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t('admin.colEmail')}</th>
            <th>{t('admin.colName')}</th>
            <th>{t('admin.colRole')}</th>
            <th>{t('admin.colStatus')}</th>
            <th>{t('admin.colUsage')}</th>
            <th>{t('admin.colActions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const userRecords = recordsByUser.get(user.id) ?? [];
            const stats = calculateYearlyStats(
              userRecords,
              year,
              0,
              user.employmentStartDate ?? undefined,
              entitlement
            );
            const used = stats.statutoryUsed + stats.contractualUsed;
            const total = stats.statutoryTotal + stats.contractualTotal;
            const isSelf = user.id === me?.id;
            return (
              <tr key={user.id} className={user.isActive ? '' : 'inactive-row'}>
                <td>{user.email}</td>
                <td>{user.displayName ?? '—'}</td>
                <td>{user.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleUser')}</td>
                <td>{user.isActive ? t('admin.statusActive') : t('admin.statusInactive')}</td>
                <td>{t('admin.usageSummary', { used, total })}</td>
                <td className="admin-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setViewingUser(user)}
                  >
                    {t('admin.viewRecords')}
                  </button>
                  {!isSelf && (
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setRoleMutation.mutate(
                            {
                              userId: user.id,
                              role: user.role === 'admin' ? 'user' : 'admin',
                            },
                            { onError }
                          )
                        }
                      >
                        {user.role === 'admin' ? t('admin.demote') : t('admin.promote')}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setActiveMutation.mutate(
                            { userId: user.id, isActive: !user.isActive },
                            { onError }
                          )
                        }
                      >
                        {user.isActive ? t('admin.deactivate') : t('admin.activate')}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {viewingUser && (
        <UserRecordsModal
          user={viewingUser}
          records={recordsByUser.get(viewingUser.id) ?? []}
          onClose={() => setViewingUser(null)}
        />
      )}
    </div>
  );
}
