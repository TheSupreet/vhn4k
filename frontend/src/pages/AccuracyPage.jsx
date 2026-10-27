import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getJson } from "../api";
import { axis, mw, oneDecimal, signedMw, signedPct, stamp, tooltipProps, tooltipValue } from "../format";

export default function AccuracyPage() {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancel = false;
    Promise.all([
      getJson("/api/accuracy"),
      getJson("/api/series?from=2026-01-01&to=2026-01-31"),
    ])
      .then(([accuracy, series]) => {
        if (!cancel) setState({ status: "ready", accuracy, series });
      })
      .catch((error) => {
        if (!cancel) setState({ status: "error", error: error.message });
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (state.status === "loading") return <p className="status">Scoring January 2026…</p>;
  if (state.status === "error") return <p className="status error">{state.error}</p>;

  const { accuracy, series } = state;
  const summary = accuracy.summary;
  const biasTone = summary.biasMw > 0 ? "high" : summary.biasMw < 0 ? "low" : "flat";

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Forecast accuracy</h1>
          <p className="lede">
            Error of the gate-closure wind forecast across every January 2026 half-hour. Positive error is an overforecast.
          </p>
        </div>
      </div>

      <p className="caveat">{accuracy.caveat}</p>

      <div className="stats">
        <article className="kpi">
          <div className="kpi-label">MAE</div>
          <div className="kpi-value">{oneDecimal(summary.maeMw)}<span>MW</span></div>
          <div className="kpi-sub">{summary.n.toLocaleString("en-GB")} paired half-hours</div>
        </article>
        <article className="kpi">
          <div className="kpi-label">RMSE</div>
          <div className="kpi-value">{oneDecimal(summary.rmseMw)}<span>MW</span></div>
          <div className="kpi-sub">population, not sample</div>
        </article>
        <article className={`kpi ${biasTone}`}>
          <div className="kpi-label">Bias</div>
          <div className="kpi-value">{signedMw(summary.biasMw)}<span>MW</span></div>
          <div className="kpi-sub">mean forecast − actual</div>
        </article>
        <article className="kpi">
          <div className="kpi-label">MAPE</div>
          <div className="kpi-value">{summary.mapePct == null ? "—" : `${Number(summary.mapePct).toFixed(1)}`}<span>%</span></div>
          <div className="kpi-sub">{summary.mapeN.toLocaleString("en-GB")} periods with actual ≥ 1 MW</div>
        </article>
      </div>

      <div className="two">
        <section className="panel">
          <h2>MAE by settlement period</h2>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={accuracy.byPeriod} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={axis.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: axis.tick, fontSize: 11 }} interval={3} />
                <YAxis tick={{ fill: axis.tick, fontSize: 11 }} width={56} />
                <Tooltip {...tooltipProps} formatter={(value, name) => [tooltipValue(value), name]} />
                <Bar dataKey="maeMw" name="MAE MW" fill={axis.error} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <h2>Error histogram</h2>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={accuracy.histogram} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
                <CartesianGrid stroke={axis.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: axis.tick, fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={48} />
                <YAxis tick={{ fill: axis.tick, fontSize: 11 }} width={40} allowDecimals={false} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="count" name="Half-hours" fill={axis.forecast} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="panel">
        <h2>Month error strip</h2>
        <div className="chart short">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={axis.grid} vertical={false} />
              <XAxis
                dataKey="startTime"
                tick={{ fill: axis.tick, fontSize: 11 }}
                interval={47}
                tickFormatter={(value) => (value && value.slice(11, 16) === "00:00" ? value.slice(8, 10) : "")}
              />
              <YAxis tick={{ fill: axis.tick, fontSize: 11 }} width={56} />
              <Tooltip
                {...tooltipProps}
                labelFormatter={(value) => value}
                formatter={(value, name) => [tooltipValue(value), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="errorMw" name="Error MW" stroke={axis.error} dot={false} strokeWidth={1} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="note">Each point is one half-hour. Neighbouring points share an hourly forecast, so the strip is smoother than 1,488 independent errors.</p>
      </section>

      <section className="panel">
        <h2>Firm buffer</h2>
        <p className="note">
          A buffer is extra non-wind power bought because the forecast might be high.
          A half-hour is covered when the overforecast is no larger than the buffer.
          Shortfall MWh is the energy still missing after that buffer.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Buffer MW</th>
                <th>Covered</th>
                <th>Coverage</th>
                <th>Uncovered</th>
                <th>Shortfall MWh</th>
              </tr>
            </thead>
            <tbody>
              {accuracy.coverage.map((row) => (
                <tr key={row.bufferMw}>
                  <td>{mw(row.bufferMw)}</td>
                  <td>{row.covered.toLocaleString("en-GB")}</td>
                  <td>{signedPct(row.coveragePct).replace("+", "")}</td>
                  <td>{row.uncovered.toLocaleString("en-GB")}</td>
                  <td>{mw(row.shortfallMwh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="foot">
        Snapshot actuals {stamp(accuracy.snapshot.actualsFetchedAt)} · forecasts {stamp(accuracy.snapshot.forecastsFetchedAt)}.
      </p>
    </section>
  );
}
