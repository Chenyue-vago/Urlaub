import { useRef, useState } from 'react';
import { useTranslation } from '../../i18n';
import { NewVacationRecord, VacationRecord } from '../../types';
import { buildBackup, parseBackup } from '../../services/backup';
import { formatDateString } from '../../utils';
import { useToast } from '../Toast';

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(s).getTime());
}

interface SettingsModalProps {
  initialDate: string;
  records: VacationRecord[];
  onImport: (records: NewVacationRecord[]) => Promise<void>;
  onSave: (employmentStartDate: string) => void;
  onClose: () => void;
}

export function SettingsModal({
  initialDate,
  records,
  onImport,
  onSave,
  onClose,
}: SettingsModalProps) {
  const { t } = useTranslation();
  const { showError, showSuccess } = useToast();
  const [draftDate, setDraftDate] = useState(initialDate);
  const [importing, setImporting] = useState(false);
  // 用于触发隐藏的 file input 走系统文件选择
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = () => {
    const payload = buildBackup(records);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `urlaub-backup-${formatDateString(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    // 一定要清空，否则下次选同名文件 onChange 不会再触发
    const resetInput = () => {
      input.value = '';
    };
    const reader = new FileReader();
    reader.onerror = () => {
      showError(t('settings.importError'));
      resetInput();
    };
    reader.onload = async () => {
      let parsed: NewVacationRecord[];
      try {
        parsed = parseBackup(JSON.parse(String(reader.result)));
      } catch {
        showError(t('settings.importError'));
        resetInput();
        return;
      }
      if (!window.confirm(t('settings.importConfirm', { n: parsed.length }))) {
        resetInput();
        return;
      }
      setImporting(true);
      try {
        await onImport(parsed);
        showSuccess(t('settings.importSuccess', { n: parsed.length }));
      } catch {
        showError(t('common.saveFailed'));
      } finally {
        setImporting(false);
        resetInput();
      }
    };
    reader.readAsText(file);
  };

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

        <div className="settings-section">
          <h3 className="settings-section-title">{t('settings.backupTitle')}</h3>
          <p className="form-hint">{t('settings.backupHint')}</p>
          <div className="settings-backup-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExportBackup}
              disabled={records.length === 0}
            >
              {t('settings.export')}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
            >
              {t('settings.import')}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={handleImportFileChosen}
            />
          </div>
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
