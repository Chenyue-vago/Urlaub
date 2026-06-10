import { Trash2, CalendarDays, Palmtree } from 'lucide-react';
import { Profile, VacationRecord } from '../../types';
import { useTranslation } from '../../i18n';
import { formatDisplayDate } from '../../utils';
import { useDeleteVacation } from '../../hooks/useVacations';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../Toast';

interface UserRecordsModalProps {
  user: Profile;
  records: VacationRecord[];
  onClose: () => void;
}

export function UserRecordsModal({ user, records, onClose }: UserRecordsModalProps) {
  const { t } = useTranslation();
  const deleteMutation = useDeleteVacation(user.id);
  const queryClient = useQueryClient();
  const { showError } = useToast();

  const handleDelete = (id: string) => {
    if (!confirm(t('admin.confirmDeleteRecord'))) return;
    deleteMutation.mutate(id, {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: ['admin', 'vacations'] }),
      onError: () => showError(t('common.saveFailed')),
    });
  };

  const sorted = [...records].sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal admin-records-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-records-head">
          <div className="admin-records-head-icon" aria-hidden="true">
            <CalendarDays size={22} />
          </div>
          <div>
            <h2>{t('admin.recordsOf', { email: user.email })}</h2>
            {user.displayName && (
              <p className="admin-records-subtitle">{user.displayName}</p>
            )}
          </div>
        </div>

        {sorted.length === 0 ? (
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
                    <span
                      className={`record-type ${record.isCarryOver ? 'carryover' : record.type}`}
                    >
                      {record.type}
                    </span>
                    <span className="record-year">{record.year}</span>
                  </div>
                </div>
                <div className="admin-record-meta">
                  <span className="admin-record-days">{record.workDays}d</span>
                  {record.description && (
                    <span className="admin-record-desc">{record.description}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="admin-record-delete"
                  onClick={() => handleDelete(record.id)}
                  aria-label={t('admin.confirmDeleteRecord')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('modal.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
