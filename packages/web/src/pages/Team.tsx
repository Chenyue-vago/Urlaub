import { useMemo, useState } from 'react';
import { useTranslation } from '../i18n';
import { useCalendar } from '../hooks/useCalendar';
import { TeamCalendar } from '../components/team/TeamCalendar';
import { formatDisplayDate } from '../utils';

function monthRange(year: number, month: number): { from: string; to: string } {
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 0));
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { from: fmt(from), to: fmt(to) };
}

export function Team() {
  const { t } = useTranslation();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getUTCFullYear(), month: now.getUTCMonth() });

  const { from, to } = useMemo(() => monthRange(cursor.year, cursor.month), [cursor]);
  const calendar = useCalendar({ from, to });

  const handlePrev = () => {
    setCursor((prev) => {
      const month = prev.month - 1;
      return month < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month };
    });
  };

  const handleNext = () => {
    setCursor((prev) => {
      const month = prev.month + 1;
      return month > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month };
    });
  };

  const handleThisMonth = () => {
    setCursor({ year: now.getUTCFullYear(), month: now.getUTCMonth() });
  };

  return (
    <main className="main">
      <header className="admin-hero">
        <div className="admin-hero-text">
          <h1 className="admin-hero-title">{t('team.title')}</h1>
          <p className="admin-hero-subtitle">{t('team.subtitle')}</p>
        </div>
      </header>

      <div className="timeline-nav">
        <button className="btn btn-ghost" onClick={handlePrev} aria-label={t('team.prevRange')}>
          {t('team.prevRange')}
        </button>
        <span className="timeline-nav-label">
          {t('team.rangeLabel', { from: formatDisplayDate(from), to: formatDisplayDate(to) })}
        </span>
        <button className="btn btn-ghost" onClick={handleThisMonth}>
          {t('team.thisMonth')}
        </button>
        <button className="btn btn-ghost" onClick={handleNext} aria-label={t('team.nextRange')}>
          {t('team.nextRange')}
        </button>
      </div>

      {calendar.isLoading ? (
        <p>{t('dashboard.loading')}</p>
      ) : calendar.isError ? (
        <div className="form-group">
          <p className="form-error">{t('errors.loadFailed')}</p>
          <button className="btn btn-ghost" onClick={() => calendar.refetch()}>
            {t('errors.retry')}
          </button>
        </div>
      ) : (
        <TeamCalendar entries={calendar.data ?? []} year={cursor.year} month={cursor.month} />
      )}
    </main>
  );
}
