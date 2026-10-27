"""Vintage selection and error metrics for the day-ahead wind desk.

Pure functions only. WINDFOR is hourly. Each HH:30 settlement period holds the
decision forecast of the clock hour that contains it. January 2026 has no
clock change, so Europe/London midnight is 00:00 UTC.
"""

from __future__ import annotations

import math
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

LONDON = ZoneInfo("Europe/London")
WINDOW_START = date(2026, 1, 1)
WINDOW_END = date(2026, 1, 31)

HISTOGRAM_EDGES = [-2000, -1000, -500, -250, 0, 250, 500, 1000, 2000]
BUFFERS_MW = [0, 250, 500, 1000, 2000]

CAVEAT = (
    "National GB wind only, from Elexon FUELHH and WINDFOR. "
    "This is not a customer portfolio, not a price, and not a bid. "
    "The window is January 2026 only. WINDFOR is an hourly forecast, so each "
    "HH:30 period reuses the HH:00 decision forecast and the 48 half-hours are not independent."
)


def canonical_ts(value: str | datetime) -> str:
    return parse_ts(value).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_ts(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        moment = value
    else:
        moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc)


def in_window(day: date) -> bool:
    return WINDOW_START <= day <= WINDOW_END


def gate_closure(delivery: date) -> datetime:
    """09:20 Europe/London on the day before delivery. The cutoff is strict."""
    local = datetime.combine(delivery - timedelta(days=1), time(9, 20), tzinfo=LONDON)
    return local.astimezone(timezone.utc)


def select_vintage(rows: list[dict], gate: datetime) -> dict | None:
    """Latest row whose publishTime is strictly before the gate."""
    best = None
    best_published = None
    for row in rows:
        published = parse_ts(row["publishTime"])
        if published < gate and (best_published is None or published > best_published):
            best = row
            best_published = published
    return best


def iter_half_hours(delivery: date) -> list[datetime]:
    start = datetime.combine(delivery, time(0, 0), tzinfo=LONDON)
    return [start + timedelta(minutes=30 * index) for index in range(48)]


def settlement_period(moment: datetime) -> int:
    local = moment.astimezone(LONDON)
    return local.hour * 2 + (local.minute // 30) + 1


def _hour_key(moment: datetime) -> str:
    hour = moment.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return hour.strftime("%Y-%m-%dT%H:%M:%SZ")


def build_day(
    delivery: date,
    actuals: dict[str, float],
    forecasts: dict[str, list[dict]],
) -> dict:
    gate = gate_closure(delivery)
    periods = []
    for moment in iter_half_hours(delivery):
        utc = moment.astimezone(timezone.utc).replace(microsecond=0)
        start_key = utc.strftime("%Y-%m-%dT%H:%M:%SZ")
        vintage = select_vintage(forecasts.get(_hour_key(utc), []), gate)
        actual_mw = actuals.get(start_key)
        forecast_mw = None if vintage is None else vintage["generation"]
        publish = None if vintage is None else canonical_ts(vintage["publishTime"])
        error_mw = None
        if forecast_mw is not None and actual_mw is not None:
            error_mw = forecast_mw - actual_mw
        periods.append(
            {
                "settlementPeriod": settlement_period(moment),
                "startTime": start_key,
                "forecastMw": forecast_mw,
                "forecastPublishTime": publish,
                "forecastHeld": utc.minute == 30,
                "actualMw": actual_mw,
                "errorMw": error_mw,
            }
        )
    totals = day_totals(periods)
    publish_times = sorted(
        {period["forecastPublishTime"] for period in periods if period["forecastPublishTime"]}
    )
    return {
        "date": delivery.isoformat(),
        "gateClosure": canonical_ts(gate),
        "vintagePublishTimes": publish_times,
        "periods": periods,
        "totals": totals,
        "interpretation": interpretation(delivery, totals["errorMwMean"]),
    }


def day_totals(periods: list[dict]) -> dict:
    paired = [period for period in periods if period["errorMw"] is not None]
    count = len(paired)
    if count == 0:
        return {
            "periods": len(periods),
            "paired": 0,
            "forecastMwMean": None,
            "actualMwMean": None,
            "errorMwMean": None,
            "errorPct": None,
            "forecastMwh": None,
            "actualMwh": None,
            "errorMwh": None,
        }
    forecast_mean = sum(period["forecastMw"] for period in paired) / count
    actual_mean = sum(period["actualMw"] for period in paired) / count
    error_mean = sum(period["errorMw"] for period in paired) / count
    forecast_mwh = sum(period["forecastMw"] for period in paired) * 0.5
    actual_mwh = sum(period["actualMw"] for period in paired) * 0.5
    error_pct = None if actual_mean == 0 else (error_mean / actual_mean) * 100
    return {
        "periods": len(periods),
        "paired": count,
        "forecastMwMean": forecast_mean,
        "actualMwMean": actual_mean,
        "errorMwMean": error_mean,
        "errorPct": error_pct,
        "forecastMwh": forecast_mwh,
        "actualMwh": actual_mwh,
        "errorMwh": forecast_mwh - actual_mwh,
    }


def interpretation(delivery: date, error_mw_mean: float | None) -> str:
    label = f"{delivery.day} {delivery.strftime('%b')}"
    if error_mw_mean is None:
        return f"On {label} there is no paired forecast and outturn, so this day cannot be scored."
    gigawatts = abs(error_mw_mean) / 1000
    if error_mw_mean > 1:
        return (
            f"On {label} the 09:20 decision forecast was {gigawatts:.1f} GW too high. "
            "A desk that trusted it would have under-procured."
        )
    if error_mw_mean < -1:
        return (
            f"On {label} the 09:20 decision forecast was {gigawatts:.1f} GW too low. "
            "A desk that trusted it would have over-procured."
        )
    return f"On {label} the 09:20 decision forecast was within 1 MW of average outturn."


def paired_errors(periods: list[dict]) -> list[dict]:
    return [period for period in periods if period["errorMw"] is not None]


def summarise(pairs: list[dict]) -> dict:
    count = len(pairs)
    if count == 0:
        return {
            "n": 0,
            "maeMw": None,
            "rmseMw": None,
            "biasMw": None,
            "mapePct": None,
            "mapeN": 0,
        }
    errors = [pair["errorMw"] for pair in pairs]
    mae = sum(abs(error) for error in errors) / count
    rmse = math.sqrt(sum(error * error for error in errors) / count)
    bias = sum(errors) / count
    mape_terms = [
        abs(pair["errorMw"]) / abs(pair["actualMw"])
        for pair in pairs
        if pair["actualMw"] is not None and abs(pair["actualMw"]) >= 1
    ]
    mape = None if not mape_terms else (sum(mape_terms) / len(mape_terms)) * 100
    return {
        "n": count,
        "maeMw": mae,
        "rmseMw": rmse,
        "biasMw": bias,
        "mapePct": mape,
        "mapeN": len(mape_terms),
    }


def by_settlement_period(pairs: list[dict]) -> list[dict]:
    grouped: dict[int, list[dict]] = {period: [] for period in range(1, 49)}
    for row in pairs:
        grouped[row["settlementPeriod"]].append(row)
    rows = []
    for period in range(1, 49):
        stats = summarise(grouped[period])
        hour = (period - 1) // 2
        minute = 30 if period % 2 == 0 else 0
        rows.append(
            {
                "settlementPeriod": period,
                "label": f"{hour:02d}:{minute:02d}",
                "n": stats["n"],
                "maeMw": stats["maeMw"],
                "biasMw": stats["biasMw"],
            }
        )
    return rows


def histogram(errors: list[float]) -> list[dict]:
    edges = HISTOGRAM_EDGES
    labels = [f"< {edges[0]}"]
    labels.extend(f"{left} to {right}" for left, right in zip(edges, edges[1:]))
    labels.append(f">= {edges[-1]}")
    counts = [0 for _ in labels]
    for value in errors:
        if value < edges[0]:
            counts[0] += 1
            continue
        placed = False
        for index in range(len(edges) - 1):
            if edges[index] <= value < edges[index + 1]:
                counts[index + 1] += 1
                placed = True
                break
        if not placed:
            counts[-1] += 1
    lower = [None, *edges]
    upper = [*edges, None]
    return [
        {"label": label, "fromMw": lower[index], "toMw": upper[index], "count": counts[index]}
        for index, label in enumerate(labels)
    ]


def coverage(errors: list[float], buffers: list[float] | None = None) -> list[dict]:
    chosen = BUFFERS_MW if buffers is None else buffers
    count = len(errors)
    rows = []
    for buffer in chosen:
        uncovered = [error for error in errors if error > buffer]
        covered = count - len(uncovered)
        shortfall_mwh = sum((error - buffer) * 0.5 for error in uncovered)
        rows.append(
            {
                "bufferMw": buffer,
                "n": count,
                "covered": covered,
                "uncovered": len(uncovered),
                "coveragePct": None if count == 0 else (covered / count) * 100,
                "shortfallMwh": shortfall_mwh,
            }
        )
    return rows


def month_report(days: list[dict]) -> dict:
    pairs: list[dict] = []
    for day in days:
        pairs.extend(paired_errors(day["periods"]))
    errors = [pair["errorMw"] for pair in pairs]
    return {
        "summary": summarise(pairs),
        "byPeriod": by_settlement_period(pairs),
        "histogram": histogram(errors),
        "coverage": coverage(errors),
        "caveat": CAVEAT,
    }
