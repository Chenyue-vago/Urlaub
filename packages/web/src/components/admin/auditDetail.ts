import type { AuditLogEntryDTO } from '@urlaub/shared';

export interface AuditDetail {
  /** i18n key for a human-readable sentence, rendered with `params`. */
  key: string;
  params: Record<string, string>;
}

const DASH = '—';

function md(entry: AuditLogEntryDTO): Record<string, unknown> {
  return (entry.metadata ?? {}) as Record<string, unknown>;
}

function str(v: unknown, fallback = DASH): string {
  return v === undefined || v === null ? fallback : String(v);
}

/**
 * Turn one audit entry into an i18n key + params for a readable detail line,
 * e.g. "Zhou cancelled their leave from 2026-08-10 to 2026-08-14". Pure and
 * testable: `nameOf` resolves a user id to a display name. Unknown actions and
 * missing fields degrade gracefully (raw action / em dash) rather than throw —
 * old rows written before dates were snapshotted still render.
 */
export function auditDetail(
  entry: AuditLogEntryDTO,
  nameOf: (userId: string) => string
): AuditDetail {
  const m = md(entry);
  const actor = nameOf(entry.actorId);
  const targetUser = m.targetUserId ? nameOf(String(m.targetUserId)) : entry.targetId ? nameOf(entry.targetId) : DASH;
  const start = str(m.startDate);
  const end = str(m.endDate);

  switch (entry.action) {
    case 'create_leave':
    case 'record_leave':
      return {
        key: `audit.detail.${entry.action}`,
        params: { actor, target: targetUser, start, end, days: str(m.totalWorkDays) },
      };
    case 'approve_leave':
    case 'reject_leave':
      return {
        key: `audit.detail.${entry.action}`,
        params: { actor, target: targetUser, start, end, note: str(m.note, '') },
      };
    case 'cancel_leave':
      return {
        key: 'audit.detail.cancel_leave',
        params: { actor, target: targetUser, start, end },
      };
    case 'change_role':
      return {
        key: 'audit.detail.change_role',
        params: { actor, target: targetUser, from: str(m.from), to: str(m.to) },
      };
    case 'activate_user':
    case 'deactivate_user':
      return {
        key: `audit.detail.${entry.action}`,
        params: { actor, target: targetUser },
      };
    case 'update_settings':
      return {
        key: 'audit.detail.update_settings',
        params: { actor },
      };
    default:
      return {
        key: 'audit.detail.generic',
        params: { actor, action: entry.action },
      };
  }
}
