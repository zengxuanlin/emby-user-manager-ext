export function addUtcMonths(base: Date, months: number): Date {
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const date = base.getUTCDate();
  const hour = base.getUTCHours();
  const minute = base.getUTCMinutes();
  const second = base.getUTCSeconds();
  const ms = base.getUTCMilliseconds();

  const targetMonth = month + months;
  const result = new Date(Date.UTC(year, targetMonth, 1, hour, minute, second, ms));
  const daysInTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(date, daysInTargetMonth));
  return result;
}

export function nowUtc(): Date {
  return new Date();
}
