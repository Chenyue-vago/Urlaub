import { Trash2, Palmtree } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { VacationRecord, YearlyVacationStats } from '../../types';
import { RegionCode } from '../../regions';
import { formatDisplayDate, formatShortDate, getWorkDayDates } from '../../utils';

interface RecordListProps {
  records: VacationRecord[]; // already filtered + sorted for the selected year
  region: RegionCode;
  stats: YearlyVacationStats;
  selectedYear: number;
  onDelete: (id: string) => void;
}

export function RecordList({
  records,
  region,
  stats,
  selectedYear,
  onDelete,
}: RecordListProps) {
  const { t } = useTranslation();

  return (
    <div className="section">
      <h2>{t('records.title', { year: selectedYear })}</h2>
      <div className="year-summary">
        {t('records.summary', {
          statutory: stats.statutoryUsed,
          contractual: stats.contractualUsed,
          total: stats.statutoryUsed + stats.contractualUsed,
        })}
      </div>
      {records.length === 0 ? (
        <div className="empty-state">
          <Palmtree size={48} />
          <p>{t('records.empty')}</p>
          <p className="empty-hint">{t('records.emptyHint')}</p>
        </div>
      ) : (
        <div className="records-list">
          {(() => {
            const dateMap = new Map<string, string[]>();
            const groups = new Map<string, VacationRecord[]>();
            for (const r of records) {
              const key = `${r.startDate}__${r.endDate}__${r.description}`;
              const arr = groups.get(key);
              if (arr) arr.push(r);
              else groups.set(key, [r]);
            }
            for (const group of groups.values()) {
              const sample = group[0];
              const allDates = getWorkDayDates(sample.startDate, sample.endDate, region);
              const priority = (r: VacationRecord) =>
                r.isCarryOver ? 0 : r.type === 'contractual' ? 1 : 2;
              const sorted = [...group].sort((a, b) => priority(a) - priority(b));
              let cursor = 0;
              for (const r of sorted) {
                dateMap.set(r.id, allDates.slice(cursor, cursor + r.workDays));
                cursor += r.workDays;
              }
            }
            return records.map((record) => {
              const kind: 'carryover' | 'contractual' | 'statutory' =
                record.isCarryOver ? 'carryover' : record.type;
              const kindLabelKey =
                kind === 'carryover'
                  ? 'records.carryover'
                  : kind === 'contractual'
                    ? 'records.contractual'
                    : 'records.statutory';
              const consumeKey =
                kind === 'carryover'
                  ? 'records.consumeCarryover'
                  : kind === 'contractual'
                    ? 'records.consumeContractual'
                    : 'records.consumeStatutory';
              const workDayDates = dateMap.get(record.id) ?? [];
              const workDayLabel = workDayDates.map(formatShortDate).join(', ');
              return (
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
                        <span className={`record-type ${kind}`}>{t(kindLabelKey)}</span>
                        <span className="record-year">
                          {t('records.belongsToYear', { year: record.year })}
                        </span>
                      </div>
                    </div>
                    <div className="record-info">
                      <span className="record-days">{t(consumeKey, { n: record.workDays })}</span>
                      {record.description && (
                        <span className="record-desc">{record.description}</span>
                      )}
                    </div>
                    <button
                      className="record-delete"
                      onClick={() => onDelete(record.id)}
                      title={t('records.deleteTitle')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {workDayDates.length > 0 && (
                    <div className="record-workdays">
                      {t('records.workdayDates', { dates: workDayLabel })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
