// Fixed locale so server and client render identical strings (no hydration mismatches).
const integer = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return integer.format(value);
}

/** 842 → "842", 1240 → "1.2k", 12500 → "12.5k", 120000 → "120k". */
export function formatCompact(value: number): string {
  if (value < 1000) return String(value);
  const thousands = value / 1000;
  const text = thousands >= 100 ? String(Math.round(thousands)) : thousands.toFixed(1).replace(/\.0$/, "");
  return `${text}k`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}
