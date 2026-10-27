"""Pull January 2026 Elexon wind actuals and forecast vintages into data/."""

from __future__ import annotations

import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.analysis import build_day, gate_closure, parse_ts  # noqa: E402
from app.elexon import fetch_actuals, fetch_forecasts  # noqa: E402
from app.snapshot import load_store  # noqa: E402

import httpx  # noqa: E402


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def dump(path: Path, document: dict) -> None:
    path.write_text(json.dumps(document, separators=(",", ":")) + "\n", encoding="utf-8")


def expected_starts() -> list[str]:
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return [
        (start + timedelta(minutes=30 * index)).strftime("%Y-%m-%dT%H:%M:%SZ")
        for index in range(31 * 48)
    ]


def main() -> None:
    fetched_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    timeout = httpx.Timeout(180.0, connect=30.0)
    with httpx.Client(timeout=timeout) as client:
        print("Fetching FUELHH WIND 2026-01-01 to 2026-01-31")
        actuals = fetch_actuals(client)
        print(f"  unique wind half-hours: {len(actuals)}")
        forecasts, windows = fetch_forecasts(client)
        for start, end, kept in windows:
            print(f"  WINDFOR {start} -> {end}: kept {kept} January rows")

    data_dir = ROOT / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    actual_doc = {
        "dataset": "FUELHH",
        "fuelType": "WIND",
        "settlementDateFrom": "2026-01-01",
        "settlementDateTo": "2026-01-31",
        "fetchedAt": fetched_at,
        "records": actuals,
    }
    forecast_doc = {
        "dataset": "WINDFOR",
        "publishDateTimeFrom": "2025-12-29T00:00:00Z",
        "publishDateTimeTo": "2026-02-01T00:00:00Z",
        "note": "All vintages whose startTime falls in January 2026. The desk selects the vintage later.",
        "fetchedAt": fetched_at,
        "records": forecasts,
    }
    dump(data_dir / "actuals.json", actual_doc)
    dump(data_dir / "forecasts.json", forecast_doc)
    print(f"Wrote {data_dir / 'actuals.json'} and {data_dir / 'forecasts.json'}")

    starts = {row["startTime"] for row in actuals}
    missing = [item for item in expected_starts() if item not in starts]
    dates = {row["settlementDate"] for row in actuals}
    require(len(actuals) == 1488, f"Expected 1488 wind actuals, got {len(actuals)}")
    require(not missing, f"Missing actual half-hours, first: {missing[:8]}")
    require(len(dates) == 31, f"Expected 31 settlement dates, got {sorted(dates)}")
    require(all(str(item).startswith("2026-01-") for item in dates), f"Settlement dates left January: {dates}")

    store = load_store(data_dir)
    publish_times = {
        row["publishTime"] for rows in store.forecasts.values() for row in rows
    }
    clocks = sorted({item[11:16] for item in publish_times})
    odd_steps = [
        key for key in store.forecasts if not key.endswith(":00:00Z")
    ]
    post_gate = 0
    for start_key, rows in store.forecasts.items():
        delivery = date.fromisoformat(start_key[:10])
        gate = gate_closure(delivery)
        for row in rows:
            if parse_ts(row["publishTime"]) >= gate:
                post_gate += 1

    print(f"WINDFOR rows kept: {len(forecasts)}")
    print(f"distinct publish times: {len(publish_times)}")
    print(f"publish clocks UTC: {', '.join(clocks)}")
    print(f"non-hourly forecast start times: {len(odd_steps)}")
    print(f"post-gate vintages stored and ignored by the desk: {post_gate}")

    require(len(forecasts) > 1000, f"Forecast snapshot is too small: {len(forecasts)}")
    require(len(publish_times) >= 20, "Expected multiple WINDFOR vintages")
    require(len(clocks) >= 2, f"Expected more than one publish clock, got {clocks}")
    require(post_gate > 0, "Snapshot has no post-gate vintage, so selection cannot be demonstrated")

    generations = list(store.actuals.values())
    require(min(generations) >= 0, "Negative wind actual")
    require(max(generations) > 1000, "Wind actuals do not look like MW")
    require(sum(generations) / len(generations) > 500, "Mean wind actual is implausibly small")

    day = date(2026, 1, 1)
    while day <= date(2026, 1, 31):
        built = build_day(day, store.actuals, store.forecasts)
        gate = built["gateClosure"]
        require(len(built["periods"]) == 48, f"{day} did not return 48 periods")
        require(built["totals"]["paired"] == 48, f"{day} paired {built['totals']['paired']} of 48")
        for period in built["periods"]:
            publish = period["forecastPublishTime"]
            require(publish is not None and publish < gate, f"{day} vintage {publish} is not before {gate}")
        day += timedelta(days=1)

    sample = build_day(date(2026, 1, 15), store.actuals, store.forecasts)
    print(f"2026-01-15 gate: {sample['gateClosure']}")
    print(f"2026-01-15 decision vintage(s): {', '.join(sample['vintagePublishTimes'])}")
    print(sample["interpretation"])
    print("checks passed")


if __name__ == "__main__":
    main()
