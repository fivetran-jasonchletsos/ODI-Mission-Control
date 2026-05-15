# ODI Mission Control

The governance + observability layer sitting above the Fivetran ODI demo
portfolio. Splunk-meets-Monte-Carlo for the eight industry demos:
Tax-Assessment, Healthcare, FinServ, Media, Retail, SaaS Pulse, Supply
Chain, and Life Sciences.

**Live site:** https://fivetran-jasonchletsos.github.io/ODI-Mission-Control/

## What it shows

| Page | What it answers |
|---|---|
| Overview | Are all 8 demos up? What's burning? Where are we leaking quality? |
| Portfolio | Per-demo health: warehouse, connectors, owner, uptime, rows, cost, PII tier |
| Data Quality | Monte Carlo-style monitors per table — freshness, volume, schema drift, distribution, nulls, uniqueness, referential, custom SQL |
| Lineage | Source → bronze → silver → gold → mart → app, with PII flow callouts |
| Pipelines | Every Fivetran connector across the portfolio — throughput, lag, failure simulator |
| Governance | Compliance posture (SOC 2, HIPAA, GDPR, 21 CFR Part 11, ISO 27001, PCI DSS) · RBAC roles · audit log |
| Cost | 30-day spend by demo / by service · anomaly callouts |
| Alerts | Active + resolved alerts across the portfolio · MTTR · runbooks |

## How the data layer works

`scripts/build_snapshot.py` runs daily:

- **Real**: HTTP HEAD probe of each live demo URL to compute uptime + latency
- **Synthesized**: monitors, lineage, audit events, RBAC, compliance posture, cost breakdowns, pipeline metrics, alerts — all seeded deterministically per demo so successive builds yield stable trends

Outputs static JSON in `console-app/frontend/public/data/` consumed by the React SPA.

## Local dev

```bash
cd console-app
python3 scripts/build_snapshot.py        # refresh data
cd frontend && npm install && npm run dev
```
