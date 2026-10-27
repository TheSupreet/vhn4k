export function gw(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return (Math.abs(Number(value)) / 1000).toFixed(2);
}

export function signedGw(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const number = Number(value) / 1000;
  const sign = number > 0 ? "+" : "";
  return sign + number.toFixed(2);
}

export function mw(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Math.round(Number(value)).toLocaleString("en-GB");
}

export function plainMw(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const rounded = Math.round(Number(value));
  const sign = rounded < 0 ? "−" : "";
  return sign + Math.abs(rounded).toLocaleString("en-GB");
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

export function absPct(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Math.abs(Number(value)).toFixed(2)}%`;
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

export const axis = {
  grid: "#e8eef5",
  tick: "#64748b",
  actual: "#16a34a",
  forecast: "#0f766e",
  error: "#f97316",
  low: "#16a34a",
};

export const tooltipProps = {
  contentStyle: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 12,
    fontFamily: '"Segoe UI", system-ui, sans-serif',
  },
  labelStyle: { color: "#10233c" },
  itemStyle: { color: "#1e293b" },
};

export function tooltipValue(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Math.round(Number(value)).toLocaleString("en-GB");
}

export function axisMw(value) {
  return Number(value).toLocaleString("en-GB");
}
