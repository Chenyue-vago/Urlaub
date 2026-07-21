import { useState } from 'react';
import { getTranslator } from '../../i18n';
import { REGIONS, DEFAULT_REGION, type RegionCode } from '@urlaub/shared';

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(s).getTime());
}

interface WelcomeModalProps {
  onSubmit: (payload: { region: RegionCode; employmentStartDate: string }) => void;
  submitting?: boolean;
}

export function WelcomeModal({ onSubmit, submitting }: WelcomeModalProps) {
  const tw = getTranslator('en');
  const [draftDate, setDraftDate] = useState('');
  const [region, setRegion] = useState<RegionCode>(DEFAULT_REGION);
  const [error, setError] = useState(false);

  return (
    <div className="modal-overlay welcome-overlay">
      <div className="modal welcome-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{tw('welcome.title')}</h2>
        <p className="welcome-body">{tw('welcome.body')}</p>
        <div className="form-group">
          <label>{tw('header.region')}</label>
          <select value={region} onChange={(e) => setRegion(e.target.value as RegionCode)}>
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.nameEn}
              </option>
            ))}
          </select>
        </div>
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
            disabled={submitting}
            onClick={() => {
              if (!isValidIsoDate(draftDate)) {
                setError(true);
                return;
              }
              onSubmit({ region, employmentStartDate: draftDate });
            }}
          >
            {tw('welcome.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
