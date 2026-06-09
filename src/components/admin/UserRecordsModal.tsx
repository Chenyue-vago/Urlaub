import { Trash2 } from 'lucide-react';
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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('admin.recordsOf', { email: user.email })}</h2>
        {sorted.length === 0 ? (
          <p>{t('admin.noRecords')}</p>
        ) : (
          <div className="records-list">
            {sorted.map((record) => (
              <div key={record.id} className="record-card">
                <div className="record-row-main">
                  <div className="record-dates">
                    <span className="record-range">
                      {formatDisplayDate(record.startDate)}
                      {record.startDate !== record.endDate && (
                        <> — {formatDisplayDate(record.endDate)}</>
                      )}
                    </span>
                    <div className="record-tags">
                      <span className={`record-type ${record.isCarryOver ? 'carryover' : record.type}`}>
                        {record.type}
                      </span>
                      <span className="record-year">{record.year}</span>
                    </div>
                  </div>
                  <div className="record-info">
                    <span className="record-days">{record.workDays}d</span>
                    {record.description && (
                      <span className="record-desc">{record.description}</span>
                    )}
                  </div>
                  <button
                    className="record-delete"
                    onClick={() => handleDelete(record.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            {t('modal.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
