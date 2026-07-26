import { describe, it, expect } from 'vitest';
import { canCancelRecord, canHideRecord } from './canCancel';

// A record is cancellable by its owner when it still reserves days (pending or
// approved) AND has not fully ended yet — mirroring the backend cancelLeave
// rule (members can only cancel leave whose end date is today or later).
const base = {
  status: 'approved' as const,
  endDate: '2100-01-01', // far future
};

describe('canCancelRecord', () => {
  const today = '2026-07-25';

  it('allows cancelling an APPROVED future record', () => {
    expect(canCancelRecord({ ...base, status: 'approved', endDate: '2026-08-01' }, today)).toBe(true);
  });

  it('allows cancelling a PENDING future record', () => {
    expect(canCancelRecord({ ...base, status: 'pending', endDate: '2026-08-01' }, today)).toBe(true);
  });

  it('allows cancelling a record ending exactly today', () => {
    expect(canCancelRecord({ ...base, status: 'approved', endDate: today }, today)).toBe(true);
  });

  it('does NOT allow cancelling a record that already ended', () => {
    expect(canCancelRecord({ ...base, status: 'approved', endDate: '2026-07-24' }, today)).toBe(false);
  });

  it('does NOT allow cancelling a rejected or cancelled record', () => {
    expect(canCancelRecord({ ...base, status: 'rejected', endDate: '2026-08-01' }, today)).toBe(false);
    expect(canCancelRecord({ ...base, status: 'cancelled', endDate: '2026-08-01' }, today)).toBe(false);
  });
});

describe('canHideRecord', () => {
  const today = '2026-07-25';

  it('allows hiding a CANCELLED future record', () => {
    expect(canHideRecord({ status: 'cancelled', endDate: '2026-08-01' }, today)).toBe(true);
  });

  it('allows hiding a cancelled record ending exactly today', () => {
    expect(canHideRecord({ status: 'cancelled', endDate: today }, today)).toBe(true);
  });

  it('does NOT allow hiding a cancelled record already in the past', () => {
    expect(canHideRecord({ status: 'cancelled', endDate: '2026-07-24' }, today)).toBe(false);
  });

  it('does NOT allow hiding a non-cancelled record', () => {
    expect(canHideRecord({ status: 'approved', endDate: '2026-08-01' }, today)).toBe(false);
    expect(canHideRecord({ status: 'pending', endDate: '2026-08-01' }, today)).toBe(false);
    expect(canHideRecord({ status: 'rejected', endDate: '2026-08-01' }, today)).toBe(false);
  });
});
