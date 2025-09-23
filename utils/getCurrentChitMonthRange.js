export function getCurrentChitMonthRange(date = new Date()) {
  const day = date.getDate();
  const month = date.getMonth();  // 0–11
  const year = date.getFullYear();

  let startDate, endDate;

  if (day >= 10) {
    startDate = new Date(year, month, 10);             // 10th of current month
    endDate = new Date(year, month + 1, 9, 23, 59, 59, 999); // 9th of next month
  } else {
    startDate = new Date(year, month - 1, 10);        // 10th of previous month
    endDate = new Date(year, month, 9, 23, 59, 59, 999);    // 9th of current month
  }

  return { startDate, endDate };
}
