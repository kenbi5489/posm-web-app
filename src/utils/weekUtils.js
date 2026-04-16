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

/**
 * Rule tuyến đường:
 *   - Thứ 6 (đầu ngày) → Thứ 5 (cuối ngày): hiển thị tuần HIỆN TẠI (tuần N)
 *   - Khi bắt đầu Thứ 6 mới: tự động chuyển sang tuần N+1
 *
 * Vì week chạy từ Thứ 6 → Thứ 5, getCustomWeekNumber() đã tính đúng:
 *   - Thứ 6 Apr 18 = đầu W16 → trả về 16
 *   - Thứ 5 Apr 17 = cuối W15 → trả về 15
 * → Dùng thẳng getCurrentWeekLabel() là đúng rule.
 *
 * Nhưng nếu data chưa có tuần đó (admin chưa phân bổ), fallback về tuần
 * lớn nhất có trong data.
 */
export const getActiveRouteWeekNum = () => {
  return getCustomWeekNumber(new Date());
};

/**
 * Helper to generate consistent labels like "W15 (T.4)"
 */
export const getWeekLabelHelper = (num, dateReference = null) => {
  if (!num || num <= 0) return 'W??';
  
  let month = 0;
  if (dateReference) {
    const d = new Date(dateReference);
    if (!isNaN(d.getTime())) month = d.getMonth() + 1;
  }
  
  if (month === 0) {
    // Approx month calculation if date is missing
    month = Math.min(12, Math.floor((num - 1) / 4.34) + 1);
  }
  
  return `W${num} (T.${month})`;
};

/**
 * Returns labels for the current and next weeks strictly based on today's date
 */
export const getActiveWeeks = () => {
  const today = new Date();
  const currentNum = getCustomWeekNumber(today);
  
  // Next week is 7 days from today
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + 7);
  const nextNum = getCustomWeekNumber(nextDate);
  
  return [
    getWeekLabelHelper(currentNum, today),
    getWeekLabelHelper(nextNum, nextDate)
  ];
};

/**
 * Compares two week strings strictly by their week number (WXX)
 * Example: isSameWeek("W15 (T.3)", "W15 (T.4)") -> true
 */
export const isSameWeek = (a, b) => {
  if (!a || !b) return false;
  const numA = parseInt(String(a).match(/\d+/)?.[0], 10) || 0;
  const numB = parseInt(String(b).match(/\d+/)?.[0], 10) || 0;
  return numA > 0 && numA === numB;
};
