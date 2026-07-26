import { useMemo, useState } from 'react';
import { ScrollText, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useAdminUsers, useAuditLog } from '../../hooks/useAdmin';
import type { AuditLogEntry } from '../../services/admin';
import { auditDetail } from './auditDetail';

const PAGE_SIZE = 20;

export function AuditLog() {
  const { t } = useTranslation();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [pages, setPages] = useState<AuditLogEntry[][]>([]);
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);
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
            {items.map((item) => {
              const expanded = expandedId === item.id;
              const detail = auditDetail(item, (id) => nameByUserId.get(id) ?? id);
              return (
                <div key={item.id} className="admin-audit-item">
                  <button
                    type="button"
                    className="admin-audit-row admin-audit-row-button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedId(expanded ? undefined : item.id)}
                  >
                    <ChevronRight
                      size={14}
                      aria-hidden="true"
                      className={`admin-audit-chevron${expanded ? ' expanded' : ''}`}
                    />
                    <span className="admin-audit-actor">
                      {nameByUserId.get(item.actorId) ?? item.actorId}
                    </span>
                    <span className="admin-audit-action">{item.action}</span>
                    <span className="admin-audit-time">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </button>
                  {expanded && (
                    <div className="admin-audit-detail" data-testid="audit-detail">
                      <p className="admin-audit-detail-text">{t(detail.key, detail.params)}</p>
                    </div>
                  )}
                </div>
              );
            })}
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
