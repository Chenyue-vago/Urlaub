import { useMemo } from 'react';
import { ClipboardList, Check, X } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useLeaveRequests, useApproveLeaveRequest, useRejectLeaveRequest } from '../../hooks/useLeave';
import { useAdminUsers } from '../../hooks/useAdmin';
import { useToast } from '../Toast';
import { translateApiErrorCode } from '../../lib/errorMessages';
import { ApiError } from '../../lib/api';
import { formatDisplayDate } from '../../utils';
import type { LeaveRequestResponse } from '../../services/leave';

interface ApprovalGroup {
  groupId: string;
  items: LeaveRequestResponse[];
  userId: string;
  startDate: string;
  endDate: string;
  workDays: number;
  type: LeaveRequestResponse['type'];
  reason: string;
}

function groupByGroupId(records: LeaveRequestResponse[]): ApprovalGroup[] {
  const map = new Map<string, LeaveRequestResponse[]>();
  for (const record of records) {
    const list = map.get(record.groupId) ?? [];
    list.push(record);
    map.set(record.groupId, list);
  }
  return Array.from(map.entries())
    .map(([groupId, items]) => {
      const sorted = [...items].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const startDate = sorted[0].startDate;
      const endDate = sorted[sorted.length - 1].endDate;
      const workDays = sorted.reduce((sum, item) => sum + item.workDays, 0);
      return {
        groupId,
        items: sorted,
        userId: sorted[0].userId,
        startDate,
        endDate,
        workDays,
        type: sorted[0].type,
        reason: sorted[0].reason,
      };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function ApprovalsQueue() {
  const { t } = useTranslation();
  const { showError, showSuccess } = useToast();
  const leaveRequests = useLeaveRequests({});
  const adminUsers = useAdminUsers();
  const approveMutation = useApproveLeaveRequest();
  const rejectMutation = useRejectLeaveRequest();

  const nameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of adminUsers.data ?? []) {
      map.set(user.id, user.displayName || user.email);
    }
    return map;
  }, [adminUsers.data]);

  const groups = useMemo(() => {
    const pending = (leaveRequests.data ?? []).filter((r) => r.status === 'pending');
    return groupByGroupId(pending);
  }, [leaveRequests.data]);

  const onActionError = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : undefined;
    showError(translateApiErrorCode(code, t));
  };

  // The backend decides the whole group in one call (it resolves the group
  // from any row id), so call once per group — NOT once per row, which would
  // make cross-year (multi-row) groups fail on the second row with
  // invalid_transition.
  const handleApprove = async (group: ApprovalGroup) => {
    try {
      await approveMutation.mutateAsync(group.items[0].id);
      showSuccess(t('admin.approveSuccess'));
    } catch (err) {
      onActionError(err);
    }
  };

  const handleReject = async (group: ApprovalGroup) => {
    const note = window.prompt(t('admin.rejectPrompt'));
    if (note === null) return;
    if (note.trim().length === 0) {
      showError(t('admin.rejectNoteRequired'));
      return;
    }
    try {
      await rejectMutation.mutateAsync({ id: group.items[0].id, note });
      showSuccess(t('admin.rejectSuccess'));
    } catch (err) {
      onActionError(err);
    }
  };

  const loading = leaveRequests.isLoading || adminUsers.isLoading;
  const error = leaveRequests.isError || adminUsers.isError;

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div className="admin-section-title">
          <span className="admin-section-icon">
            <ClipboardList size={18} aria-hidden="true" />
          </span>
          <h2>{t('admin.approvalsTitle')}</h2>
        </div>
        <span className="admin-section-count">{groups.length}</span>
      </div>

      {loading ? (
        <p>{t('dashboard.loading')}</p>
      ) : error ? (
        <div className="form-group">
          <p className="form-error">{t('errors.loadFailed')}</p>
          <button className="btn btn-ghost" onClick={() => leaveRequests.refetch()}>
            {t('errors.retry')}
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <p>{t('admin.approvalsEmpty')}</p>
        </div>
      ) : (
        <div className="admin-approvals-list">
          {groups.map((group) => (
            <article key={group.groupId} className="admin-approval-card" data-testid="approval-card">
              <div className="admin-approval-main">
                <div className="admin-approval-requester">
                  <span className="admin-approval-name">
                    {nameByUserId.get(group.userId) ?? group.userId}
                  </span>
                  <span className={`record-type ${group.type}`}>{t(`type.${group.type}`)}</span>
                </div>
                <div className="admin-approval-dates">
                  {formatDisplayDate(group.startDate)}
                  {group.startDate !== group.endDate && (
                    <> — {formatDisplayDate(group.endDate)}</>
                  )}
                  <span className="admin-approval-days">
                    {t('admin.workDaysLabel', { n: group.workDays })}
                  </span>
                </div>
                {group.reason && <p className="admin-approval-reason">{group.reason}</p>}
              </div>
              <div className="admin-approval-actions">
                <button
                  type="button"
                  className="admin-action-btn admin-action-btn--success"
                  onClick={() => handleApprove(group)}
                  disabled={approveMutation.isPending}
                >
                  <Check size={14} aria-hidden="true" />
                  {t('admin.approve')}
                </button>
                <button
                  type="button"
                  className="admin-action-btn admin-action-btn--danger"
                  onClick={() => handleReject(group)}
                  disabled={rejectMutation.isPending}
                >
                  <X size={14} aria-hidden="true" />
                  {t('admin.reject')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
