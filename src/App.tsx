import { useState, useEffect, useMemo } from 'react';
import { VacationRecord, NewVacationRecord } from './types';
import {
  countWorkDays,
  countWorkDaysByYear,
  calculateYearlyStats,
  calculateCarryOver,
  formatDateString,
  formatDisplayDate,
} from './utils';
import { getPublicHolidays } from './holidays';
import {
  Calendar,
  Plus,
  Palmtree,
  Globe,
  MapPin,
  Settings,
  Shield,
  LogOut,
} from 'lucide-react';
import { LOCALES, Locale, useTranslation } from './i18n';
import { DEFAULT_REGION, REGIONS, RegionCode, getRegion } from './regions';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './components/Toast';
import { useVacations, useCreateVacations, useDeleteVacation } from './hooks/useVacations';
import { useEntitlementConfig } from './hooks/useSettings';
import { updateProfile } from './services/profile';
import { LoginPage } from './components/auth/LoginPage';
import { WelcomeModal } from './components/dashboard/WelcomeModal';
import { SettingsModal } from './components/dashboard/SettingsModal';
import { AdminPanel } from './components/admin/AdminPanel';
import { YearNav } from './components/dashboard/YearNav';
import { StatsCards } from './components/dashboard/StatsCards';
import { RecordModal } from './components/dashboard/RecordModal';
import { RecordList } from './components/dashboard/RecordList';
import { Profile } from './types';

function getUserLabel(profile: Profile): string {
  const name = profile.displayName?.trim();
  return name || profile.email;
}

function getUserInitials(profile: Profile): string {
  const name = profile.displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const local = profile.email.split('@')[0] ?? profile.email;
  return local.slice(0, 2).toUpperCase();
}

function App() {
  const { locale, setLocale, t } = useTranslation();
  const { profile, isAdmin, signOut, refreshProfile, loading: authLoading } = useAuth();
  const { showError } = useToast();

  const { data: records = [], isLoading: recordsLoading, isError: recordsError } =
    useVacations(profile?.id ?? '');
  const entitlement = useEntitlementConfig(!!profile);
  const createMutation = useCreateVacations(profile?.id ?? '');
  const deleteMutation = useDeleteVacation(profile?.id ?? '');

  const region: RegionCode = profile?.region ?? DEFAULT_REGION;
  const employmentStartDate = profile?.employmentStartDate ?? '';

  const [selectedYear, setSelectedYear] = useState(() => {
    const stored = localStorage.getItem('urlaub_selected_year');
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHolidays, setShowHolidays] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState<'dashboard' | 'admin'>('dashboard');

  useEffect(() => {
    localStorage.setItem('urlaub_selected_year', String(selectedYear));
  }, [selectedYear]);

  const handleRegionChange = async (newRegion: RegionCode) => {
    if (!profile) return;
    try {
      await updateProfile(profile.id, { region: newRegion });
      await refreshProfile();
    } catch {
      showError(t('common.saveFailed'));
    }
  };

  const handleEmploymentDateSave = async (date: string) => {
    if (!profile) return;
    try {
      await updateProfile(profile.id, { employmentStartDate: date });
      await refreshProfile();
      setShowSettings(false);
    } catch {
      showError(t('common.saveFailed'));
    }
  };

  const todayDate = new Date();
  const isCurrentYear = selectedYear === todayDate.getFullYear();
  const carryOverFromPreviousYear = isCurrentYear
    ? calculateCarryOver(records, selectedYear - 1, employmentStartDate, entitlement)
    : 0;
  const stats = calculateYearlyStats(
    records,
    selectedYear,
    carryOverFromPreviousYear,
    employmentStartDate,
    entitlement
  );

  const yearRecords = records
    .filter((r) => Number(r.year) === Number(selectedYear))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const publicHolidays = useMemo(
    () => getPublicHolidays(selectedYear, region),
    [selectedYear, region]
  );

  const currentRegion = getRegion(region);
  const regionLabel = locale === 'zh' ? currentRegion.nameZh : currentRegion.nameEn;

  function allocateDays(
    totalDays: number,
    periodEndDate: string,
    periodYear: number,
    tempRecords: VacationRecord[]
  ): { carryover: number; contractual: number; statutory: number } {
    const carryOverDeadlineStr = `${periodYear}-${entitlement.carryOverDeadline}`;
    const currentStats = calculateYearlyStats(
      tempRecords, periodYear, carryOverFromPreviousYear, employmentStartDate, entitlement
    );

    let remaining = totalDays;
    let carryoverDays = 0;
    let contractualDays = 0;
    let statutoryDays = 0;

    if (periodEndDate <= carryOverDeadlineStr && carryOverFromPreviousYear > 0) {
      const carryOverAvailable = Math.max(0, carryOverFromPreviousYear - currentStats.carryOverUsed);
      carryoverDays = Math.min(carryOverAvailable, remaining);
      remaining -= carryoverDays;
    }

    contractualDays = Math.min(currentStats.contractualRemaining, remaining);
    remaining -= contractualDays;
    statutoryDays = remaining;

    return { carryover: carryoverDays, contractual: contractualDays, statutory: statutoryDays };
  }

  const handleAddRecord = async (
    formStartDate: string,
    formEndDate: string,
    formDescription: string
  ) => {
    if (!profile) return;
    if (!formStartDate || !formEndDate || formStartDate > formEndDate) {
      alert(t('alert.invalidDateRange'));
      return;
    }

    const totalWorkDays = countWorkDays(formStartDate, formEndDate, region);
    if (totalWorkDays === 0) {
      alert(t('alert.noWorkDays'));
      return;
    }

    const splitByYear = countWorkDaysByYear(formStartDate, formEndDate, region);
    const desc = formDescription.trim();

    const newRecords: NewVacationRecord[] = [];
    const tempRecords = [...records];

    splitByYear.forEach((period) => {
      const alloc = allocateDays(period.days, period.endDate, period.year, tempRecords);

      if (alloc.carryover > 0) {
        newRecords.push({
          startDate: period.startDate,
          endDate: period.endDate,
          workDays: alloc.carryover,
          description: desc,
          type: 'statutory',
          isCarryOver: true,
          year: period.year,
        });
      }
      if (alloc.contractual > 0) {
        newRecords.push({
          startDate: period.startDate,
          endDate: period.endDate,
          workDays: alloc.contractual,
          description: desc,
          type: 'contractual',
          isCarryOver: false,
          year: period.year,
        });
      }
      if (alloc.statutory > 0) {
        newRecords.push({
          startDate: period.startDate,
          endDate: period.endDate,
          workDays: alloc.statutory,
          description: desc,
          type: 'statutory',
          isCarryOver: false,
          year: period.year,
        });
      }

      tempRecords.push(
        ...newRecords
          .filter((r) => r.year === period.year)
          .map((r, i) => ({
            ...r,
            id: `temp-${i}`,
            userId: profile.id,
            createdAt: new Date().toISOString(),
          }))
      );
    });

    try {
      await createMutation.mutateAsync(newRecords);
      setShowAddForm(false);
    } catch {
      showError(t('common.saveFailed'));
    }
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm(t('alert.confirmDelete'))) {
      deleteMutation.mutate(id, {
        onError: () => showError(t('common.saveFailed')),
      });
    }
  };

  const today = formatDateString(new Date());

  const handleYearChange = (delta: number) => {
    setSelectedYear((prev) => {
      const next = prev + delta;
      localStorage.setItem('urlaub_selected_year', String(next));
      return next;
    });
  };

  if (authLoading) {
    return <div className="app-loading">{t('common.loading')}</div>;
  }
  if (!profile) {
    return <LoginPage />;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="header-top">
            <div className="logo">
              <Palmtree size={32} />
              <h1>{t('app.title')}</h1>
            </div>
            <div className="header-controls">
              <div
                className="header-user"
                title={profile.email}
                aria-label={t('header.signedInAs', { name: getUserLabel(profile) })}
              >
                <span className="header-user-avatar" aria-hidden="true">
                  {getUserInitials(profile)}
                </span>
                <span className="header-user-text">
                  <span className="header-user-name">{getUserLabel(profile)}</span>
                  {profile.displayName?.trim() && (
                    <span className="header-user-email">{profile.email}</span>
                  )}
                </span>
                {isAdmin && (
                  <span className="header-user-badge">{t('nav.admin')}</span>
                )}
              </div>
              {isAdmin && (
                <nav className="header-nav" aria-label={t('nav.main')}>
                  <button
                    type="button"
                    className={view === 'dashboard' ? 'active' : ''}
                    onClick={() => setView('dashboard')}
                  >
                    {t('nav.dashboard')}
                  </button>
                  <button
                    type="button"
                    className={view === 'admin' ? 'active' : ''}
                    onClick={() => setView('admin')}
                  >
                    <Shield size={14} aria-hidden="true" />
                    {t('nav.admin')}
                  </button>
                </nav>
              )}
              <label className="header-select">
                <Globe size={16} />
                <span className="sr-only">{t('header.language')}</span>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                  aria-label={t('header.language')}
                >
                  {LOCALES.map((l) => (
                    <option key={l.code} value={l.code}>{l.nativeLabel}</option>
                  ))}
                </select>
              </label>
              <label className="header-select">
                <MapPin size={16} />
                <span className="sr-only">{t('header.region')}</span>
                <select
                  value={region}
                  onChange={(e) => handleRegionChange(e.target.value as RegionCode)}
                  aria-label={t('header.region')}
                >
                  {REGIONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {locale === 'zh' ? r.nameZh : r.nameEn}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="header-icon-btn"
                onClick={() => setShowSettings(true)}
                aria-label={t('header.settings')}
                title={t('header.settings')}
              >
                <Settings size={16} />
              </button>
              <button
                type="button"
                className="header-icon-btn"
                onClick={() => signOut()}
                aria-label={t('auth.signOut')}
                title={t('auth.signOut')}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
          <p className="subtitle">{t('app.subtitle')} · {regionLabel}</p>
        </div>
      </header>

      {!profile.employmentStartDate && (
        <WelcomeModal
          onSubmit={(date) => {
            handleEmploymentDateSave(date);
            setLocale('en');
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          initialDate={employmentStartDate}
          onSave={handleEmploymentDateSave}
          onClose={() => setShowSettings(false)}
        />
      )}

      {view === 'admin' && isAdmin ? (
        <AdminPanel />
      ) : (
        <main className="main" key={selectedYear}>
          <YearNav year={selectedYear} onChange={handleYearChange} />

          {recordsError && <div className="form-error">{t('common.loadFailed')}</div>}
          {recordsLoading && <div className="app-loading">{t('common.loading')}</div>}

          <StatsCards stats={stats} carryOverFromPreviousYear={carryOverFromPreviousYear} />

          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
              <Plus size={18} />
              {t('actions.addRecord')}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowHolidays(!showHolidays)}
            >
              <Calendar size={18} />
              {showHolidays ? t('actions.hideHolidays') : t('actions.showHolidays')}
            </button>
          </div>

          {showAddForm && (
            <RecordModal
              region={region}
              selectedYear={selectedYear}
              carryOverFromPreviousYear={carryOverFromPreviousYear}
              carryOverDeadline={entitlement.carryOverDeadline}
              onSubmit={(start, end, desc) => handleAddRecord(start, end, desc)}
              onClose={() => setShowAddForm(false)}
            />
          )}

          {showHolidays && (
            <div className="section">
              <h2>{t('records.holidaysTitle', { year: selectedYear, region: regionLabel })}</h2>
              <div className="holidays-grid">
                {publicHolidays.map((holiday) => {
                  const isPast = holiday.date < today;
                  const localizedName = locale === 'zh' ? holiday.nameZh : holiday.nameEn;
                  return (
                    <div key={holiday.date} className={`holiday-card ${isPast ? 'past' : ''}`}>
                      <div className="holiday-date">{formatDisplayDate(holiday.date)}</div>
                      <div className="holiday-name">{localizedName}</div>
                      <div className="holiday-name-de">{holiday.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <RecordList
            records={yearRecords}
            region={region}
            stats={stats}
            selectedYear={selectedYear}
            onDelete={handleDeleteRecord}
          />

          <div className="section rules">
            <h2>{t('rules.title')}</h2>
            <div className="rules-content">
              <div className="rule-item">
                <h4>{t('rules.totalTitle')}</h4>
                <p>{t('rules.totalBody')}</p>
              </div>
              <div className="rule-item">
                <h4>{t('rules.expiryTitle')}</h4>
                <p>
                  <strong>{t('rules.expiryBodyContractual')}</strong>
                  {t('rules.expiryBodyContractualDesc')}
                  <br />
                  <strong>{t('rules.expiryBodyStatutory')}</strong>
                  {t('rules.expiryBodyStatutoryDesc')}
                </p>
              </div>
              <div className="rule-item">
                <h4>{t('rules.leaveTitle')}</h4>
                <p>{t('rules.leaveBody')}</p>
              </div>
            </div>
          </div>
        </main>
      )}

      <footer className="footer">
        <p>{t('app.footer', { region: regionLabel, year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  );
}

export default App;
