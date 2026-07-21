import { CalendarDays, Palmtree } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useLeaveRequests } from '../../hooks/useLeave';
import { formatDisplayDate } from '../../utils';
import type { AdminUser } from '../../services/admin';

interface UserRecordsModalProps {
  user: AdminUser;
  onClose: () => void;
}

export function UserRecordsModal({ user, onClose }: UserRecordsModalProps) {
  const { t } = useTranslation();
  const records = useLeaveRequests({ userId: user.id });

  const sorted = [...(records.data ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal admin-records-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-records-head">
          <div className="admin-records-head-icon" aria-hidden="true">
            <CalendarDays size={22} />
          </div>
          <div>
            <h2>{t('admin.recordsOf', { email: user.email })}</h2>
            {user.displayName && <p className="admin-records-subtitle">{user.displayName}</p>}
          </div>
        </div>

        {records.isLoading ? (
          <p>{t('dashboard.loading')}</p>
        ) : records.isError ? (
          <p className="form-error">{t('errors.loadFailed')}</p>
        ) : sorted.length === 0 ? (
          <div className="admin-records-empty">
            <Palmtree size={40} strokeWidth={1.25} aria-hidden="true" />
            <p>{t('admin.noRecords')}</p>
          </div>
        ) : (
          <div className="admin-records-list">
            {sorted.map((record) => (
              <div key={record.id} className="admin-record-row">
                <div className="admin-record-dates">
                  <span className="admin-record-range">
                    {formatDisplayDate(record.startDate)}
                    {record.startDate !== record.endDate && (
                      <> — {formatDisplayDate(record.endDate)}</>
                    )}
                  </span>
                  <div className="record-tags">
                    <span className={`record-type ${record.isCarryOver ? 'carryover' : record.type}`}>
                      {t(`type.${record.type}`)}
                    </span>
                    <span className={`status-badge status-${record.status}`}>
                      {t(`status.${record.status}`)}
                    </span>
                  </div>
                </div>
                <div className="admin-record-meta">
                  <span className="admin-record-days">{record.workDays}d</span>
                  {record.reason && <span className="admin-record-desc">{record.reason}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('admin.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
