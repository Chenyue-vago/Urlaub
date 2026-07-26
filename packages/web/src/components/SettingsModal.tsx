import { useState } from 'react';
import { useTranslation } from '../i18n';
import { useMe, useUpdateMe } from '../hooks/useMe';

interface SettingsModalProps {
  onClose: () => void;
}

/**
 * Settings dialog opened from the header gear. Lets the user change their
 * employment start date (which pro-rates the join-year entitlement); the change
 * is persisted to their profile via PATCH /me.
 *
 * The stateful form is a child that mounts only once the profile has loaded,
 * so its draft state initializes from the real value (not an empty string).
 */
export function SettingsModal({ onClose }: SettingsModalProps) {
  const me = useMe();
  if (!me.data) return null;
  return <SettingsForm initial={me.data.employmentStartDate ?? ''} onClose={onClose} />;
}

function SettingsForm({ initial, onClose }: { initial: string; onClose: () => void }) {
  const { t } = useTranslation();
  const updateMe = useUpdateMe();
  const [draft, setDraft] = useState(initial);

  const handleSave = () => {
    if (!draft) return;
    updateMe.mutate({ employmentStartDate: draft }, { onSuccess: onClose });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('settings.title')}</h2>
        <div className="form-group">
          <label htmlFor="settings-emp-start">{t('settings.employmentStartLabel')}</label>
          <input
            id="settings-emp-start"
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <p className="form-hint">{t('settings.employmentStartHint')}</p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            {t('settings.cancel')}
          </button>
          <button
            className="btn btn-primary"
            disabled={!draft || updateMe.isPending}
            onClick={handleSave}
          >
            {t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
