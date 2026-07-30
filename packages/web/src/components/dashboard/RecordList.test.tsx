import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordList } from './RecordList';
import type { LeaveRequestResponse } from '../../services/leave';

function record(over: Partial<LeaveRequestResponse>): LeaveRequestResponse {
  return {
    id: 'r1',
    groupId: 'g1',
    userId: 'u1',
    startDate: '2100-01-01',
    endDate: '2100-01-05',
    workDays: 3,
    year: 2100,
    isCarryOver: false,
    status: 'approved',
    reason: '',
    decidedById: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...over,
  };
}

describe('RecordList cancel button', () => {
  it('shows a cancel button for an APPROVED future vacation', () => {
    render(
      <RecordList
        records={[record({ id: 'a', status: 'approved', endDate: '2100-01-05' })]}
        selectedYear={2100}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByTitle('Cancel request')).toBeInTheDocument();
  });

  it('shows a cancel button for a PENDING future request', () => {
    render(
      <RecordList
        records={[record({ id: 'p', status: 'pending', endDate: '2100-01-05' })]}
        selectedYear={2100}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByTitle('Cancel request')).toBeInTheDocument();
  });

  it('does NOT show a cancel button for an already-ended vacation', () => {
    render(
      <RecordList
        records={[record({ id: 'past', status: 'approved', startDate: '2020-01-01', endDate: '2020-01-05' })]}
        selectedYear={2020}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByTitle('Cancel request')).not.toBeInTheDocument();
  });

  it('does NOT show a cancel button for rejected/cancelled records', () => {
    render(
      <RecordList
        records={[
          record({ id: 'rej', status: 'rejected' }),
          record({ id: 'can', status: 'cancelled' }),
        ]}
        selectedYear={2100}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByTitle('Cancel request')).not.toBeInTheDocument();
  });

  it('shows a REMOVE button only on cancelled entries and calls onHide', async () => {
    const user = userEvent.setup();
    const onHide = vi.fn();
    render(
      <RecordList
        records={[
          record({ id: 'can', status: 'cancelled' }),
          record({ id: 'rej', status: 'rejected' }),
          record({ id: 'appr', status: 'approved' }),
        ]}
        selectedYear={2100}
        onCancel={vi.fn()}
        onHide={onHide}
      />
    );
    const removeButtons = screen.getAllByTitle('Remove from list');
    expect(removeButtons).toHaveLength(1); // only the cancelled one
    await user.click(removeButtons[0]);
    expect(onHide).toHaveBeenCalledWith('can');
  });

  it('does NOT show a remove button for a cancelled vacation already in the past', () => {
    render(
      <RecordList
        records={[
          record({ id: 'pastcan', status: 'cancelled', startDate: '2020-01-01', endDate: '2020-01-05' }),
        ]}
        selectedYear={2020}
        onCancel={vi.fn()}
        onHide={vi.fn()}
      />
    );
    expect(screen.queryByTitle('Remove from list')).not.toBeInTheDocument();
  });
});
