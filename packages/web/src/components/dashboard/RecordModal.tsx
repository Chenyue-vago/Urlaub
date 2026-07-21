import { useState } from 'react';
import { Info } from 'lucide-react';
import { countWorkDaysByYear, type RegionCode, type VacationType } from '@urlaub/shared';
import { useTranslation } from '../../i18n';
import { formatDisplayDate } from '../../utils';

interface RecordModalProps {
  region: RegionCode;
  onSubmit: (payload: {
    startDate: string;
    endDate: string;
    type: VacationType;
    reason?: string;
  }) => void;
  onClose: () => void;
  submitting?: boolean;
}

export function RecordModal({ region, onSubmit, onClose, submitting }: RecordModalProps) {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<VacationType>('statutory');
  const [reason, setReason] = useState('');

  const previewByYear =
    startDate && endDate && startDate <= endDate
      ? countWorkDaysByYear(startDate, endDate, region)
      : [];
  const previewWorkDays = previewByYear.reduce((sum, p) => sum + p.days, 0);
  const dash = t('modal.dash');

  const canSubmit = Boolean(startDate && endDate && startDate <= endDate) && !submitting;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('modal.addTitle')}</h2>
        <div className="form-group">
          <label>
            {t('modal.startDate')}
            <input
              type="date"
              aria-label={t('modal.startDate')}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
        </div>
        <div className="form-group">
          <label>
            {t('modal.endDate')}
            <input
              type="date"
              aria-label={t('modal.endDate')}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
        {(startDate || endDate) && (
          <div className="date-summary">
            {t('modal.dateSelected', {
              start: startDate ? formatDisplayDate(startDate) : dash,
              end: endDate ? formatDisplayDate(endDate) : dash,
            })}
          </div>
        )}
        {previewWorkDays > 0 && (
          <div className="preview-days" data-testid="workdays-preview">
            <div className="preview-header">
              <span>{t('modal.consumeDays')}</span>
              <strong>{t('modal.daysValue', { n: previewWorkDays })}</strong>
            </div>
            {previewByYear.length > 0 && (
              <Info size={14} aria-hidden="true" />
            )}
          </div>
        )}
        <div className="form-group">
          <label>{t('dashboard.typeLabel')}</label>
          <div className="type-selector">
            <button
              type="button"
              className={`type-btn statutory ${type === 'statutory' ? 'active' : ''}`}
              onClick={() => setType('statutory')}
            >
              {t('type.statutory')}
            </button>
            <button
              type="button"
              className={`type-btn contractual ${type === 'contractual' ? 'active' : ''}`}
              onClick={() => setType('contractual')}
            >
              {t('type.contractual')}
            </button>
          </div>
        </div>
        <div className="form-group">
          <label>{t('dashboard.reasonLabel')}</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('modal.descPlaceholder')}
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            {t('modal.cancel')}
          </button>
          <button
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                startDate,
                endDate,
                type,
                reason: reason.trim() || undefined,
              })
            }
          >
            {t('dashboard.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
