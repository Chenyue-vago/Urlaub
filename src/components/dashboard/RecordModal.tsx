import { useState } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { RegionCode } from '../../regions';
import { countWorkDaysByYear, formatDisplayDate } from '../../utils';

interface RecordModalProps {
  region: RegionCode;
  selectedYear: number;
  carryOverFromPreviousYear: number;
  carryOverDeadline: string; // 'MM-DD'
  onSubmit: (startDate: string, endDate: string, description: string) => void;
  onClose: () => void;
}

export function RecordModal({
  region,
  selectedYear,
  carryOverFromPreviousYear,
  carryOverDeadline,
  onSubmit,
  onClose,
}: RecordModalProps) {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');

  const previewByYear =
    startDate && endDate && startDate <= endDate
      ? countWorkDaysByYear(startDate, endDate, region)
      : [];
  const previewWorkDays = previewByYear.reduce((sum, p) => sum + p.days, 0);
  const dash = t('modal.dash');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('modal.addTitle')}</h2>
        <div className="form-group">
          <label>{t('modal.startDate')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>{t('modal.endDate')}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
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
          <div className="preview-days">
            <div className="preview-header">
              <span>{t('modal.consumeDays')}</span>
              <strong>{t('modal.daysValue', { n: previewWorkDays })}</strong>
            </div>
          </div>
        )}
        {carryOverFromPreviousYear > 0 &&
          endDate &&
          endDate <= `${selectedYear}-${carryOverDeadline}` && (
          <div className="carryover-hint">
            <Info size={14} />
            <span>{t('modal.carryoverHint')}</span>
          </div>
        )}
        <div className="form-group">
          <label>{t('modal.descLabel')}</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('modal.descPlaceholder')}
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            {t('modal.cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onSubmit(startDate, endDate, description)}
          >
            {t('modal.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
