# Schema — Charlie

# 🧱 Database Schema — CURRENT + FUTURE PLAN

## 🧠 Overview

This project is currently in the **MVP stage**, with a focus on:

* ingesting SEC 13F data
* storing clean holdings
* enabling basic frontend dashboards

The schema will evolve as the system scales.

---

# 📦 CURRENT TABLES (MVP)

---

## 1️⃣ `funds`

### Purpose:

Stores all tracked institutional investors.

### Schema:

| Column               | Description            |
| -------------------- | ---------------------- |
| id                   | Primary key            |
| cik                  | SEC identifier         |
| fund_name            | Fund name              |
| last_fetched_quarter | Last processed quarter |
| last_fetched_at      | Timestamp              |
| fetched_quarters     | Processed quarters     |
| backfill_complete    | Boolean                |

---

---

## 2️⃣ `holdings` (RAW)

### Purpose:

Stores raw parsed XML data from SEC filings.

### Notes:

* May contain duplicates
* Not optimized for queries
* Used only for ingestion/debugging

---

---

## 3️⃣ `holdings_clean` (CORE TABLE)

### Purpose:

Stores aggregated holdings per fund + stock + quarter.

### This is the MAIN table used by the frontend.

---

### Schema:

| Column       | Description       |
| ------------ | ----------------- |
| fund_id      | FK → funds        |
| cusip        | Security          |
| issuer       | Company           |
| quarter      | Reporting period  |
| total_shares | Aggregated shares |
| total_value  | Aggregated value  |

---

### Key Constraint:

```sql
unique (fund_id, cusip, quarter)
```

---

---

# 🚀 CURRENT CAPABILITIES

With the current schema, the system can:

---

## ✅ Build MVP frontend

* Fund portfolio view
* Stock ownership view
* Top holdings dashboard

---

## ✅ Query examples

---

### Top stocks by value:

```sql
SELECT issuer, SUM(total_value)
FROM holdings_clean
GROUP BY issuer
ORDER BY SUM(total_value) DESC
LIMIT 50;
```

---

### Fund portfolio:

```sql
SELECT *
FROM holdings_clean
WHERE fund_id = ?
ORDER BY total_value DESC;
```

---

---

# ⚠️ CURRENT LIMITATIONS

---

## ❌ No time-based comparison

Cannot yet answer:

* who increased positions
* who exited

---

## ❌ No signal generation

Cannot detect:

* accumulation
* distribution
* consensus buys

---

## ❌ No fund ranking

All funds treated equally

---

---

# 🔮 FUTURE SCHEMA (SCALING PHASE)

These will be added AFTER ingestion stabilizes.

---

## 4️⃣ `holding_changes` (PLANNED)

Tracks changes between quarters.

---

## 5️⃣ `security_signals` (PLANNED)

Aggregates fund behavior into signals.

---

## 6️⃣ `classified_security_signals` (PLANNED)

Final product-ready insights.

---

---

# 🧠 DESIGN STRATEGY

---

## Phase 1 (NOW)

```plaintext
Focus: Data ingestion + basic frontend
```

Use:

```plaintext
holdings_clean only
```

---

## Phase 2

```plaintext
Add behavioral analytics
```

Introduce:

* holding_changes
* signals

---

## Phase 3

```plaintext
Advanced intelligence layer
```

* fund scoring
* backtesting
* ranking

---

---

# 🚀 DEVELOPMENT STRATEGY

---

## Parallel Workstreams

---

### Backend (running now)

* Python ingestion
* backfilling data

---

### Frontend (build NOW)

* dashboard UI
* fund pages
* stock pages

---

---

# 💡 KEY INSIGHT

---

You do NOT need full data to build the product.

You only need:

```plaintext
enough data to demonstrate value
```

---

---

# 🧭 CURRENT PRIORITY

---

```plaintext
1. Continue ingestion (background)
2. Build frontend (immediate)
3. Add signals later
```

---

---

# 🔥 FINAL NOTE

---

This schema is intentionally:

```plaintext
Simple → Expandable → Scalable
```

---

Do NOT overbuild early.

---

Build → Validate → Scale

---
