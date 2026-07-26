// Vacation-day math and holiday-aware date utilities live in @urlaub/shared
// (see packages/shared/src/entitlement.ts, dates.ts). This module only keeps
// small formatting helpers that are specific to the web UI.

// 格式化显示日期 (德国格式 DD.MM.YYYY)
export function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
}

// 短日期 (DD.MM.) — 用在已经有年份上下文的列表里
export function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${day}.${month}.`;
}
