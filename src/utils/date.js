export function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

export function formatMonthLabel(value) {
  try {
    return new Date(`${value}-01`).toLocaleString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

export function shiftMonthString(value, offset = 1) {
  const date = new Date(`${value}-01`);
  date.setMonth(date.getMonth() - offset);
  return date.toISOString().slice(0, 7);
}

export function isToday(value) {
  return new Date(value).toDateString() === new Date().toDateString();
}
