import { useState } from 'react';
import { useTranslation } from '../../i18n';

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(s).getTime());
}

interface SettingsModalProps {
  initialDate: string;
  onSave: (employmentStartDate: string) => void;
  onClose: () => void;
}

export function SettingsModal({ initialDate, onSave, onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const [draftDate, setDraftDate] = useState(initialDate);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('settings.title')}</h2>
        <div className="form-group">
          <label>{t('settings.employmentStartLabel')}</label>
          <input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
          />
          <p className="form-hint">{t('settings.employmentStartHint')}</p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            {t('settings.cancel')}
          </button>
          <button
            className="btn btn-primary"
            disabled={!isValidIsoDate(draftDate)}
            onClick={() => {
              if (!isValidIsoDate(draftDate)) return;
              onSave(draftDate);
            }}
          >
            {t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
