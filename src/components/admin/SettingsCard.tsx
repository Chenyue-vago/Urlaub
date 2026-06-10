import { useEffect, useState } from 'react';
import { SlidersHorizontal, CalendarClock, Save } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { useToast } from '../Toast';

export function SettingsCard() {
  const { t } = useTranslation();
  const { data: settings } = useSettings();
  const updateMutation = useUpdateSettings();
  const { showError, showSuccess } = useToast();

  const [statutory, setStatutory] = useState('20');
  const [contractual, setContractual] = useState('8');
  const [deadline, setDeadline] = useState('03-31');

  useEffect(() => {
    if (settings) {
      setStatutory(String(settings.statutoryDays));
      setContractual(String(settings.contractualDays));
      setDeadline(settings.carryOverDeadline);
    }
  }, [settings]);

  const handleSave = async () => {
    const statutoryDays = Number(statutory);
    const contractualDays = Number(contractual);
    const valid =
      Number.isInteger(statutoryDays) &&
      statutoryDays >= 0 &&
      Number.isInteger(contractualDays) &&
      contractualDays >= 0 &&
      /^[0-1][0-9]-[0-3][0-9]$/.test(deadline);
    if (!valid) {
      showError(t('common.saveFailed'));
      return;
    }
    try {
      await updateMutation.mutateAsync({
        statutoryDays,
        contractualDays,
        carryOverDeadline: deadline,
      });
      showSuccess(t('admin.saved'));
    } catch {
      showError(t('common.saveFailed'));
    }
  };

  return (
    <section className="admin-section admin-section--settings">
      <div className="admin-section-head">
        <div className="admin-section-title">
          <span className="admin-section-icon admin-section-icon--settings">
            <SlidersHorizontal size={18} aria-hidden="true" />
          </span>
          <h2>{t('admin.settingsTitle')}</h2>
        </div>
      </div>

      <p className="admin-settings-lead">{t('admin.settingsLead')}</p>

      <div className="admin-settings-fields">
        <div className="admin-setting-field">
          <label className="admin-setting-label" htmlFor="admin-statutory">
            <span className="admin-setting-dot admin-setting-dot--statutory" aria-hidden="true" />
            {t('admin.statutoryDays')}
          </label>
          <div className="admin-setting-input-box admin-setting-input-box--statutory">
            <input
              id="admin-statutory"
              type="number"
              min={0}
              inputMode="numeric"
              value={statutory}
              onChange={(e) => setStatutory(e.target.value)}
            />
            <span className="admin-setting-suffix">{t('admin.daysUnit')}</span>
          </div>
        </div>

        <div className="admin-setting-field">
          <label className="admin-setting-label" htmlFor="admin-contractual">
            <span className="admin-setting-dot admin-setting-dot--contractual" aria-hidden="true" />
            {t('admin.contractualDays')}
          </label>
          <div className="admin-setting-input-box admin-setting-input-box--contractual">
            <input
              id="admin-contractual"
              type="number"
              min={0}
              inputMode="numeric"
              value={contractual}
              onChange={(e) => setContractual(e.target.value)}
            />
            <span className="admin-setting-suffix">{t('admin.daysUnit')}</span>
          </div>
        </div>

        <div className="admin-setting-field">
          <label className="admin-setting-label" htmlFor="admin-deadline">
            <CalendarClock size={14} aria-hidden="true" />
            {t('admin.carryOverDeadline')}
          </label>
          <div className="admin-setting-input-box admin-setting-input-box--deadline">
            <input
              id="admin-deadline"
              type="text"
              inputMode="numeric"
              placeholder="03-31"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              aria-describedby="admin-deadline-hint"
            />
          </div>
          <p className="admin-setting-hint" id="admin-deadline-hint">
            {t('admin.deadlineHint')}
          </p>
        </div>
      </div>

      <div className="admin-settings-footer">
        <button
          type="button"
          className="btn btn-primary admin-save-btn"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          <Save size={16} aria-hidden="true" />
          {t('admin.save')}
        </button>
      </div>
    </section>
  );
}
