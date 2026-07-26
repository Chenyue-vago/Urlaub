import { describe, it, expect } from 'vitest';
import { canCancelRecord, canHideRecord } from './canCancel';

// A record is cancellable / removable only while the vacation has NOT started
// yet — startDate strictly after today. Once it has begun (or is fully past),
// it is locked, mirroring the backend earliestStart <= today guard.
const today = '2026-07-25';

describe('canCancelRecord', () => {
  it('allows cancelling an APPROVED future record', () => {
    expect(canCancelRecord({ status: 'approved', startDate: '2026-08-01' }, today)).toBe(true);
  });

  it('allows cancelling a PENDING future record', () => {
    expect(canCancelRecord({ status: 'pending', startDate: '2026-08-01' }, today)).toBe(true);
  });

  it('does NOT allow cancelling a record starting today (already begun)', () => {
    expect(canCancelRecord({ status: 'approved', startDate: today }, today)).toBe(false);
  });

  it('does NOT allow cancelling a record that already started (ongoing/past)', () => {
    expect(canCancelRecord({ status: 'approved', startDate: '2026-07-20' }, today)).toBe(false);
  });

  it('does NOT allow cancelling a rejected or cancelled record', () => {
    expect(canCancelRecord({ status: 'rejected', startDate: '2026-08-01' }, today)).toBe(false);
    expect(canCancelRecord({ status: 'cancelled', startDate: '2026-08-01' }, today)).toBe(false);
  });
});

describe('canHideRecord', () => {
  it('allows hiding a CANCELLED record that has not started', () => {
    expect(canHideRecord({ status: 'cancelled', startDate: '2026-08-01' }, today)).toBe(true);
  });

  it('does NOT allow hiding a cancelled record starting today', () => {
    expect(canHideRecord({ status: 'cancelled', startDate: today }, today)).toBe(false);
  });

  it('does NOT allow hiding a cancelled record that already started', () => {
    expect(canHideRecord({ status: 'cancelled', startDate: '2026-07-20' }, today)).toBe(false);
  });

  it('does NOT allow hiding a non-cancelled record', () => {
    expect(canHideRecord({ status: 'approved', startDate: '2026-08-01' }, today)).toBe(false);
    expect(canHideRecord({ status: 'pending', startDate: '2026-08-01' }, today)).toBe(false);
    expect(canHideRecord({ status: 'rejected', startDate: '2026-08-01' }, today)).toBe(false);
  });
});
