/**
 * Custom week calculation following company rule:
 * - A week runs from Friday (week N) to Thursday (week N+1)
 * - W1 starts on the first Friday of the year
 * 
 * Example 2026:
 *   Jan 1 = Thu → first Friday = Jan 2
 *   W1:  Jan 2 (Fri) – Jan 8 (Thu)
 *   W14: Apr 3 (Fri) – Apr 9 (Thu)  ← today Thu Apr 9 = W14 ✓
 *   W15: Apr 10 (Fri) onwards
 */
export const getCustomWeekNumber = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 0;
  d.setHours(0, 0, 0, 0);

  // First Friday of the year
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const jan1Day = jan1.getDay(); // 0=Sun, 5=Fri
  const daysToFirstFri = (5 - jan1Day + 7) % 7;
  const firstFriday = new Date(jan1);
  firstFriday.setDate(jan1.getDate() + daysToFirstFri);

  // Friday of d's week (current week start)
  const dayOfWeek = d.getDay();
  const daysSinceFri = (dayOfWeek - 5 + 7) % 7; // Fri=0, Sat=1, ..., Thu=6
  const currentWeekStart = new Date(d);
  currentWeekStart.setDate(d.getDate() - daysSinceFri);

  if (currentWeekStart < firstFriday) return 0;

  const diffDays = Math.round((currentWeekStart - firstFriday) / 86400000);
  return Math.floor(diffDays / 7) + 1;
};

/**
 * Returns the current week label string, e.g. "W14"
 */
export const getCurrentWeekLabel = () => {
  const num = getCustomWeekNumber(new Date());
  return num > 0 ? `W${num}` : 'W??';
};
