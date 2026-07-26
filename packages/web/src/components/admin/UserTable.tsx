import { useState } from 'react';
import { Users, FileText, Shield, ShieldOff, UserX, UserCheck, Crown } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useMe } from '../../hooks/useMe';
import { useAdminUsers, useUpdateUser } from '../../hooks/useAdmin';
import { useBalance } from '../../hooks/useBalance';
import { useToast } from '../Toast';
import { translateApiErrorCode } from '../../lib/errorMessages';
import { ApiError } from '../../lib/api';
import type { AdminUser } from '../../services/admin';
import { UserRecordsModal } from './UserRecordsModal';

function getInitials(user: AdminUser): string {
  const name = user.displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  const local = user.email.split('@')[0] ?? user.email;
  return local.slice(0, 2).toUpperCase();
}

interface UserRowProps {
  user: AdminUser;
  isSelf: boolean;
  onView: (user: AdminUser) => void;
}

function UserRow({ user, isSelf, onView }: UserRowProps) {
  const { t } = useTranslation();
  const { showError } = useToast();
  const updateUser = useUpdateUser();
  const balance = useBalance({ userId: user.id });

  const used = balance.data ? balance.data.statutoryUsed + balance.data.contractualUsed : undefined;
  const total = balance.data ? balance.data.statutoryTotal + balance.data.contractualTotal : undefined;
  const pct = total && total > 0 && used !== undefined ? Math.min(100, (used / total) * 100) : 0;

  const onError = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : undefined;
    showError(translateApiErrorCode(code, t));
  };

  return (
    <article
      className={`admin-user-card${user.isActive ? '' : ' admin-user-card--inactive'}`}
      data-testid="user-row"
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
              {isSelf && <span className="admin-user-you">{t('admin.you')}</span>}
            </div>
            {user.displayName && <span className="admin-user-display">{user.displayName}</span>}
          </div>
        </div>

        <div className="admin-user-pills">
          <span className={`admin-pill admin-pill--role${user.role === 'admin' ? ' admin-pill--admin' : ''}`}>
            {user.role === 'admin' ? <Crown size={11} aria-hidden="true" /> : null}
            {user.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleMember')}
          </span>
          <span className={`admin-pill admin-pill--status${user.isActive ? ' admin-pill--active' : ''}`}>
            {user.isActive ? t('admin.statusActive') : t('admin.statusInactive')}
          </span>
        </div>
      </div>

      {used !== undefined && total !== undefined && (
        <div className="admin-user-usage">
          <div className="admin-usage-header">
            <span className="admin-usage-label">{t('admin.colUsage')}</span>
            <span className="admin-usage-value">{t('admin.usageSummary', { used, total })}</span>
          </div>
          <div className="admin-usage-bar" role="presentation">
            <div className="admin-usage-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="admin-user-actions">
        <button type="button" className="admin-action-btn admin-action-btn--primary" onClick={() => onView(user)}>
          <FileText size={14} aria-hidden="true" />
          {t('admin.viewRecords')}
        </button>
        {!isSelf && (
          <>
            <button
              type="button"
              className="admin-action-btn"
              disabled={updateUser.isPending}
              onClick={() =>
                updateUser.mutate(
                  { id: user.id, payload: { role: user.role === 'admin' ? 'member' : 'admin' } },
                  { onError }
                )
              }
            >
              {user.role === 'admin' ? <ShieldOff size={14} aria-hidden="true" /> : <Shield size={14} aria-hidden="true" />}
              {user.role === 'admin' ? t('admin.demote') : t('admin.promote')}
            </button>
            <button
              type="button"
              className={`admin-action-btn${user.isActive ? ' admin-action-btn--danger' : ' admin-action-btn--success'}`}
              disabled={updateUser.isPending}
              onClick={() =>
                updateUser.mutate({ id: user.id, payload: { isActive: !user.isActive } }, { onError })
              }
            >
              {user.isActive ? <UserX size={14} aria-hidden="true" /> : <UserCheck size={14} aria-hidden="true" />}
              {user.isActive ? t('admin.deactivate') : t('admin.activate')}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export function UserTable() {
  const { t } = useTranslation();
  const me = useMe();
  const adminUsers = useAdminUsers();
  const [viewingUser, setViewingUser] = useState<AdminUser | null>(null);

  const users = adminUsers.data ?? [];

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

      {adminUsers.isLoading ? (
        <p>{t('dashboard.loading')}</p>
      ) : adminUsers.isError ? (
        <div className="form-group">
          <p className="form-error">{t('errors.loadFailed')}</p>
          <button className="btn btn-ghost" onClick={() => adminUsers.refetch()}>
            {t('errors.retry')}
          </button>
        </div>
      ) : (
        <div className="admin-user-list">
          {users.map((user) => (
            <UserRow key={user.id} user={user} isSelf={user.id === me.data?.id} onView={setViewingUser} />
          ))}
        </div>
      )}

      {viewingUser && <UserRecordsModal user={viewingUser} onClose={() => setViewingUser(null)} />}
    </section>
  );
}
