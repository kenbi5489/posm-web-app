const getCustomWeekNumber = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 0;
  d.setHours(0, 0, 0, 0);

  const jan1 = new Date(d.getFullYear(), 0, 1);
  const jan1Day = jan1.getDay(); // 0=Sun, 5=Fri
  const daysToFirstFri = (5 - jan1Day + 7) % 7;
  const firstFriday = new Date(jan1);
  firstFriday.setDate(jan1.getDate() + daysToFirstFri);

  const dayOfWeek = d.getDay();
  const daysSinceFri = (dayOfWeek - 5 + 7) % 7; // Fri=0, Sat=1, ..., Thu=6
  const currentWeekStart = new Date(d);
  currentWeekStart.setDate(d.getDate() - daysSinceFri);

  if (currentWeekStart < firstFriday) return 0;

  const diffDays = Math.round((currentWeekStart - firstFriday) / 86400000);
  return Math.floor(diffDays / 7) + 1;
};
console.log("April 8:", getCustomWeekNumber('2026-04-08T12:00:00+07:00'));
console.log("April 9:", getCustomWeekNumber('2026-04-09T12:00:00+07:00'));
console.log("April 9 (now):", getCustomWeekNumber(new Date()));
console.log("April 10:", getCustomWeekNumber('2026-04-10T12:00:00+07:00'));
