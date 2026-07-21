import { useState } from 'react';
import { Plus } from 'lucide-react';
import { DEFAULT_REGION, type RegionCode } from '@urlaub/shared';
import { useTranslation } from '../../i18n';
import { useMe, useUpdateMe } from '../../hooks/useMe';
import { useBalance } from '../../hooks/useBalance';
import {
  useLeaveRequests,
  useCreateLeaveRequest,
  useCancelLeaveRequest,
} from '../../hooks/useLeave';
import { useToast } from '../Toast';
import { translateApiErrorCode } from '../../lib/errorMessages';
import { ApiError } from '../../lib/api';
import { StatsCards } from './StatsCards';
import { PublicHolidays } from './PublicHolidays';
import { RecordList } from './RecordList';
import { RecordModal } from './RecordModal';
import { WelcomeModal } from './WelcomeModal';
import { YearNav } from './YearNav';

function loadSelectedYear(): number {
  const stored = localStorage.getItem('urlaub_selected_year');
  const parsed = stored ? Number(stored) : NaN;
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
}

export function MyDashboard() {
  const { t } = useTranslation();
  const { showError } = useToast();

  const [selectedYear, setSelectedYear] = useState<number>(loadSelectedYear);
  const [showAddForm, setShowAddForm] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | undefined>(undefined);

  const me = useMe();
  const updateMe = useUpdateMe();
  const balance = useBalance({ year: selectedYear });
  const leaveRequests = useLeaveRequests({ year: selectedYear });
  const createLeaveRequest = useCreateLeaveRequest();
  const cancelLeaveRequest = useCancelLeaveRequest();

  const handleYearChange = (delta: number) => {
    setSelectedYear((prev) => {
      const next = prev + delta;
      localStorage.setItem('urlaub_selected_year', String(next));
      return next;
    });
  };

  const handleWelcomeSubmit = (payload: { region: RegionCode; employmentStartDate: string }) => {
    updateMe.mutate(payload, {
      onError: (err) => {
        const code = err instanceof ApiError ? err.code : undefined;
        showError(translateApiErrorCode(code, t));
      },
    });
  };

  const handleCreate = (payload: {
    startDate: string;
    endDate: string;
    type: 'statutory' | 'contractual';
    reason?: string;
  }) => {
    createLeaveRequest.mutate(payload, {
      onSuccess: () => {
        setShowAddForm(false);
      },
      onError: (err) => {
        const code = err instanceof ApiError ? err.code : undefined;
        showError(translateApiErrorCode(code, t));
      },
    });
  };

  const handleCancel = (id: string) => {
    if (!window.confirm(t('dashboard.confirmCancel'))) return;
    setCancellingId(id);
    cancelLeaveRequest.mutate(id, {
      onSettled: () => setCancellingId(undefined),
      onError: (err) => {
        const code = err instanceof ApiError ? err.code : undefined;
        showError(translateApiErrorCode(code, t));
      },
    });
  };

  if (me.isLoading) {
    return <div className="main">…</div>;
  }

  if (me.isError || !me.data) {
    return (
      <div className="main">
        <p className="form-error">{t('errors.loadFailed')}</p>
        <button className="btn btn-primary" onClick={() => me.refetch()}>
          {t('errors.retry')}
        </button>
      </div>
    );
  }

  const needsOnboarding = !me.data.employmentStartDate;
  const region = (me.data.region as RegionCode) || DEFAULT_REGION;

  return (
    <main className="main">
      <YearNav year={selectedYear} onChange={handleYearChange} />

      {balance.isLoading && <p>{t('dashboard.loading')}</p>}
      {balance.isError && (
        <div className="form-group">
          <p className="form-error">{t('errors.loadFailed')}</p>
          <button className="btn btn-ghost" onClick={() => balance.refetch()}>
            {t('errors.retry')}
          </button>
        </div>
      )}
      {balance.data && <StatsCards stats={balance.data} />}

      <div className="actions">
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
          <Plus size={18} />
          {t('dashboard.requestVacation')}
        </button>
      </div>

      {leaveRequests.isLoading ? (
        <p>{t('dashboard.loading')}</p>
      ) : leaveRequests.isError ? (
        <div className="form-group">
          <p className="form-error">{t('errors.loadFailed')}</p>
          <button className="btn btn-ghost" onClick={() => leaveRequests.refetch()}>
            {t('errors.retry')}
          </button>
        </div>
      ) : (
        <RecordList
          records={leaveRequests.data ?? []}
          selectedYear={selectedYear}
          onCancel={handleCancel}
          cancellingId={cancellingId}
        />
      )}

      <PublicHolidays year={selectedYear} region={region} />

      {showAddForm && (
        <RecordModal
          region={region}
          onSubmit={handleCreate}
          onClose={() => setShowAddForm(false)}
          submitting={createLeaveRequest.isPending}
        />
      )}

      {needsOnboarding && (
        <WelcomeModal onSubmit={handleWelcomeSubmit} submitting={updateMe.isPending} />
      )}
    </main>
  );
}
