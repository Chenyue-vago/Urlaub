import { useMemo } from 'react';
import type { CalendarEntry } from '../../services/calendar';
import { useTranslation } from '../../i18n';

interface TeamCalendarProps {
  entries: CalendarEntry[];
  year: number;
  /** 0-based month index (0 = January), matching Date semantics. */
  month: number;
}

interface Person {
  userId: string;
  name: string;
}

interface DayCell {
  date: string;
  day: number;
  people: Person[];
}

/** Max chips shown per day before collapsing into a "+N" pill. */
const MAX_CHIPS = 3;

/** Accessible, high-contrast chip colors; assigned per person deterministically. */
const PALETTE = [
  '#2f6b4f', '#3b6ea5', '#8a5a2b', '#7a3e9d',
  '#a53860', '#2b7a78', '#8a6d00', '#4a5568',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function colorFor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Month calendar overview: one cell per day, each listing everyone whose
 * approved leave covers that day. Each person gets a stable color so they are
 * easy to track across days. Deliberately does NOT distinguish statutory vs
 * contractual — it only answers "who is off, and when".
 */
export function TeamCalendar({ entries, year, month }: TeamCalendarProps) {
  const { t, locale } = useTranslation();
  const today = todayIso();

  const cells = useMemo<DayCell[]>(() => {
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const result: DayCell[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${pad(month + 1)}-${pad(day)}`;
      const byUser = new Map<string, Person>();
      for (const e of entries) {
        if (e.startDate <= date && date <= e.endDate) {
          if (!byUser.has(e.userId)) {
            byUser.set(e.userId, { userId: e.userId, name: e.userDisplayName || e.userId });
          }
        }
      }
      const people = [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name));
      result.push({ date, day, people });
    }
    return result;
  }, [entries, year, month]);

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))));
  }, [locale]);

  // Monday-first: blanks before day 1 so it lands under the right weekday.
  const leadingBlanks = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;

  return (
    <div className="team-calendar">
      <div className="team-calendar-grid team-calendar-weekdays">
        {weekdayLabels.map((label, i) => (
          <div
            key={i}
            className={`team-calendar-weekday${i >= 5 ? ' team-calendar-weekday--weekend' : ''}`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="team-calendar-grid">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} className="team-calendar-cell team-calendar-cell--blank" />
        ))}
        {cells.map((cell) => {
          const weekday = (new Date(`${cell.date}T00:00:00.000Z`).getUTCDay() + 6) % 7;
          const isWeekend = weekday >= 5;
          const isToday = cell.date === today;
          const visible = cell.people.slice(0, MAX_CHIPS);
          const overflow = cell.people.length - visible.length;
          return (
            <div
              key={cell.date}
              className={[
                'team-calendar-cell',
                isWeekend ? 'team-calendar-cell--weekend' : '',
                isToday ? 'team-calendar-cell--today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-testid={`day-${cell.date}`}
            >
              <span className="team-calendar-daynum">{cell.day}</span>
              <div className="team-calendar-people">
                {visible.map((p) => (
                  <span
                    key={p.userId}
                    className="team-calendar-chip"
                    style={{ backgroundColor: colorFor(p.userId) }}
                    title={p.name}
                  >
                    {firstName(p.name)}
                  </span>
                ))}
                {overflow > 0 && (
                  <span
                    className="team-calendar-chip team-calendar-chip--more"
                    title={cell.people.map((p) => p.name).join(', ')}
                  >
                    +{overflow}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {entries.length === 0 && (
        <div className="empty-state">
          <p>{t('team.empty')}</p>
        </div>
      )}
    </div>
  );
}
