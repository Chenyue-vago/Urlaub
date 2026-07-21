import { Palmtree, X } from 'lucide-react';
import type { LeaveRequestResponse } from '../../services/leave';
import { useTranslation } from '../../i18n';
import { formatDisplayDate } from '../../utils';

interface RecordListProps {
  records: LeaveRequestResponse[];
  selectedYear: number;
  onCancel: (id: string) => void;
  cancellingId?: string;
}

const STATUS_LABEL_KEY: Record<LeaveRequestResponse['status'], string> = {
  pending: 'status.pending',
  approved: 'status.approved',
  rejected: 'status.rejected',
  cancelled: 'status.cancelled',
};

export function RecordList({ records, selectedYear, onCancel, cancellingId }: RecordListProps) {
  const { t } = useTranslation();

  const sorted = [...records].sort((a, b) => b.startDate.localeCompare(a.startDate));

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
            const kind = record.isCarryOver ? 'carryover' : record.type;
            const kindLabelKey =
              kind === 'carryover'
                ? 'records.carryover'
                : kind === 'contractual'
                  ? 'records.contractual'
                  : 'records.statutory';
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
                  {record.status === 'pending' && (
                    <button
                      className="record-delete"
                      onClick={() => onCancel(record.id)}
                      title={t('dashboard.cancelRequest')}
                      disabled={cancellingId === record.id}
                    >
                      <X size={16} />
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
