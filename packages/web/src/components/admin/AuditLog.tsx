import { useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useAdminUsers, useAuditLog } from '../../hooks/useAdmin';

const PAGE_SIZE = 20;

export function AuditLog() {
  const { t } = useTranslation();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [pages, setPages] = useState<{ actorId: string; action: string; createdAt: string; id: string }[][]>([]);
  const auditLog = useAuditLog({ limit: PAGE_SIZE, cursor });
  const adminUsers = useAdminUsers();

  const nameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of adminUsers.data ?? []) {
      map.set(user.id, user.displayName || user.email);
    }
    return map;
  }, [adminUsers.data]);

  const allItems = pages.flat().concat(auditLog.data?.items ?? []);
  const seen = new Set<string>();
  const items = allItems.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  const handleLoadMore = () => {
    if (auditLog.data?.items) {
      setPages((prev) => [...prev, auditLog.data!.items]);
    }
    setCursor(auditLog.data?.nextCursor ?? undefined);
  };

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div className="admin-section-title">
          <span className="admin-section-icon">
            <ScrollText size={18} aria-hidden="true" />
          </span>
          <h2>{t('admin.auditTitle')}</h2>
        </div>
      </div>

      {auditLog.isLoading && pages.length === 0 ? (
        <p>{t('dashboard.loading')}</p>
      ) : auditLog.isError ? (
        <div className="form-group">
          <p className="form-error">{t('errors.loadFailed')}</p>
          <button className="btn btn-ghost" onClick={() => auditLog.refetch()}>
            {t('errors.retry')}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>{t('admin.auditEmpty')}</p>
        </div>
      ) : (
        <>
          <div className="admin-audit-list">
            {items.map((item) => (
              <div key={item.id} className="admin-audit-row">
                <span className="admin-audit-actor">{nameByUserId.get(item.actorId) ?? item.actorId}</span>
                <span className="admin-audit-action">{item.action}</span>
                <span className="admin-audit-time">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
          {auditLog.data?.nextCursor && (
            <div className="admin-settings-footer">
              <button type="button" className="btn btn-ghost" onClick={handleLoadMore}>
                {t('admin.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
