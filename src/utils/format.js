/**
 * Formats a week string like "W14" into "W14 (T.4)" 
 * based on an approximate 2026 month mapping.
 */
export const formatWeekWithMonth = (w) => {
  if (!w) return '';
  const num = parseInt(w.toString().replace(/\D/g, ''));
  if (isNaN(num)) return w;
  
  let month = 0;
  if (num <= 4) month = 1;
  else if (num <= 8) month = 2;
  else if (num <= 13) month = 3;
  else if (num <= 17) month = 4;
  else if (num <= 22) month = 5;
  else if (num <= 26) month = 6;
  else if (num <= 30) month = 7;
  else if (num <= 35) month = 8;
  else if (num <= 39) month = 9;
  else if (num <= 44) month = 10;
  else if (num <= 48) month = 11;
  else month = 12;
  
  return `W${num} (T.${month})`;
};
