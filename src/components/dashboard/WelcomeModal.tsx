import { useState } from 'react';
import { getTranslator } from '../../i18n';

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(s).getTime());
}

interface WelcomeModalProps {
  onSubmit: (employmentStartDate: string) => void;
}

export function WelcomeModal({ onSubmit }: WelcomeModalProps) {
  const tw = getTranslator('en');
  const [draftDate, setDraftDate] = useState('');
  const [error, setError] = useState(false);

  return (
    <div className="modal-overlay welcome-overlay">
      <div className="modal welcome-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{tw('welcome.title')}</h2>
        <p className="welcome-body">{tw('welcome.body')}</p>
        <div className="form-group">
          <label>{tw('settings.employmentStartLabel')}</label>
          <input
            type="date"
            value={draftDate}
            onChange={(e) => {
              setDraftDate(e.target.value);
              if (e.target.value) setError(false);
            }}
          />
          {error && <p className="form-error">{tw('welcome.required')}</p>}
        </div>
        <div className="modal-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!isValidIsoDate(draftDate)) {
                setError(true);
                return;
              }
              onSubmit(draftDate);
            }}
          >
            {tw('welcome.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
