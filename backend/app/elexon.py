"""Elexon BMRS stream client used by scripts/ingest.py only.

The request path of the web app does not import this module.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone

import httpx

from app.analysis import canonical_ts

BASE = "https://data.elexon.co.uk/bmrs/api/v1"
RETRY_STATUS = {429, 500, 502, 503, 504}
JAN_START = "2026-01-01T00:00:00Z"
JAN_END = "2026-02-01T00:00:00Z"


def publish_windows() -> list[tuple[str, str]]:
    """Weekly publish windows from 29 Dec 2025 through 1 Feb 2026.

    Neighbouring windows overlap by one hour so a file published on a
    boundary is not dropped. Ingest dedupes (publishTime, startTime).
    """
    start = datetime(2025, 12, 29, tzinfo=timezone.utc)
    end = datetime(2026, 2, 1, tzinfo=timezone.utc)
    windows = []
    cursor = start
    while cursor < end:
        nxt = min(cursor + timedelta(days=7), end)
        to = end if nxt >= end else min(nxt + timedelta(hours=1), end)
        windows.append(
            (
                cursor.strftime("%Y-%m-%dT%H:%M:%SZ"),
                to.strftime("%Y-%m-%dT%H:%M:%SZ"),
            )
        )
        cursor = nxt
    return windows


def fetch_json(client: httpx.Client, path: str, params: dict) -> list:
    url = f"{BASE}{path}"
    last_detail = "no response"
    for attempt in range(3):
        try:
            response = client.get(url, params=params, headers={"Accept": "application/json"})
        except httpx.HTTPError as exc:
            last_detail = str(exc)
            time.sleep(2**attempt)
            continue
        if response.status_code in RETRY_STATUS:
            last_detail = f"HTTP {response.status_code}: {response.text[:300]}"
            time.sleep(2**attempt)
            continue
        response.raise_for_status()
        payload = response.json()
        if isinstance(payload, dict) and "data" in payload:
            payload = payload["data"]
        if not isinstance(payload, list):
            raise RuntimeError(f"Unexpected payload from {path}: {type(payload).__name__}")
        return payload
    raise RuntimeError(f"{path} failed after retries: {last_detail}")


def _number(value) -> int | float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return value


def fetch_actuals(client: httpx.Client) -> list[dict]:
    rows = fetch_json(
        client,
        "/datasets/FUELHH/stream",
        {
            "fuelType": "WIND",
            "settlementDateFrom": "2026-01-01",
            "settlementDateTo": "2026-01-31",
        },
    )
    best: dict[str, dict] = {}
    for row in rows:
        if row.get("fuelType") not in (None, "WIND"):
            continue
        generation = _number(row.get("generation"))
        if generation is None or "startTime" not in row:
            continue
        start_time = canonical_ts(row["startTime"])
        record = {
            "startTime": start_time,
            "settlementDate": row.get("settlementDate"),
            "settlementPeriod": row.get("settlementPeriod"),
            "generation": generation,
            "_publish": canonical_ts(row["publishTime"]) if row.get("publishTime") else "",
        }
        current = best.get(start_time)
        if current is None or record["_publish"] >= current["_publish"]:
            best[start_time] = record
    records = []
    for record in best.values():
        record.pop("_publish", None)
        records.append(record)
    records.sort(key=lambda item: item["startTime"])
    return records


def fetch_forecasts(client: httpx.Client) -> tuple[list[dict], list[tuple[str, str, int]]]:
    seen: set[tuple[str, str]] = set()
    records = []
    window_counts = []
    for start, end in publish_windows():
        rows = fetch_json(
            client,
            "/datasets/WINDFOR/stream",
            {"publishDateTimeFrom": start, "publishDateTimeTo": end},
        )
        kept = 0
        for row in rows:
            generation = _number(row.get("generation"))
            if generation is None or "startTime" not in row or "publishTime" not in row:
                continue
            start_time = canonical_ts(row["startTime"])
            if start_time < JAN_START or start_time >= JAN_END:
                continue
            publish_time = canonical_ts(row["publishTime"])
            key = (publish_time, start_time)
            if key in seen:
                continue
            seen.add(key)
            kept += 1
            records.append(
                {
                    "startTime": start_time,
                    "publishTime": publish_time,
                    "generation": generation,
                }
            )
        window_counts.append((start, end, kept))
    records.sort(key=lambda item: (item["startTime"], item["publishTime"]))
    return records, window_counts
