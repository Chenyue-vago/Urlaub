import { useEffect, useState } from 'react';
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
    <div className="section">
      <h2>{t('admin.settingsTitle')}</h2>
      <div className="admin-settings-grid">
        <div className="form-group">
          <label>{t('admin.statutoryDays')}</label>
          <input
            type="number"
            min={0}
            value={statutory}
            onChange={(e) => setStatutory(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>{t('admin.contractualDays')}</label>
          <input
            type="number"
            min={0}
            value={contractual}
            onChange={(e) => setContractual(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>{t('admin.carryOverDeadline')}</label>
          <input
            type="text"
            placeholder="03-31"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
      </div>
      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={updateMutation.isPending}
      >
        {t('admin.save')}
      </button>
    </div>
  );
}
