import { useRef, useState } from 'react';
import { useTranslation } from '../../i18n';
import { VacationRecord } from '../../types';
import { buildBackup, parseBackup, ParsedBackup } from '../../services/backup';
import { formatDateString } from '../../utils';
import { useToast } from '../Toast';

type ImportMode = 'merge' | 'replace';

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(s).getTime());
}

interface SettingsModalProps {
  initialDate: string;
  records: VacationRecord[];
  onImport: (parsed: ParsedBackup, mode: ImportMode) => Promise<void>;
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
  // tracks which button triggered the file picker
  const importModeRef = useRef<ImportMode>('merge');
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

  const triggerImport = (mode: ImportMode) => {
    importModeRef.current = mode;
    importInputRef.current?.click();
  };

  const handleImportFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const mode = importModeRef.current;
    // 一定要清空，否则下次选同名文件 onChange 不会再触发
    const resetInput = () => { input.value = ''; };
    const reader = new FileReader();
    reader.onerror = () => {
      showError(t('settings.importError'));
      resetInput();
    };
    reader.onload = async () => {
      let parsed: ParsedBackup;
      try {
        parsed = parseBackup(JSON.parse(String(reader.result)));
      } catch {
        showError(t('settings.importError'));
        resetInput();
        return;
      }
      const confirmMsg =
        mode === 'replace'
          ? t('settings.importConfirmReplace', {
              existing: records.length,
              n: parsed.records.length,
            })
          : t('settings.importConfirm', { n: parsed.records.length });
      if (!window.confirm(confirmMsg)) {
        resetInput();
        return;
      }
      setImporting(true);
      try {
        await onImport(parsed, mode);
        const successMsg =
          mode === 'replace'
            ? t('settings.importReplaceSuccess', { n: parsed.records.length })
            : t('settings.importSuccess', { n: parsed.records.length });
        showSuccess(successMsg);
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
              onClick={() => triggerImport('merge')}
              disabled={importing}
            >
              {t('settings.importMerge')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => triggerImport('replace')}
              disabled={importing}
            >
              {t('settings.importReplace')}
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
