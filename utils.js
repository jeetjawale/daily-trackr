// utils.js - Pure helper functions

export function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

export function shiftDay(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function formatDay(dateStr) {
  const diff = Math.round(
    (new Date(dateStr + 'T12:00:00') - new Date(todayStr() + 'T12:00:00')) / 86400000
  );
  const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
  if (diff === -1) return 'Yesterday · ' + dateLabel;
  return dateLabel;
}

export function getLast30() {
  return Array.from({ length: 30 }, (_, i) => shiftDay(todayStr(), i - 29));
}

export function getWeekDates(dateStr) {
  const dt  = new Date(dateStr + 'T12:00:00');
  const mon = new Date(dt);
  mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function parseFuzzyTime(raw) {
  if (!raw) return null;
  const s   = raw.trim().toLowerCase().replace(/\s/g, '');
  const pm  = s.includes('pm');
  const am  = s.includes('am');
  const clean = s.replace('am', '').replace('pm', '');
  const parts = clean.includes(':') ? clean.split(':') : [clean, '0'];
  let h = parseInt(parts[0]);
  let m = parseInt(parts[1]) || 0;
  if (isNaN(h)) return null;
  if (h > 23 || m > 59) return null;
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  return h * 60 + m;
}
