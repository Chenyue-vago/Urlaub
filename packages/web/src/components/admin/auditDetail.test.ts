import { describe, it, expect } from 'vitest';
import { auditDetail } from './auditDetail';
import type { AuditLogEntryDTO } from '@urlaub/shared';

const nameOf = (id: string) => ({ u_zhou: 'Zhou', u_admin: 'Admin', u_bob: 'Bob' }[id] ?? id);

function entry(over: Partial<AuditLogEntryDTO>): AuditLogEntryDTO {
  return {
    id: 'a1',
    actorId: 'u_admin',
    action: 'cancel_leave',
    targetType: 'leave_group',
    targetId: 'g1',
    metadata: null,
    createdAt: '2026-07-26T10:00:00.000Z',
    ...over,
  };
}

describe('auditDetail', () => {
  it('cancel_leave -> who cancelled whose vacation, with dates', () => {
    const d = auditDetail(
      entry({
        action: 'cancel_leave',
        actorId: 'u_zhou',
        metadata: { targetUserId: 'u_zhou', startDate: '2026-08-10', endDate: '2026-08-14' },
      }),
      nameOf
    );
    expect(d.key).toBe('audit.detail.cancel_leave');
    expect(d.params).toMatchObject({
      actor: 'Zhou',
      target: 'Zhou',
      start: '2026-08-10',
      end: '2026-08-14',
    });
  });

  it('approve_leave -> actor approved target’s dates', () => {
    const d = auditDetail(
      entry({
        action: 'approve_leave',
        actorId: 'u_admin',
        metadata: { targetUserId: 'u_zhou', startDate: '2026-09-07', endDate: '2026-09-11' },
      }),
      nameOf
    );
    expect(d.key).toBe('audit.detail.approve_leave');
    expect(d.params).toMatchObject({ actor: 'Admin', target: 'Zhou', start: '2026-09-07', end: '2026-09-11' });
  });

  it('reject_leave includes the note', () => {
    const d = auditDetail(
      entry({ action: 'reject_leave', metadata: { targetUserId: 'u_zhou', startDate: '2026-09-07', endDate: '2026-09-11', note: 'no cover' } }),
      nameOf
    );
    expect(d.key).toBe('audit.detail.reject_leave');
    expect(d.params).toMatchObject({ note: 'no cover' });
  });

  it('create_leave -> actor requested dates for themselves', () => {
    const d = auditDetail(
      entry({ action: 'create_leave', actorId: 'u_zhou', metadata: { targetUserId: 'u_zhou', startDate: '2026-10-05', endDate: '2026-10-09', totalWorkDays: 3 } }),
      nameOf
    );
    expect(d.key).toBe('audit.detail.create_leave');
    expect(d.params).toMatchObject({ actor: 'Zhou', start: '2026-10-05', end: '2026-10-09', days: '3' });
  });

  it('change_role -> from/to', () => {
    const d = auditDetail(
      entry({ action: 'change_role', targetType: 'user', targetId: 'u_bob', metadata: { from: 'member', to: 'admin' } }),
      nameOf
    );
    expect(d.key).toBe('audit.detail.change_role');
    expect(d.params).toMatchObject({ actor: 'Admin', target: 'Bob', from: 'member', to: 'admin' });
  });

  it('deactivate_user', () => {
    const d = auditDetail(
      entry({ action: 'deactivate_user', targetType: 'user', targetId: 'u_bob', metadata: { from: true, to: false } }),
      nameOf
    );
    expect(d.key).toBe('audit.detail.deactivate_user');
    expect(d.params).toMatchObject({ target: 'Bob' });
  });

  it('unknown action -> generic fallback with raw action', () => {
    const d = auditDetail(entry({ action: 'some_new_action', metadata: null }), nameOf);
    expect(d.key).toBe('audit.detail.generic');
    expect(d.params).toMatchObject({ action: 'some_new_action' });
  });

  it('leave action with MISSING dates (old row) degrades to a dash', () => {
    const d = auditDetail(
      entry({ action: 'cancel_leave', actorId: 'u_zhou', metadata: { targetUserId: 'u_zhou' } }),
      nameOf
    );
    expect(d.key).toBe('audit.detail.cancel_leave');
    expect(d.params.start).toBe('—');
    expect(d.params.end).toBe('—');
  });
});
