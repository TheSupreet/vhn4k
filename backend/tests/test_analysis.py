"""Vintage selection and metric tests. No snapshot and no network."""

import math
from datetime import date

import pytest

from app.analysis import (
    build_day,
    canonical_ts,
    coverage,
    gate_closure,
    histogram,
    select_vintage,
    summarise,
)


def test_january_gate_is_0920_utc():
    gate = gate_closure(date(2026, 1, 15))
    assert canonical_ts(gate) == "2026-01-14T09:20:00Z"


def test_bst_gate_is_0820_utc():
    gate = gate_closure(date(2026, 6, 15))
    assert canonical_ts(gate) == "2026-06-14T08:20:00Z"


def test_latest_publish_before_gate_excludes_0930_and_exact_0920():
    gate = gate_closure(date(2026, 1, 15))
    rows = [
        {"publishTime": "2026-01-14T04:30:00Z", "generation": 100},
        {"publishTime": "2026-01-14T09:20:00Z", "generation": 8000},
        {"publishTime": "2026-01-14T09:30:00Z", "generation": 9000},
        {"publishTime": "2026-01-14T07:30:00Z", "generation": 1500},
    ]
    chosen = select_vintage(rows, gate)
    assert chosen["generation"] == 1500
    assert chosen["publishTime"] == "2026-01-14T07:30:00Z"


def test_publish_after_gate_returns_none():
    gate = gate_closure(date(2026, 1, 15))
    rows = [{"publishTime": "2026-01-14T09:30:00Z", "generation": 1}]
    assert select_vintage(rows, gate) is None


def test_half_hour_holds_hourly_forecast_and_sign():
    delivery = date(2026, 1, 15)
    actuals = {}
    forecasts = {}
    for hour in range(24):
        start = f"2026-01-15T{hour:02d}:00:00Z"
        half = f"2026-01-15T{hour:02d}:30:00Z"
        actuals[start] = 1000 + hour
        actuals[half] = 1100 + hour
        forecasts[start] = [
            {"publishTime": "2026-01-14T09:30:00Z", "generation": 9000},
            {"publishTime": "2026-01-14T09:20:00Z", "generation": 8000},
            {"publishTime": "2026-01-14T07:30:00Z", "generation": 1500},
        ]
    day = build_day(delivery, actuals, forecasts)
    assert len(day["periods"]) == 48
    on_hour = day["periods"][0]
    half_hour = day["periods"][1]
    assert on_hour["forecastHeld"] is False
    assert half_hour["forecastHeld"] is True
    assert on_hour["forecastMw"] == 1500
    assert half_hour["forecastMw"] == 1500
    assert on_hour["errorMw"] == 500
    assert half_hour["errorMw"] == 400
    assert on_hour["forecastPublishTime"] == "2026-01-14T07:30:00Z"
    assert day["vintagePublishTimes"] == ["2026-01-14T07:30:00Z"]
    assert "too high" in day["interpretation"]
    assert "under-procured" in day["interpretation"]


def test_missing_vintage_is_excluded_from_totals():
    day = build_day(date(2026, 1, 2), {"2026-01-02T00:00:00Z": 100}, {})
    assert day["periods"][0]["forecastMw"] is None
    assert day["periods"][0]["errorMw"] is None
    assert day["totals"]["paired"] == 0
    assert "cannot be scored" in day["interpretation"]


def test_metrics_and_mape_skips_zero_actual_only():
    pairs = [
        {"errorMw": 10, "actualMw": 100, "settlementPeriod": 1},
        {"errorMw": -10, "actualMw": 100, "settlementPeriod": 1},
        {"errorMw": 0, "actualMw": 0, "settlementPeriod": 2},
        {"errorMw": 20, "actualMw": 50, "settlementPeriod": 2},
    ]
    stats = summarise(pairs)
    assert stats["n"] == 4
    assert stats["maeMw"] == pytest.approx(10)
    assert stats["rmseMw"] == pytest.approx(math.sqrt(150))
    assert stats["biasMw"] == pytest.approx(5)
    assert stats["mapeN"] == 3
    assert stats["mapePct"] == pytest.approx(20)


def test_histogram_edges():
    buckets = {(item["fromMw"], item["toMw"]): item["count"] for item in histogram([0, -2000, 2000, 1999, -2001])}
    assert buckets[(0, 250)] == 1
    assert buckets[(-2000, -1000)] == 1
    assert buckets[(2000, None)] == 1
    assert buckets[(None, -2000)] == 1
    assert buckets[(1000, 2000)] == 1


def test_buffer_coverage_shortfall():
    rows = coverage([100, 400], [250])
    assert rows[0]["covered"] == 1
    assert rows[0]["uncovered"] == 1
    assert rows[0]["shortfallMwh"] == pytest.approx(75)
    assert rows[0]["coveragePct"] == pytest.approx(50)
