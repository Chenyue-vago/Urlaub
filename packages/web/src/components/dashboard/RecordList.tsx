import { Palmtree, X, Trash2 } from 'lucide-react';
import type { LeaveRequestResponse } from '../../services/leave';
import { useTranslation } from '../../i18n';
import { formatDisplayDate } from '../../utils';
import { canCancelRecord, canHideRecord, todayIso } from './canCancel';

interface RecordListProps {
  records: LeaveRequestResponse[];
  selectedYear: number;
  onCancel: (id: string) => void;
  /** Soft-hide a cancelled record from this list. */
  onHide?: (id: string) => void;
  cancellingId?: string;
  hidingId?: string;
}

const STATUS_LABEL_KEY: Record<LeaveRequestResponse['status'], string> = {
  pending: 'status.pending',
  approved: 'status.approved',
  rejected: 'status.rejected',
  cancelled: 'status.cancelled',
};

export function RecordList({
  records,
  selectedYear,
  onCancel,
  onHide,
  cancellingId,
  hidingId,
}: RecordListProps) {
  const { t } = useTranslation();

  const sorted = [...records].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const today = todayIso();

  return (
    <div className="section">
      <h2>{t('records.title', { year: selectedYear })}</h2>
      {sorted.length === 0 ? (
        <div className="empty-state">
          <Palmtree size={48} />
          <p>{t('records.empty')}</p>
          <p className="empty-hint">{t('records.emptyHint')}</p>
        </div>
      ) : (
        <div className="records-list">
          {sorted.map((record) => {
            const kind = record.isCarryOver ? 'carryover' : 'regular';
            const kindLabelKey = kind === 'carryover' ? 'records.carryover' : 'records.regular';
            return (
              <div key={record.id} className="record-card" data-testid="leave-record">
                <div className="record-row-main">
                  <div className="record-dates">
                    <span className="record-range">
                      {formatDisplayDate(record.startDate)}
                      {record.startDate !== record.endDate && (
                        <> — {formatDisplayDate(record.endDate)}</>
                      )}
                    </span>
                    <div className="record-tags">
                      <span className={`record-type ${kind}`}>{t(kindLabelKey)}</span>
                      <span
                        className={`status-badge status-${record.status}`}
                        data-testid="status-badge"
                      >
                        {t(STATUS_LABEL_KEY[record.status])}
                      </span>
                    </div>
                  </div>
                  <div className="record-info">
                    <span className="record-days">
                      {t('modal.daysValue', { n: record.workDays })}
                    </span>
                    {record.reason && <span className="record-desc">{record.reason}</span>}
                  </div>
                  {canCancelRecord(record, today) && (
                    <button
                      className="record-delete"
                      onClick={() => onCancel(record.id)}
                      title={t('dashboard.cancelRequest')}
                      disabled={cancellingId === record.id}
                    >
                      <X size={16} />
                    </button>
                  )}
                  {onHide && canHideRecord(record, today) && (
                    <button
                      className="record-delete"
                      onClick={() => onHide(record.id)}
                      title={t('dashboard.removeRecord')}
                      disabled={hidingId === record.id}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
