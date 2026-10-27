"""HTTP API for the day-ahead wind desk.

Reads the in-repo Elexon snapshot. It does not call Elexon.
"""

from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.analysis import in_window, month_report
from app.snapshot import SnapshotMissing, get_store

app = FastAPI(title="Day-Ahead Wind Desk", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _round(value):
    if isinstance(value, float):
        return round(value, 1)
    if isinstance(value, list):
        return [_round(item) for item in value]
    if isinstance(value, dict):
        return {key: _round(item) for key, item in value.items()}
    return value


def _parse_day(value: str) -> date:
    try:
        day = date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Date must be YYYY-MM-DD") from exc
    if not in_window(day):
        raise HTTPException(status_code=400, detail="Date must be in January 2026")
    return day


def _store():
    try:
        return get_store()
    except SnapshotMissing as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _snapshot_meta(store) -> dict:
    return {
        "actualsFetchedAt": store.meta["actualsFetchedAt"],
        "forecastsFetchedAt": store.meta["forecastsFetchedAt"],
        "actualRecords": store.meta["actualRecords"],
        "forecastRecords": store.meta["forecastRecords"],
    }


def _january():
    day = date(2026, 1, 1)
    while day <= date(2026, 1, 31):
        yield day
        day += timedelta(days=1)


@app.get("/health")
def health():
    return {"status": "ok", "service": "day-ahead-wind-desk"}


@app.get("/api/decision")
def decision(day: str = Query(..., alias="date")):
    delivery = _parse_day(day)
    store = _store()
    payload = store.day(delivery)
    return _round({**payload, "snapshot": _snapshot_meta(store)})


@app.get("/api/accuracy")
def accuracy():
    store = _store()
    payload = month_report([store.day(day) for day in _january()])
    payload["snapshot"] = _snapshot_meta(store)
    return _round(payload)


@app.get("/api/series")
def series(
    from_day: str = Query(..., alias="from"),
    to_day: str = Query(..., alias="to"),
):
    start = _parse_day(from_day)
    end = _parse_day(to_day)
    if start > end:
        raise HTTPException(status_code=400, detail="from must be on or before to")
    store = _store()
    points = []
    day = start
    while day <= end:
        points.extend(store.day(day)["periods"])
        day += timedelta(days=1)
    return _round(
        {
            "from": start.isoformat(),
            "to": end.isoformat(),
            "points": points,
            "snapshot": _snapshot_meta(store),
        }
    )


def _attach_frontend() -> None:
    if os.environ.get("SERVE_FRONTEND", "1") == "0":
        return
    dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if not dist.is_dir():
        return
    frontend = getattr(app, "frontend", None)
    if callable(frontend):
        try:
            frontend("/", directory=str(dist), fallback="index.html")
            return
        except TypeError:
            pass
    index = dist / "index.html"
    root = dist.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    def frontend_files(full_path: str):
        if full_path:
            candidate = (dist / full_path).resolve()
            if candidate.is_file() and (candidate == root or root in candidate.parents):
                return FileResponse(candidate)
        return FileResponse(index)


_attach_frontend()
