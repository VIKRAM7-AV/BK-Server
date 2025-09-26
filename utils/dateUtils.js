// dateUtils.js - Utilities file for date calculations

import { differenceInCalendarMonths, startOfMonth, differenceInCalendarDays, addMonths } from 'date-fns';

export function getMonthIndex(startDate, currentDate = new Date()) {
  // Normalize to start of month for accurate calendar month difference
  const startMonth = startOfMonth(startDate);
  const currentMonth = startOfMonth(currentDate);
  // Calculate monthIndex as difference + 1 (month 1 is the start month)
  const monthIndex = differenceInCalendarMonths(currentMonth, startMonth) + 1;
  return monthIndex > 0 ? monthIndex : 1; // Ensure at least 1
}


export function getDayIndex(startDate, currentDate = new Date()) {
  const start = new Date(startDate);
  const today = new Date(currentDate);

  // Align chit start always from 10th
  const chitStart =
    start.getDate() < 10
      ? new Date(start.getFullYear(), start.getMonth() - 1, 10)
      : new Date(start.getFullYear(), start.getMonth(), 10);

  // Find cycle start
  let cycleStart = new Date(chitStart);
  while (today >= addMonths(cycleStart, 1)) {
    cycleStart = addMonths(cycleStart, 1);
  }

  // Return day number inside this cycle (1..30/31)
  return differenceInCalendarDays(today, cycleStart) + 1;
}
