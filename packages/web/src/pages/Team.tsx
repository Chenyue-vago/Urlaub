import { useTranslation } from '../i18n';

export function Team() {
  const { t } = useTranslation();
  return (
    <main className="main">
      <div className="empty-state">
        <p>{t('team.comingSoon')}</p>
      </div>
    </main>
  );
}
