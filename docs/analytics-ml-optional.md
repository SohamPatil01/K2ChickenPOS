# Optional external ML pipeline (Advanced Analytics)

The default Advanced Analytics stack uses **rule-based and statistical** methods (moving averages, linear trend, day-of-week blending, ABC classification, EOQ with env-tuned costs). No migration is required.

When stores have **high volume** and need **stronger forecast accuracy**, consider:

1. **Feature export**  
   - Nightly job exports daily aggregates per `storeId`: revenue, item counts, promos, season flags, etc.  
   - Store in a warehouse (BigQuery, Snowflake) or object storage (Parquet).

2. **Training**  
   - **Prophet** or **LightGBM** on historical daily targets; include regressors (promo, holiday) if available.  
   - Train per store or per “store cluster” if data is sparse.

3. **Inference**  
   - Batch predictions written to a table, **or** a small inference service (Python/FastAPI) called from the API with strict timeouts.  
   - Return the same JSON shape as `GET /api/v1/analytics/forecast` (`historical`, `forecast` with `predictedLow` / `predictedHigh`) so the web UI stays compatible.

4. **Alternatives**  
   - Managed forecasting APIs (review data residency and minimization).  
   - Keep the current endpoint as **fallback** when ML service is unavailable.

5. **Environment**  
   - Add something like `ANALYTICS_FORECAST_PROVIDER=heuristic|ml` and `ML_FORECAST_URL` when you wire inference in.

This path is **optional**; the shipped implementation intentionally avoids new infrastructure.

## Analytics environment variables (inventory / EOQ)

| Variable | Default | Purpose |
|----------|---------|---------|
| `ANALYTICS_DEFAULT_LEAD_DAYS` | `7` | Lead time for reorder point |
| `ANALYTICS_ORDERING_COST` | `100` | Fixed cost per order (EOQ numerator) |
| `ANALYTICS_HOLDING_COST_PER_UNIT` | `5` | Holding cost per unit per period (EOQ denominator) |
