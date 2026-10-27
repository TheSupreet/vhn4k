import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getJson } from "../api";
import {
  absPct,
  axis,
  axisMw,
  clock,
  errorTone,
  gw,
  mw,
  plainMw,
  tooltipProps,
  tooltipValue,
} from "../format";

const PAGE_SIZE = 14;

function reading(totals) {
  if (totals?.errorMwMean == null) return "This day cannot be scored.";
  const amount = gw(totals.errorMwMean);
  const pct = absPct(totals.errorPct);
  if (totals.errorMwMean > 1) {
    return `The forecast overestimated actual wind generation by ${amount} GW on average (${pct}).`;
  }
  if (totals.errorMwMean < -1) {
    return `The forecast underestimated actual wind generation by ${amount} GW on average (${pct}).`;
  }
  return "The forecast matched average outturn.";
}

export default function DecisionDesk() {
  const [date, setDate] = useState("2026-01-15");
  const [page, setPage] = useState(0);
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancel = false;
    setState({ status: "loading" });
    setPage(0);
    getJson(`/api/decision?date=${date}`)
      .then((data) => {
        if (!cancel) setState({ status: "ready", data });
      })
      .catch((error) => {
        if (!cancel) setState({ status: "error", error: error.message });
      });
    return () => {
      cancel = true;
    };
  }, [date]);

  const data = state.status === "ready" ? state.data : null;
  const periods = data?.periods || [];
  const totals = data?.totals;
  const tone = errorTone(totals?.errorMwMean);
  const publish = data?.vintagePublishTimes?.[0];
  const pages = Math.max(1, Math.ceil(periods.length / PAGE_SIZE));
  const shown = periods.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const fromRow = periods.length ? page * PAGE_SIZE + 1 : 0;
  const toRow = Math.min(periods.length, (page + 1) * PAGE_SIZE);

  const chartData = useMemo(
    () => periods.map((period) => ({ ...period, label: String(period.settlementPeriod) })),
    [periods],
  );

  const used = periods.filter((period) => period.forecastPublishTime).length;
  const late = periods.filter((period) => clock(period.forecastPublishTime) === "09:30").length;
  const share = (count) => (periods.length ? `${((count / periods.length) * 100).toFixed(1)}%` : "—");

  return (
    <section>
      <h1>Decision desk</h1>
      <label className="date-field">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" />
          <path d="M2 6.5h12M5 2v2.5M11 2v2.5" stroke="currentColor" strokeLinecap="round" />
        </svg>
        <input
          type="date"
          min="2026-01-01"
          max="2026-01-31"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>

      {state.status === "loading" && <p className="status">Loading {date}…</p>}
      {state.status === "error" && <p className="status error">{state.error}</p>}

      {data && (
        <>
          <div className="desk-top">
            <article className="card">
              <h2>Vintage & publish times</h2>
              <div className="vintage-grid">
                <div>
                  <div className="v-label">Gate closure</div>
                  <div className="v-time">09:20</div>
                  <div className="v-note">(London)</div>
                </div>
                <div>
                  <div className="v-label">Decision publish</div>
                  <div className="v-time">{clock(publish)}</div>
                  <div className="v-note">(used)</div>
                </div>
                <div>
                  <div className="v-label">09:30 file</div>
                  <div className="v-note bad">(not used)</div>
                  <div className="v-x">×</div>
                </div>
              </div>
              <div className="timeline" aria-hidden="true">
                <div className="timeline-line" />
                <span className="dot gate" />
                <span className="dot used" />
                <span className="dot late">×</span>
              </div>
              <p className="fine">Publish at or after 09:20 (including 09:30) is not used.</p>
            </article>

            <div className="kpi-stack">
              <div className="kpis">
                <article className="kpi">
                  <div className="kpi-label">Forecast</div>
                  <div className="kpi-value">{gw(totals.forecastMwMean)}<small>GW</small></div>
                  <div className="kpi-sub">(mean)</div>
                </article>
                <article className="kpi">
                  <div className="kpi-label">Actual</div>
                  <div className="kpi-value">{gw(totals.actualMwMean)}<small>GW</small></div>
                  <div className="kpi-sub">(mean)</div>
                </article>
                <article className={`kpi ${tone}`}>
                  <div className="kpi-label">Error</div>
                  <div className="kpi-value">{gw(totals.errorMwMean)}<small>GW</small></div>
                  <div className="kpi-sub">(mean)</div>
                </article>
                <article className={`kpi ${tone}`}>
                  <div className="kpi-label">Error %</div>
                  <div className="kpi-value">{absPct(totals.errorPct)}</div>
                  <div className="kpi-sub">(mean)</div>
                </article>
              </div>
              <div className="callout">
                <span className="info-dot">i</span>
                <p>{reading(totals)}</p>
              </div>
            </div>
          </div>

          <section className="card chart-card">
            <h2>Forecast vs Actual Wind (and Error)</h2>
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 28, right: 8, left: 8, bottom: 18 }}>
                  <CartesianGrid stroke={axis.grid} vertical={false} />
                  <XAxis
                    dataKey="settlementPeriod"
                    tick={{ fill: axis.tick, fontSize: 11 }}
                    interval={2}
                    label={{ value: "Settlement Period (SP)", position: "bottom", offset: 0, fill: axis.tick, fontSize: 12 }}
                  />
                  <YAxis
                    yAxisId="mw"
                    tick={{ fill: axis.tick, fontSize: 11 }}
                    width={64}
                    tickFormatter={axisMw}
                    label={{ value: "Wind (MW)", angle: -90, position: "insideLeft", fill: axis.tick, fontSize: 12 }}
                  />
                  <YAxis
                    yAxisId="err"
                    orientation="right"
                    tick={{ fill: axis.tick, fontSize: 11 }}
                    width={56}
                    tickFormatter={axisMw}
                    label={{ value: "Error (MW)", angle: 90, position: "insideRight", fill: axis.tick, fontSize: 12 }}
                  />
                  <Tooltip {...tooltipProps} formatter={(value, name) => [tooltipValue(value), name]} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: 12, color: "#334155" }}
                    payload={[
                      { value: "Actual (MW)", type: "line", color: axis.actual },
                      { value: "Forecast (MW)", type: "line", color: axis.forecast },
                      { value: "Error (MW)", type: "square", color: axis.error },
                    ]}
                  />
                  <Bar yAxisId="err" dataKey="errorMw" name="Error (MW)" barSize={6} isAnimationActive={false}>
                    {chartData.map((row) => (
                      <Cell key={row.startTime} fill={row.errorMw < 0 ? axis.low : axis.error} />
                    ))}
                  </Bar>
                  <Line yAxisId="mw" dataKey="actualMw" name="Actual (MW)" stroke={axis.actual} dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line yAxisId="mw" dataKey="forecastMw" name="Forecast (MW)" stroke={axis.forecast} dot={false} strokeWidth={2} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="desk-bottom">
            <section className="card">
              <h2>Settlement Periods ({periods.length} rows)</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>SP</th>
                      <th>Start Time</th>
                      <th>Forecast (MW)</th>
                      <th>Actual (MW)</th>
                      <th>Error (MW)</th>
                      <th>Vintage</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((period) => (
                      <tr key={period.startTime} className={errorTone(period.errorMw)}>
                        <td>{period.settlementPeriod}</td>
                        <td>{clock(period.startTime)}</td>
                        <td>{mw(period.forecastMw)}</td>
                        <td>{mw(period.actualMw)}</td>
                        <td className="err">{plainMw(period.errorMw)}</td>
                        <td>Publish · {clock(period.forecastPublishTime)}</td>
                        <td>{period.forecastHeld ? "Held" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pager">
                <span>Showing {fromRow}–{toRow} of {periods.length} rows</span>
                <div className="pager-btns">
                  <button type="button" onClick={() => setPage((current) => current - 1)} disabled={page === 0} aria-label="Previous page">‹</button>
                  {Array.from({ length: pages }, (_, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-current={index === page ? "page" : undefined}
                      onClick={() => setPage(index)}
                    >
                      {index + 1}
                    </button>
                  ))}
                  <button type="button" onClick={() => setPage((current) => current + 1)} disabled={page >= pages - 1} aria-label="Next page">›</button>
                </div>
              </div>
            </section>

            <section className="card">
              <h2>Error by Settlement Period</h2>
              <div className="chart mini">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 16 }}>
                    <CartesianGrid stroke={axis.grid} vertical={false} />
                    <XAxis
                      dataKey="settlementPeriod"
                      tick={{ fill: axis.tick, fontSize: 11 }}
                      interval={7}
                      label={{ value: "SP", position: "bottom", offset: 0, fill: axis.tick, fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: axis.tick, fontSize: 11 }} width={48} tickFormatter={axisMw} />
                    <Tooltip {...tooltipProps} formatter={(value) => [tooltipValue(value), "Error (MW)"]} />
                    <Bar dataKey="errorMw" barSize={5} isAnimationActive={false}>
                      {chartData.map((row) => (
                        <Cell key={row.startTime} fill={row.errorMw < 0 ? axis.low : axis.error} />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Vintage</th>
                    <th>Count</th>
                    <th>% of rows</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Gate · 09:20</td>
                    <td>{periods.length}</td>
                    <td>{share(periods.length)}</td>
                  </tr>
                  <tr>
                    <td>Decision publish (used)</td>
                    <td>{used}</td>
                    <td>{share(used)}</td>
                  </tr>
                  <tr>
                    <td>09:30 file (not used)</td>
                    <td>{late}</td>
                    <td>{share(late)}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </section>
  );
}
