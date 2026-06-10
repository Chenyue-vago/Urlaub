import { useState } from 'react';
import {
  Users,
  FileText,
  Shield,
  ShieldOff,
  UserX,
  UserCheck,
  Crown,
} from 'lucide-react';
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

function getInitials(user: Profile): string {
  const name = user.displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  const local = user.email.split('@')[0] ?? user.email;
  return local.slice(0, 2).toUpperCase();
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
    <section className="admin-section">
      <div className="admin-section-head">
        <div className="admin-section-title">
          <span className="admin-section-icon">
            <Users size={18} aria-hidden="true" />
          </span>
          <h2>{t('admin.usersTitle')}</h2>
        </div>
        <span className="admin-section-count">{users.length}</span>
      </div>

      <div className="admin-user-list">
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
          const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
          const isSelf = user.id === me?.id;

          return (
            <article
              key={user.id}
              className={`admin-user-card${user.isActive ? '' : ' admin-user-card--inactive'}`}
            >
              <div className="admin-user-card-top">
                <div className="admin-user-identity">
                  <span
                    className={`admin-user-avatar${user.role === 'admin' ? ' admin-user-avatar--admin' : ''}`}
                    aria-hidden="true"
                  >
                    {getInitials(user)}
                  </span>
                  <div className="admin-user-meta">
                    <div className="admin-user-name-row">
                      <span className="admin-user-email">{user.email}</span>
                      {isSelf && (
                        <span className="admin-user-you">{t('admin.you')}</span>
                      )}
                    </div>
                    {user.displayName && (
                      <span className="admin-user-display">{user.displayName}</span>
                    )}
                  </div>
                </div>

                <div className="admin-user-pills">
                  <span
                    className={`admin-pill admin-pill--role${user.role === 'admin' ? ' admin-pill--admin' : ''}`}
                  >
                    {user.role === 'admin' ? (
                      <Crown size={11} aria-hidden="true" />
                    ) : null}
                    {user.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleUser')}
                  </span>
                  <span
                    className={`admin-pill admin-pill--status${user.isActive ? ' admin-pill--active' : ''}`}
                  >
                    {user.isActive ? t('admin.statusActive') : t('admin.statusInactive')}
                  </span>
                </div>
              </div>

              <div className="admin-user-usage">
                <div className="admin-usage-header">
                  <span className="admin-usage-label">{t('admin.colUsage')}</span>
                  <span className="admin-usage-value">
                    {t('admin.usageSummary', { used, total })}
                  </span>
                </div>
                <div className="admin-usage-bar" role="presentation">
                  <div
                    className="admin-usage-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="admin-user-actions">
                <button
                  type="button"
                  className="admin-action-btn admin-action-btn--primary"
                  onClick={() => setViewingUser(user)}
                >
                  <FileText size={14} aria-hidden="true" />
                  {t('admin.viewRecords')}
                </button>
                {!isSelf && (
                  <>
                    <button
                      type="button"
                      className="admin-action-btn"
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
                      {user.role === 'admin' ? (
                        <ShieldOff size={14} aria-hidden="true" />
                      ) : (
                        <Shield size={14} aria-hidden="true" />
                      )}
                      {user.role === 'admin' ? t('admin.demote') : t('admin.promote')}
                    </button>
                    <button
                      type="button"
                      className={`admin-action-btn${user.isActive ? ' admin-action-btn--danger' : ' admin-action-btn--success'}`}
                      onClick={() =>
                        setActiveMutation.mutate(
                          { userId: user.id, isActive: !user.isActive },
                          { onError }
                        )
                      }
                    >
                      {user.isActive ? (
                        <UserX size={14} aria-hidden="true" />
                      ) : (
                        <UserCheck size={14} aria-hidden="true" />
                      )}
                      {user.isActive ? t('admin.deactivate') : t('admin.activate')}
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {viewingUser && (
        <UserRecordsModal
          user={viewingUser}
          records={recordsByUser.get(viewingUser.id) ?? []}
          onClose={() => setViewingUser(null)}
        />
      )}
    </section>
  );
}
