import { useEffect, useState } from "react";
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
  clock,
  errorTone,
  gw,
  mw,
  signedGw,
  signedMw,
  signedPct,
  stamp,
  tooltipProps,
  tooltipValue,
} from "../format";

export default function DecisionDesk() {
  const [date, setDate] = useState("2026-01-15");
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancel = false;
    setState({ status: "loading" });
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
  const totals = data?.totals;
  const tone = errorTone(totals?.errorMwMean);
  const chart = (data?.periods || []).map((period) => ({
    ...period,
    label: clock(period.startTime),
  }));

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Decision desk</h1>
          <p className="lede">
            National wind the desk could have used at EPEX GB day-ahead gate closure, against the half-hour outturn.
          </p>
        </div>
        <label className="date">
          Delivery day
          <input
            type="date"
            min="2026-01-01"
            max="2026-01-31"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </div>

      {state.status === "loading" && <p className="status">Loading {date}…</p>}
      {state.status === "error" && <p className="status error">{state.error}</p>}

      {data && (
        <>
          <p className="vintage">
            Gate closure {stamp(data.gateClosure)} · 09:20 Europe/London on D−1.
            Decision vintage{" "}
            {data.vintagePublishTimes.length
              ? data.vintagePublishTimes.map(stamp).join(", ")
              : "none"}
            . A publish at or after the gate, including the 09:30 WINDFOR file, is not used.
          </p>

          <div className="kpis">
            <article className="kpi">
              <div className="kpi-label">Forecast wind</div>
              <div className="kpi-value">{gw(totals.forecastMwMean)}<span>GW</span></div>
              <div className="kpi-sub">{mw(totals.forecastMwh)} MWh</div>
            </article>
            <article className="kpi">
              <div className="kpi-label">Actual wind</div>
              <div className="kpi-value">{gw(totals.actualMwMean)}<span>GW</span></div>
              <div className="kpi-sub">{mw(totals.actualMwh)} MWh</div>
            </article>
            <article className={`kpi ${tone}`}>
              <div className="kpi-label">Error</div>
              <div className="kpi-value">{signedGw(totals.errorMwMean)}<span>GW</span></div>
              <div className="kpi-sub">{signedMw(totals.errorMwh)} MWh</div>
            </article>
            <article className={`kpi ${tone}`}>
              <div className="kpi-label">Error vs actual</div>
              <div className="kpi-value">{signedPct(totals.errorPct)}</div>
              <div className="kpi-sub">{totals.paired} of {totals.periods} half-hours paired</div>
            </article>
          </div>

          <section className={`panel ${tone}`}>
            <p className="interpretation">{data.interpretation}</p>
          </section>

          <section className="panel">
            <h2>Half-hour profile</h2>
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#2a3644" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#8b9bb0", fontSize: 11 }} interval={3} />
                  <YAxis
                    yAxisId="mw"
                    tick={{ fill: "#8b9bb0", fontSize: 11 }}
                    width={64}
                    tickFormatter={(value) => Math.round(value / 1000) + "k"}
                  />
                  <YAxis
                    yAxisId="err"
                    orientation="right"
                    tick={{ fill: "#8b9bb0", fontSize: 11 }}
                    width={56}
                    tickFormatter={(value) => Math.round(value / 1000) + "k"}
                  />
                  <Tooltip {...tooltipProps} formatter={(value, name) => [tooltipValue(value), name]} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#e6edf3" }} />
                  <Bar yAxisId="err" dataKey="errorMw" name="Error MW" barSize={7} isAnimationActive={false}>
                    {chart.map((row) => (
                      <Cell
                        key={row.startTime}
                        fill={row.errorMw > 0 ? "#e8a15a" : row.errorMw < 0 ? "#7dcea0" : "#8b9bb0"}
                      />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="mw"
                    dataKey="forecastMw"
                    name="Forecast MW"
                    stroke="#e8a15a"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="mw"
                    dataKey="actualMw"
                    name="Actual MW"
                    stroke="#3ddec4"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="legend-note note">
              Left axis is generation. Right axis is error, forecast minus actual. Amber means the forecast was high
              and the desk would have been short of other power. HH:30 reuses the HH:00 decision forecast.
            </p>
          </section>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SP</th>
                  <th>Start</th>
                  <th>Forecast MW</th>
                  <th>Actual MW</th>
                  <th>Error MW</th>
                  <th>Vintage</th>
                </tr>
              </thead>
              <tbody>
                {data.periods.map((period) => (
                  <tr key={period.startTime} className={errorTone(period.errorMw)}>
                    <td>{period.settlementPeriod}</td>
                    <td>{clock(period.startTime)}{period.forecastHeld ? " · held" : ""}</td>
                    <td>{mw(period.forecastMw)}</td>
                    <td>{mw(period.actualMw)}</td>
                    <td>{signedMw(period.errorMw)}</td>
                    <td>{clock(period.forecastPublishTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="foot">
            Snapshot actuals {stamp(data.snapshot.actualsFetchedAt)} · forecasts {stamp(data.snapshot.forecastsFetchedAt)} ·{" "}
            {data.snapshot.forecastRecords.toLocaleString("en-GB")} forecast rows on disk.
          </p>
        </>
      )}
    </section>
  );
}
