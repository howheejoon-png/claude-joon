# Project Context — Charlie

# 📊 Project Context — SEC 13F Smart Money Tracker

## 🧠 Project Overview

This project is a **financial intelligence platform** that analyzes SEC 13F filings to identify institutional investment behavior and generate actionable insights.

The system ingests 13F filings, processes holdings data, tracks changes over time, and produces **signal-based insights** such as:

* Consensus buying
* Silent accumulation
* Distribution
* High conviction positions

The goal is to transform raw SEC filings into a **dashboard-driven product** that helps users understand what “smart money” is doing.

---

## 🎯 Core Objective

Build a system that answers:

> “What are top institutional investors doing, and which stocks are they accumulating or exiting?”

---

## 🧱 System Architecture

### Data Pipeline

```plaintext
SEC EDGAR API
↓
Python Ingestion Script
↓
Supabase (PostgreSQL)
↓
SQL Views (analytics layer)
↓
Frontend Dashboard (Next.js)
```

---

## ⚙️ Current Tech Stack

* **Ingestion**: Python (requests, lxml, pandas)
* **Database**: Supabase (PostgreSQL)
* **Backend Logic**: SQL (views + aggregation)
* **Frontend (planned)**: Next.js + Tailwind
* **Data Source**: SEC EDGAR (13F filings)

---

## 📦 Database Schema

### 1. `funds`

Stores fund metadata.

| Column               | Description                 |
| -------------------- | --------------------------- |
| id                   | Primary key                 |
| cik                  | SEC identifier              |
| fund_name            | Name of fund                |
| last_fetched_quarter | Last processed quarter      |
| last_fetched_at      | Timestamp                   |
| fetched_quarters     | Array of completed quarters |
| backfill_complete    | Boolean                     |

---

### 2. `holdings` (RAW)

Raw parsed data from XML filings.

| Column  | Description         |
| ------- | ------------------- |
| fund    | Fund name           |
| issuer  | Company name        |
| cusip   | Security identifier |
| value   | Reported value      |
| shares  | Shares held         |
| quarter | Reporting quarter   |

⚠️ Contains duplicates and multiple rows per security.

---

### 3. `holdings_clean` (AGGREGATED)

Cleaned and grouped data.

| Column       | Description       |
| ------------ | ----------------- |
| fund_id      | FK → funds        |
| cusip        | Security          |
| issuer       | Company           |
| quarter      | Reporting period  |
| total_shares | Aggregated shares |
| total_value  | Aggregated value  |

✅ One row per fund + stock + quarter

---

## 🔄 Data Processing Layers

---

### 1️⃣ Ingestion Layer (Python)

* Fetch SEC filings using:

  ```
  https://data.sec.gov/submissions/CIK##########.json
  ```
* Filter filings:

  * Only `form == "13F-HR"`
* Extract:

  * accession number
* Discover XML file via filing index
* Parse holdings using XML

---

### 2️⃣ Cleaning Layer

* Aggregate raw holdings:

  ```
  GROUP BY fund_id, cusip, quarter
  ```
* Sum:

  * shares → total_shares
  * value → total_value

---

### 3️⃣ Holding Changes Layer (`holding_changes`)

Tracks changes between quarters.

Key logic:

* Compare current vs previous quarter
* Use SQL `LAG()`

Outputs:

* shares_change
* value_change
* status:

  * new
  * increased
  * reduced
  * closed
  * unchanged

---

### 4️⃣ Security Signals Layer (`security_signals`)

Aggregates across all funds.

Metrics:

* funds_buying
* funds_selling
* net_flow
* gross_inflow
* gross_outflow
* avg_increase_pct

---

### 5️⃣ Classification Layer (`classified_security_signals`)

Converts metrics into product-ready signals.

Flags:

* is_consensus_buy
* is_silent_accumulation
* is_distribution
* is_high_conviction

Example rules:

```sql
funds_buying >= 10 → consensus buy

funds_buying <= 5 AND avg_increase_pct >= 50
→ silent accumulation

net_flow < 0 AND funds_selling > funds_buying
→ distribution

avg_increase_pct >= 100
→ high conviction
```

---

## 🧠 Key Concepts

### Raw vs Clean Data

* `holdings` = raw, unstructured
* `holdings_clean` = usable, aggregated

---

### Behavior Tracking

System tracks:

```plaintext
WHAT funds DO (buy/sell/change)
NOT just what they hold
```

---

### Signal Generation

Pipeline:

```plaintext
Holdings → Changes → Signals → Classification
```

---

## 🚀 Frontend Vision

### Pages

#### 1. Dashboard

* Top consensus buys
* Silent movers
* Distribution signals

#### 2. Screener

* Filter by:

  * signal type
  * quarter
  * fund activity

#### 3. Stock Page

* Fund activity breakdown
* Trend charts
* Signal history

#### 4. Fund Page

* Portfolio
* Activity summary
* Historical behavior

---

## ⚠️ Key Constraints & Decisions

---

### Python-Based Ingestion

* All ingestion handled via Python
* No external workflow tools used
* Enables:

  * full control
  * better performance
  * scalable processing

---

### SEC Rate Limits

* Must include User-Agent
* Must throttle requests
* Avoid excessive retries

---

### Data Volume

Estimated:

* 20M–50M rows (realistic)

---

### Performance Strategy

* Use `holdings_clean` for all queries
* Avoid querying raw table
* Add indexes:

  * (cusip, quarter)
  * (fund_id, quarter)

---

## 🧠 Future Enhancements

---

### Fund Scoring System

Rank funds based on:

* size
* activity
* performance (future)
* consistency

---

### Weighted Signals

Instead of:

```plaintext
count funds
```

Use:

```plaintext
sum(fund_score)
```

---

### Backtesting Engine

Evaluate:

* signal effectiveness
* returns after signals

---

### Filings Queue System

Track:

* processed filings
* retries
* errors

---

## 🔥 Product Vision

This is NOT just a data tool.

This is:

```plaintext
A Smart Money Intelligence Platform
```

Goal:

* Identify where institutions are moving capital
* Surface early accumulation signals
* Provide actionable insights for users

---

## 🧭 Current Stage

```plaintext
✔ Python ingestion working
✔ Database schema built
✔ Aggregation layer built
🚧 Scaling ingestion
🚧 Building signal layers
🚧 Frontend not yet built
```

---

## 🎯 Immediate Next Steps

1. Fix ingestion to use real filings (not quarters)
2. Limit backfill to 2–3 years
3. Build:

   * holding_changes
   * security_signals
   * classified_security_signals
4. Start frontend dashboard

---

## 💡 Core Insight

The value is NOT in the data.

The value is in:

```plaintext
How the data is transformed into signals
```

---

## 🚀 Long-Term Vision

* Become a Bloomberg-lite for 13F analysis
* Provide institutional behavior tracking
* Enable signal-based investing decisions
