// dateUtils.js - Utilities file for date calculations

import { differenceInCalendarMonths, startOfMonth } from 'date-fns';

export function getMonthIndex(startDate, currentDate = new Date()) {
  // Normalize to start of month for accurate calendar month difference
  const startMonth = startOfMonth(startDate);
  const currentMonth = startOfMonth(currentDate);
  // Calculate monthIndex as difference + 1 (month 1 is the start month)
  const monthIndex = differenceInCalendarMonths(currentMonth, startMonth) + 1;
  return monthIndex > 0 ? monthIndex : 1; // Ensure at least 1
}