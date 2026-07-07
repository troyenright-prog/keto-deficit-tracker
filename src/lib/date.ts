export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function addLocalDays(dateString: string, amount: number): string {
  if (!isDateString(dateString)) return localDateString();
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + amount);
  return localDateString(date);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// "7 July 2026" - day month year, spelled out. Deliberately not using
// toLocaleDateString/Intl: those follow the device's locale, so the same
// build would render "July 7, 2026" on a US-locale phone and "07/07/2026"
// elsewhere - this format needs to be identical everywhere.
export function formatLongDate(dateString: string): string {
  if (!isDateString(dateString)) return dateString;
  const [year, month, day] = dateString.split('-').map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}
