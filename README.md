# Day-Ahead Wind Desk

Pilot for a UK day-ahead buying desk. It shows the national wind forecast a trader could have used when the GB auction closed, then scores that forecast against what the wind actually produced.

The screen name is **Day-Ahead Wind Desk**. This folder stays `vhn4k`.

Scope is national GB wind only, from Elexon BMRS only, for purchase decisions in January 2026.

**Docker is local only.** `docker compose` runs the API and the React app on your machine. **Vercel is the live host:** one project, a Python serverless function around this same FastAPI app, plus the static Vite build. Vercel does not run the Dockerfile or Docker Compose.

Live app: `https://YOUR-PROJECT.vercel.app`

Replace that placeholder after you deploy. This copy has not been deployed.

Built with Cursor.

Keep the GitHub repo anonymous. Publish this folder as its own public repo named `vhn4k`. Do not publish the parent `D:\projects` tree, and do not put a personal name in the README, the Vercel project, or the commit history.

## What the desk does

1. **Decision.** For a delivery day D in January 2026, take the latest WINDFOR vintage whose `publishTime` is still strictly before 09:20 Europe/London on D−1. That is the EPEX SPOT GB 60-minute day-ahead gate. Show it against FUELHH wind outturn for each half-hour.
2. **Accuracy.** Score that decision forecast over the month: MAE, RMSE, bias, MAPE, error by settlement period, a histogram, and how often a firm buffer of N MW would have covered an overforecast.

Error = forecast MW − actual MW. A positive error means the forecast was too high. A desk that trusted it would have bought too little other power.

WINDFOR in this snapshot is hourly. Each HH:30 reuses the HH:00 decision forecast and is marked held. The selector is not hardcoded to 07:30. In this snapshot the 09:30 file is ten minutes after the gate, so 15 January uses the 14 January 07:30 UTC file. The decision page prints the publish time it actually used.

On the current snapshot, 15 January 2026 reads:

- Gate `2026-01-14T09:20:00Z`
- Decision vintage `2026-01-14T07:30:00Z`
- Mean forecast 11.61 GW, mean outturn 10.57 GW, error +1.04 GW (+9.9%)
- Sentence: the 09:20 decision forecast was 1.0 GW too high, so a desk that trusted it would have under-procured

January, 1,488 paired half-hours: MAE 2,145 MW, RMSE 2,616 MW, bias +1,852 MW, MAPE 22.4%. Bias is positive, so the month’s miss is a systematic overforecast, not noise around zero.

## Files and directories

```
vhn4k/
  README.md                      this file, including the video script
  docker-compose.yml             local only: api :8000, web :80
  vercel.json                    Vite build, function timeout, snapshot included
  pyproject.toml                 Vercel entrypoint api.index:app, pytest path
  requirements.txt               runtime deps Vercel installs (same pins as backend/)
  requirements-dev.txt           pytest only; not installed in the API image
  .python-version                3.12 for Vercel and Docker
  .gitignore
  api/index.py                   Vercel entry; imports the FastAPI app
  data/actuals.json              1,488 FUELHH WIND half-hours, January 2026
  data/forecasts.json            18,080 WINDFOR rows, every vintage for those hours
  scripts/ingest.py              one Elexon pull; rewrites the two JSON files
  backend/Dockerfile             local API image; Vercel does not run it
  backend/requirements.txt       fastapi, uvicorn, httpx, tzdata
  backend/app/main.py            /health /api/decision /api/accuracy /api/series
  backend/app/elexon.py          stream client; ingest imports it, the API does not
  backend/app/analysis.py        gate, vintage selection, HH:30 hold, metrics
  backend/app/snapshot.py        loads the JSON once
  backend/tests/test_analysis.py vintage and metric tests
  frontend/Dockerfile            local nginx image; Vercel does not run it
  frontend/nginx.conf            proxies /api and /health to the api service
  frontend/package.json
  frontend/vite.config.js        dev proxy to localhost:8000
  frontend/index.html
  frontend/src/App.jsx           shell and routes
  frontend/src/pages/DecisionDesk.jsx
  frontend/src/pages/AccuracyPage.jsx
  frontend/src/pages/Methodology.jsx
```

`frontend/node_modules/` and `frontend/dist/` are build output. They are gitignored.

## Run locally with Docker

From this folder:

```
docker compose up --build
```

- Desk: http://localhost
- Health: http://localhost:8000/health
- One day: http://localhost:8000/api/decision?date=2026-01-15

The UI container listens on port 80. If that port is taken, change the host side of `"80:80"` in `docker-compose.yml` (for example `"8080:80"`) and open that port.

Stop with Ctrl+C, or `docker compose down`.

## Run locally without Docker

Python 3.12 matches Docker and Vercel. Python 3.11 is enough for a local venv.

```
python -m venv .venv
```

Windows:

```
.venv\Scripts\activate
pip install -r backend\requirements.txt
pip install -r requirements-dev.txt
uvicorn app.main:app --app-dir backend --port 8000
```

macOS or Linux:

```
source .venv/bin/activate
pip install -r backend/requirements.txt
pip install -r requirements-dev.txt
uvicorn app.main:app --app-dir backend --port 8000
```

Second terminal, from `frontend/`:

```
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` and `/health` to port 8000.

Tests, from the repo root with the venv active:

```
pytest
```

## Refresh the snapshot

The running API does not call Elexon. Ingest does. No API key.

From the repo root, with the venv active:

```
python scripts/ingest.py
```

That overwrites `data/actuals.json` and `data/forecasts.json`, then checks:

- 1,488 wind half-hours and 31 settlement dates
- more than one WINDFOR publish time, including vintages after the gate
- every January decision vintage is strictly before its own 09:20 gate

Restart the API after a refresh so it reloads the files. The current snapshot was fetched at `2026-10-26T20:52:13Z`. Publish clocks in it are 02:30, 04:30, 07:30, 09:30, 11:30, 12:25, 15:30, 18:30, and 22:30 UTC. 10,392 of the stored forecast rows are after the gate for their delivery hour. They stay in the file so the selector can reject them. They are not deleted at ingest time.

WINDFOR without `publishDateTimeFrom` / `publishDateTimeTo` returns only the latest file. That is not a day-ahead decision. Ingest requests weekly publish windows from 29 December 2025 through 1 February 2026 so 1 January has a D−1 vintage.

## Deploy on Vercel

One project. The root directory is this folder, not `frontend/` or `backend/` alone. No environment variables.

1. Create a new public GitHub repo named `vhn4k` from this folder only.
2. Import it in Vercel. `pyproject.toml` sets `tool.vercel.entrypoint = "api.index:app"`. `vercel.json` builds the Vite app and includes `data/**` in the function.
3. Deploy. `api/index.py` imports the same FastAPI app the laptop runs. API routes stay ahead of the built UI, so `/`, `/accuracy`, and `/methodology` work on one host.
4. Paste the deployment URL over `https://YOUR-PROJECT.vercel.app` at the top of this file.
5. Open the repo, the app, and the video in a private window before you submit them.

Docker Compose is not part of that deployment.

## Analysis rule

For delivery day D:

- Gate = 09:20 Europe/London on D−1. A publish at 09:20 exactly is excluded.
- Actual = FUELHH `WIND` at half-hour t. `generation` is average MW.
- Forecast = the WINDFOR row for the clock hour of t with the latest `publishTime` still before the gate. HH:30 holds that MW.
- Metrics are population stats over paired half-hours. MAPE skips an actual below 1 MW. MAE, RMSE, and bias keep that period.
- A buffer of N MW covers a half-hour when the error is less than or equal to N.

The Methodology page in the app is the same rule, written for a reader of the screen. `backend/tests/test_analysis.py` locks the gate, the 09:30 rejection, the exact-09:20 rejection, the half-hour hold, a summer clock (09:20 London = 08:20 UTC), and the four metrics.

## API

- `GET /health`
- `GET /api/decision?date=2026-01-15` — 48 half-hours, gate, vintage, totals, one procurement sentence
- `GET /api/accuracy` — month MAE, RMSE, bias, MAPE, by settlement period, histogram, buffers 0 / 250 / 500 / 1000 / 2000 MW
- `GET /api/series?from=2026-01-01&to=2026-01-31` — aligned points for the charts

A date outside January 2026 returns 400.

## Video script

One unlisted YouTube video, at most 10 minutes. Part 1 and part 2 are each at most 5 minutes. Say less rather than run long. The numbers below are this snapshot; if you re-run ingest, read the cards on the day you record.

### Part 1 — client (about 4 minutes)

Open the decision desk on 15 January 2026.

“This is the pilot for the day-ahead desk. You buy the power that wind will not cover. The GB hourly auction closes at 09:20 London time the day before delivery. A wind file published after that is not a number you could have bid against.”

“This page is 15 January. The gate was 14 January, 09:20. The vintage on screen is 14 January 07:30 UTC. Elexon also published a file at 09:30 that morning. That file is in the data, and it is ignored, because it is ten minutes late.”

“The cards are national wind, not your portfolio. Forecast about 11.6 GW, outturn about 10.6 GW, error about 1.0 GW high, roughly 10 percent. The sentence under the cards is the procurement reading: a desk that trusted this forecast would have under-procured other power.”

“The chart is the 48 half-hours. Amber is the decision forecast, cyan is outturn, bars are the error. Half-past the hour is marked held. The published forecast is hourly and the meter is half-hourly, so half-past reuses the hour’s forecast. We do not invent a half-hour number Elexon did not publish.”

Switch to Accuracy.

“Across January the typical miss, MAE, is about 2,100 MW. Bias is about plus 1,900 MW, so the forecast ran high on average, not just on this one day. The histogram shows how often that miss is a few hundred megawatts versus a gigawatt. The buffer table is the desk question: if we hold an extra N megawatts of firm power because we do not trust the forecast, what share of half-hours does that cover, and how much energy is still short.”

“The caveat is on the page. This is national GB wind from Elexon only, January 2026 only. It is not your sites, not a price, and not a bid.”

### Part 2 — tech lead (about 4 minutes)

Open the repo, then `backend/app/analysis.py` and `scripts/ingest.py`.

“FastAPI in `backend/app`, React 18 and Vite in `frontend/`. `main.py` is health, decision, accuracy, and series. `analysis.py` is pure Python: no pandas, no numpy. `snapshot.py` only reads JSON. `elexon.py` is the HTTP client, and the web process does not import it.”

“`scripts/ingest.py` pulls FUELHH wind for January and WINDFOR with publish-time filters, in weekly chunks from 29 December, so 1 January has a D−1 file. Without a publish window, WINDFOR returns the latest forecast only, which would leak the future into a backtest. The script writes both JSON files, including vintages published after the gate. Selection happens when the API reads the snapshot, not by deleting the late files.”

“The snapshot exists because the live host is a short Vercel function with no disk. Fetching a month of WINDFOR on every request can fail a demo. Ingest is how you refresh. Docker Compose is the local run, API on 8000 and nginx on 80. Vercel does not run those containers. `api/index.py` re-exports the same FastAPI app, and `pyproject.toml` points the Vercel entrypoint at it.”

“`select_vintage` keeps the latest publish strictly before 09:20 Europe/London on D−1. The tests reject 09:30, reject a publish at 09:20 exactly, hold HH:30, check that 09:20 in summer is 08:20 UTC, and check MAE, RMSE, bias, and MAPE. A zero actual drops out of MAPE only.”

“Left out on purpose: auth, a database, other fuels, prices, bidding, live Elexon on the request, and a large test suite. The two jobs are the decision vintage and the error band.”

## Still to submit

Not done from this folder:

- Public GitHub repo `vhn4k`, opened in a private window
- One Vercel deploy, URL pasted over the placeholder above, opened in a private window
- Unlisted YouTube video from the script, at most 10 minutes, link checked in a private window
- The form named in the brief: Full Stack SWE challenge submission v4

## Out of scope

Auth, databases, other fuels, prices, bidding, live Elexon on each request, a component library, and a large test suite.
