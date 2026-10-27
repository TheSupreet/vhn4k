export default function MethodologyPage() {
  return (
    <article className="method">
      <h1>Methodology</h1>
      <p className="lede">
        How the desk picks the wind forecast a GB day-ahead buyer could have seen, and how the error is scored.
        The product name on this screen is Day-Ahead Wind Desk. The folder is vhn4k.
      </p>

      <h2>Decision the screen is for</h2>
      <p>
        The buyer serves demand with weather-driven wind plus other power bought in the day-ahead auction.
        The auction for delivery day D is submitted before 09:20 Europe/London on D−1, the EPEX SPOT GB
        60-minute day-ahead gate. After that, a newer wind file is not a number the desk could have used.
      </p>

      <h2>Sources</h2>
      <p>Elexon BMRS only. No other dataset, no API key.</p>
      <ul>
        <li>
          Actuals: <code>FUELHH</code> stream, <code>fuelType=WIND</code>. Field <code>generation</code> is
          average MW over the half-hour starting at <code>startTime</code>. Settlement dates 1–31 January 2026.
          Docs:{" "}
          <a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream">FUELHH stream</a>.
        </li>
        <li>
          Forecasts: <code>WINDFOR</code> stream. Fields <code>startTime</code>, <code>publishTime</code>,{" "}
          <code>generation</code> (MW). Pulled with <code>publishDateTimeFrom</code> / <code>publishDateTimeTo</code>{" "}
          in weekly chunks from 29 Dec 2025 through 31 Jan 2026, so 1 January has a D−1 vintage.
          Without those filters the endpoint returns only the latest file, which is not the decision file.
          Docs:{" "}
          <a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream">WINDFOR stream</a>.
        </li>
      </ul>

      <h2>09:20 rule</h2>
      <p>
        For each half-hour t on delivery day D, the actual is FUELHH wind at that start time. The decision
        forecast is the WINDFOR row for the clock hour containing t whose <code>publishTime</code> is the latest
        still strictly before 09:20 Europe/London on D−1. A publish at 09:20 exactly is excluded. The rule is
        not hardcoded to a clock time such as 07:30. In this January snapshot the 09:30 file is ten minutes
        after the gate, so the file the desk can use is the previous one, often 07:30 UTC. The decision page
        shows the publish time that was actually selected.
      </p>

      <h2>Hourly forecast, half-hour actual</h2>
      <p>
        WINDFOR in this window is hourly. FUELHH is half-hourly. The HH:00 period uses the gate-closure forecast
        for that hour. The HH:30 period holds the same MW and is marked “held”. That is a display rule, not a
        second forecast. Because two half-hours share one forecast, the 48 errors on a day are not independent,
        and the monthly sample size should be read with that in mind.
      </p>

      <h2>Error sign</h2>
      <p>
        Error = forecast MW − actual MW. Positive means the forecast was too high: a desk that bought only the
        residual against that forecast would have under-procured other power. Negative means the forecast was
        too low and the desk would have over-procured. Example: forecast 10,000 MW, actual 8,800 MW, error
        +1,200 MW.
      </p>

      <h2>Metrics</h2>
      <ul>
        <li>MAE: mean absolute error, MW.</li>
        <li>RMSE: square root of the mean squared error. Population over the paired half-hours, not n−1.</li>
        <li>Bias: mean error. Positive bias is a systematic overforecast.</li>
        <li>MAPE: mean of |error| / |actual|, as a percent. Periods with actual below 1 MW stay in MAE, RMSE, and bias, and drop out of MAPE only.</li>
        <li>Daily energy is the sum of MW × 0.5 hours. KPI gigawatts are the mean MW of the paired half-hours.</li>
        <li>
          A firm buffer of N MW covers a half-hour when the error is less than or equal to N. Shortfall MWh is
          the leftover overforecast, times half an hour, on the uncovered periods.
        </li>
      </ul>

      <h2>Why the numbers are a snapshot</h2>
      <p>
        The live site is a short-lived serverless function with no disk of its own. Pulling a month of WINDFOR
        on every page view can fail a demo. <code>scripts/ingest.py</code> calls Elexon once and writes{" "}
        <code>data/actuals.json</code> and <code>data/forecasts.json</code>. The API reads those files.
        Docker is how you run the same app on a laptop. It is not what Vercel runs in production.
      </p>

      <h2>Out of scope</h2>
      <p>
        Sign-in, a database, other fuels, prices, bids, the customer’s own portfolio, and live Elexon calls
        from the web request. This is national GB wind for January 2026 purchase decisions only.
      </p>
    </article>
  );
}
