import { CONFIG } from './config';

export interface GameDate {
  year: number;
  /** 1-based month. */
  month: number;
  /** 1-based day of the month. */
  day: number;
}

/** Calendar date for a day count; day 0 is year 1, month 1, day 1. */
export function dateOf(elapsedDays: number): GameDate {
  const { daysPerMonth, monthsPerYear } = CONFIG.time;
  const totalMonths = Math.floor(elapsedDays / daysPerMonth);
  return {
    year: Math.floor(totalMonths / monthsPerYear) + 1,
    month: (totalMonths % monthsPerYear) + 1,
    day: (elapsedDays % daysPerMonth) + 1,
  };
}

/** True when `elapsedDays` is the first day of a new month (and not the founding day). */
export function isMonthStart(elapsedDays: number): boolean {
  return elapsedDays > 0 && elapsedDays % CONFIG.time.daysPerMonth === 0;
}
