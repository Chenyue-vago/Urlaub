import { useMemo } from 'react';
import type { CalendarEntry } from '../../services/calendar';
import { useTranslation } from '../../i18n';
import { formatShortDate } from '../../utils';

interface TeamTimelineProps {
  entries: CalendarEntry[];
  rangeStart: string;
  rangeEnd: string;
}

interface PersonRow {
  userId: string;
  displayName: string;
  entries: CalendarEntry[];
}

function toDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function TeamTimeline({ entries, rangeStart, rangeEnd }: TeamTimelineProps) {
  const { t } = useTranslation();

  const rangeStartDate = toDate(rangeStart);
  const rangeEndDate = toDate(rangeEnd);
  const totalDays = daysBetween(rangeStartDate, rangeEndDate) + 1;

  const rows = useMemo<PersonRow[]>(() => {
    const byUser = new Map<string, PersonRow>();
    for (const entry of entries) {
      const existing = byUser.get(entry.userId);
      if (existing) {
        existing.entries.push(entry);
      } else {
        byUser.set(entry.userId, {
          userId: entry.userId,
          displayName: entry.userDisplayName || entry.userId,
          entries: [entry],
        });
      }
    }
    return Array.from(byUser.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [entries]);

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <p>{t('team.empty')}</p>
      </div>
    );
  }

  return (
    <div className="timeline">
      <div className="timeline-legend">
        <span className="timeline-legend-item">
          <span className="timeline-legend-dot timeline-bar--statutory" />
          {t('team.legendStatutory')}
        </span>
        <span className="timeline-legend-item">
          <span className="timeline-legend-dot timeline-bar--contractual" />
          {t('team.legendContractual')}
        </span>
      </div>

      <div className="timeline-rows">
        {rows.map((row) => (
          <div key={row.userId} className="timeline-row">
            <div className="timeline-row-name" title={row.displayName}>
              {row.displayName}
            </div>
            <div className="timeline-row-track">
              {row.entries.map((entry) => {
                const entryStart = toDate(entry.startDate) < rangeStartDate ? rangeStartDate : toDate(entry.startDate);
                const entryEnd = toDate(entry.endDate) > rangeEndDate ? rangeEndDate : toDate(entry.endDate);
                const offsetDays = daysBetween(rangeStartDate, entryStart);
                const spanDays = daysBetween(entryStart, entryEnd) + 1;
                const leftPct = (offsetDays / totalDays) * 100;
                const widthPct = (spanDays / totalDays) * 100;
                return (
                  <div
                    key={entry.id}
                    className={`timeline-bar timeline-bar--${entry.type}`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={`${row.displayName}: ${formatShortDate(entry.startDate)} – ${formatShortDate(entry.endDate)}`}
                    data-testid="timeline-bar"
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
