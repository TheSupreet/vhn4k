export function gw(mw) {
  if (mw == null || Number.isNaN(Number(mw))) return "—";
  return (Number(mw) / 1000).toFixed(2);
}

export function signedGw(mw) {
  if (mw == null || Number.isNaN(Number(mw))) return "—";
  const value = Number(mw) / 1000;
  const sign = value > 0 ? "+" : "";
  return sign + value.toFixed(2);
}

export function mw(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Math.round(Number(value)).toLocaleString("en-GB");
}

export function signedMw(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const rounded = Math.round(Number(value));
  const sign = rounded > 0 ? "+" : "";
  return sign + rounded.toLocaleString("en-GB");
}

export function signedPct(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const number = Number(value);
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toFixed(1)}%`;
}

export function oneDecimal(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function clock(iso) {
  if (!iso) return "—";
  return iso.slice(11, 16);
}

export function stamp(iso) {
  if (!iso) return "—";
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function errorTone(value) {
  if (value == null || Number(value) === 0) return "flat";
  return Number(value) > 0 ? "high" : "low";
}

export const tooltipProps = {
  contentStyle: {
    background: "#12181f",
    border: "1px solid #2a3644",
    borderRadius: 0,
    fontSize: 12,
    fontFamily: '"Cascadia Mono", ui-monospace, Consolas, monospace',
  },
  labelStyle: { color: "#e6edf3" },
  itemStyle: { color: "#e6edf3" },
};

export function tooltipValue(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Math.round(Number(value)).toLocaleString("en-GB");
}
