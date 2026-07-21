import { Shield } from 'lucide-react';
import { useTranslation } from '../i18n';
import { ApprovalsQueue } from '../components/admin/ApprovalsQueue';
import { UserTable } from '../components/admin/UserTable';
import { InviteUserForm } from '../components/admin/InviteUserForm';
import { SettingsCard } from '../components/admin/SettingsCard';
import { AuditLog } from '../components/admin/AuditLog';

export function Admin() {
  const { t } = useTranslation();

  return (
    <main className="main admin-page">
      <header className="admin-hero">
        <div className="admin-hero-text">
          <div className="admin-hero-badge">
            <Shield size={16} strokeWidth={2.25} aria-hidden="true" />
            <span>{t('nav.admin')}</span>
          </div>
          <h1 className="admin-hero-title">{t('admin.title')}</h1>
          <p className="admin-hero-subtitle">{t('admin.subtitle')}</p>
        </div>
      </header>

      <div className="admin-layout">
        <ApprovalsQueue />
        <section className="admin-section">
          <InviteUserForm />
        </section>
        <UserTable />
        <SettingsCard />
        <AuditLog />
      </div>
    </main>
  );
}
