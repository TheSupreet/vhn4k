"""Load the in-repo Elexon snapshot. No network."""

from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path

from app.analysis import build_day, canonical_ts


class SnapshotMissing(FileNotFoundError):
    """Raised when actuals.json or forecasts.json is not on disk."""


class Store:
    def __init__(self, actuals: dict[str, float], forecasts: dict[str, list[dict]], meta: dict):
        self.actuals = actuals
        self.forecasts = forecasts
        self.meta = meta
        self._days: dict[date, dict] = {}

    def day(self, delivery: date) -> dict:
        cached = self._days.get(delivery)
        if cached is None:
            cached = build_day(delivery, self.actuals, self.forecasts)
            self._days[delivery] = cached
        return cached


def data_dir() -> Path:
    override = os.environ.get("DATA_DIR")
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[2] / "data"


def load_store(directory: Path | None = None) -> Store:
    folder = directory or data_dir()
    actual_path = folder / "actuals.json"
    forecast_path = folder / "forecasts.json"
    missing = [path.name for path in (actual_path, forecast_path) if not path.is_file()]
    if missing:
        raise SnapshotMissing(
            "Snapshot missing (%s). From the repo root run: python scripts/ingest.py" % ", ".join(missing)
        )
    actual_doc = json.loads(actual_path.read_text(encoding="utf-8"))
    forecast_doc = json.loads(forecast_path.read_text(encoding="utf-8"))
    actuals: dict[str, float] = {}
    for row in actual_doc["records"]:
        actuals[canonical_ts(row["startTime"])] = row["generation"]
    forecasts: dict[str, list[dict]] = {}
    for row in forecast_doc["records"]:
        key = canonical_ts(row["startTime"])
        forecasts.setdefault(key, []).append(
            {
                "publishTime": canonical_ts(row["publishTime"]),
                "generation": row["generation"],
            }
        )
    meta = {
        "actualsFetchedAt": actual_doc.get("fetchedAt"),
        "forecastsFetchedAt": forecast_doc.get("fetchedAt"),
        "actualRecords": len(actual_doc["records"]),
        "forecastRecords": len(forecast_doc["records"]),
    }
    return Store(actuals, forecasts, meta)


_STORE: Store | None = None


def get_store() -> Store:
    global _STORE
    if _STORE is None:
        _STORE = load_store()
    return _STORE
