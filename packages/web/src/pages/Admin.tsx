import { useTranslation } from '../i18n';

export function Admin() {
  const { t } = useTranslation();
  return (
    <main className="main">
      <div className="empty-state">
        <p>{t('admin.comingSoon')}</p>
      </div>
    </main>
  );
}
