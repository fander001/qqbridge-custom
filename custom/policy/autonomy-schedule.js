// Activity timing is independent of model prices and host timezone.
export function autonomyScheduleState(atMs, schedule = {}) {
  const ms = Number(atMs);
  const enabled = schedule?.enabled === true;
  const d = new Date(ms + 8 * 3600000);
  if (!Number.isFinite(ms) || Number.isNaN(d.getTime())) return { enabled, allowed: false, reason: 'invalid-time' };
  const date = d.toISOString().slice(0, 10);
  const weekday = d.getUTCDay() || 7;
  const minute = d.getUTCHours() * 60 + d.getUTCMinutes();
  const holiday = (schedule.holidays || []).includes(date);
  const days = schedule.peakWeekdays ?? [1,2,3,4,5];
  const windows = schedule.peakWindows ?? [['09:00','12:00'],['14:00','18:00']];
  const toMinute = t => { if (typeof t !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return NaN; const [h,m]=t.split(':').map(Number);return h*60+m; };
  if (!Array.isArray(days) || days.some(x=>!Number.isInteger(x)||x<1||x>7) || !Array.isArray(windows) || windows.some(w=>!Array.isArray(w)||w.length!==2||!Number.isFinite(toMinute(w[0]))||!Number.isFinite(toMinute(w[1]))||toMinute(w[0])>=toMinute(w[1]))) return {enabled,allowed:!enabled,reason:'invalid-schedule'};
  const peak = days.includes(weekday) && !holiday && windows.some(w => minute >= toMinute(w[0]) && minute < toMinute(w[1]));
  return { enabled, allowed: !enabled || !peak, reason: !enabled ? 'disabled' : peak ? 'peak' : 'off-peak',
    timeZone: 'Asia/Shanghai', date, holiday, calendarVerified: (schedule.verifiedHolidayYears || []).includes(d.getUTCFullYear()) };
}
export function nextAutonomyTransition(atMs, schedule = {}) {
  if (schedule?.enabled !== true || !Number.isFinite(Number(atMs))) return null;
  const current = autonomyScheduleState(atMs, schedule).allowed;
  let cursor = Math.floor(Number(atMs) / 60000) * 60000 + 60000;
  for (let i = 0; i < 32 * 24 * 60; i++, cursor += 60000) {
    if (autonomyScheduleState(cursor, schedule).allowed !== current) return cursor;
  }
  return null;
}
