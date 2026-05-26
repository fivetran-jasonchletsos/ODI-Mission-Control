"""
build_snapshot.py — generates the static JSON snapshot for ODI Mission Control.

Two data sources:
  1. Real HTTP uptime checks against each demo's live URL (best-effort)
  2. Synthesized monitors/usage/audit/cost — deterministic per-demo so
     successive builds produce stable trends.

Output: console-app/frontend/public/data/*.json
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import random
import urllib.request
import urllib.error
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

NOW = dt.datetime.now(dt.timezone.utc)
NOW_ISO = NOW.replace(microsecond=0).isoformat()

# ---------------------------------------------------------------------------
# Demo registry — single source of truth.
# ---------------------------------------------------------------------------
DEMOS = [
    {
        "key": "great-expectations", "name": "Great Expectations", "industry": "OSS data-quality framework — now stewarded by Fivetran",
        "url": "https://fivetran-jasonchletsos.github.io/00-Intro-ODI-Demo/great-expectations/",
        "repo": "great-expectations/great_expectations",
        "warehouse": "Snowflake", "owner": "@platform-ops",
        "connectors": ["any_dbt_project", "any_iceberg_delta_source"], "pii_tier": "public",
    },
    {
        "key": "dbt-state", "name": "dbt State", "industry": "dbt Core plugin · skip the work that didn't change",
        "url": "https://fivetran-jasonchletsos.github.io/00-Intro-ODI-Demo/dbt-state/",
        "repo": "fivetran-jasonchletsos/00-Intro-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@platform-ops",
        "connectors": ["any_dbt_core_project"], "pii_tier": "public",
    },
    {
        "key": "build-with-claude-code", "name": "Build with Claude Code", "industry": "How SEs build these demos — two paths, one prompt",
        "url": "https://fivetran-jasonchletsos.github.io/build-with-claude-code/",
        "repo": "fivetran-jasonchletsos/build-with-claude-code",
        "warehouse": "Snowflake", "owner": "@se",
        "connectors": ["all_catalog_repos"], "pii_tier": "public",
    },
    {
        "key": "scout-room", "name": "The Scout Room", "industry": "Sports & Entertainment · Personalized baseball analytics on 150 years of MLB data",
        "url": "https://fivetran-jasonchletsos.github.io/the-scout-room/",
        "repo": "fivetran-jasonchletsos/the-scout-room",
        "warehouse": "Snowflake", "owner": "@se-leadership",
        "connectors": ["lahman_baseball_db", "mlb_statcast", "mlb_stats_api"], "pii_tier": "public",
    },
    {
        "key": "crisis-room", "name": "The ODI Crisis Room", "industry": "Four Cortex agents resolve a CPG supply-chain crisis in 90 seconds",
        "url": "https://fivetran-jasonchletsos.github.io/Crisis-Room-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/Crisis-Room-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@se-leadership",
        "connectors": ["sap_s4hana", "manhattan_wms", "oracle_tms", "walmart_retail_link"], "pii_tier": "public",
    },
    {
        "key": "brief-room", "name": "The ODI Brief Room", "industry": "Cortex Analyst + Cortex Search draft an executive customer brief in 60 seconds",
        "url": "https://fivetran-jasonchletsos.github.io/Brief-Room-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/Brief-Room-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@se-leadership",
        "connectors": ["salesforce", "gainsight", "stripe", "product_telemetry"], "pii_tier": "public",
    },
    {
        "key": "build-room", "name": "The ODI Build Room", "industry": "Four dbt-wizard sub-agents build a new dbt model live on the open lake",
        "url": "https://fivetran-jasonchletsos.github.io/Build-Room-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/Build-Room-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@se-leadership",
        "connectors": ["retailer_pos_hourly", "shelf_compliance_daily", "promotion_calendar", "store_cluster"], "pii_tier": "public",
    },
    {
        "key": "what-is-odi", "name": "Helio Commerce — What is ODI?", "industry": "The foundational ODI thesis, in working form",
        "url": "https://fivetran-jasonchletsos.github.io/What_Is_ODI_Demo/",
        "repo": "fivetran-jasonchletsos/What_Is_ODI_Demo",
        "warehouse": "Athena/Iceberg", "owner": "@se",
        "connectors": ["salesforce", "netsuite", "shopify", "stripe"], "pii_tier": "public",
    },
    {
        "key": "tax-assessment", "name": "Lakeview County Tax", "industry": "Public Sector · Property assessment on Iceberg + Databricks",
        "url": "https://fivetran-jasonchletsos.github.io/tax-assessment-databricks-demo/",
        "repo": "fivetran-jasonchletsos/tax-assessment-databricks-demo",
        "warehouse": "Databricks", "owner": "@assessment",
        "connectors": ["county_records", "usps", "census"], "pii_tier": "public",
    },
    {
        "key": "finserv", "name": "Altavest Capital", "industry": "Financial Services · Portfolio research, risk, and regulatory analytics",
        "url": "https://fivetran-jasonchletsos.github.io/FinServ-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/FinServ-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@research",
        "connectors": ["trade_ledger", "portfolio_mgmt", "market_data", "sec_edgar"], "pii_tier": "PII",
    },
    {
        "key": "insurance", "name": "Verity Insurance", "industry": "Insurance · Underwriting, claims, and regulatory reporting",
        "url": "https://fivetran-jasonchletsos.github.io/Insurance-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/Insurance-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@underwriting",
        "connectors": ["policy_admin", "claims_mart", "telematics", "naic_filings"], "pii_tier": "PII",
    },
    {
        "key": "media", "name": "Signal Reach Media", "industry": "Media + Advertising · Cross-channel audience intelligence",
        "url": "https://fivetran-jasonchletsos.github.io/Media-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/Media-ODI-Demo",
        "warehouse": "Athena/Iceberg", "owner": "@audience",
        "connectors": ["youtube", "reddit", "wikipedia"], "pii_tier": "internal",
    },
    {
        "key": "lifesci", "name": "Cohort", "industry": "LifeSci + Pharma · Clinical trial operations",
        "url": "https://fivetran-jasonchletsos.github.io/LifeSci-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/LifeSci-ODI-Demo",
        "warehouse": "Athena/Iceberg", "owner": "@biostats",
        "connectors": ["veeva_ctms", "redcap", "clinicaltrials_gov", "fda"], "pii_tier": "PHI",
    },
    {
        "key": "retail", "name": "Storefront", "industry": "Retail + eCommerce · Operations + customer analytics",
        "url": "https://fivetran-jasonchletsos.github.io/RetailEcom-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/RetailEcom-ODI-Demo",
        "warehouse": "Athena/Iceberg", "owner": "@ecom",
        "connectors": ["shopify", "stripe", "klaviyo"], "pii_tier": "PCI",
    },
    {
        "key": "supplychain", "name": "Stratum", "industry": "Supply Chain · Shipment + logistics analytics",
        "url": "https://fivetran-jasonchletsos.github.io/SupplyChain-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/SupplyChain-ODI-Demo",
        "warehouse": "Athena/Iceberg", "owner": "@logistics",
        "connectors": ["carrier_apis", "customs", "port_data"], "pii_tier": "internal",
    },
    {
        "key": "manufacturing", "name": "Vantex Manufacturing", "industry": "Manufacturing · Tier-1 auto parts: OEE, predictive maintenance, ESG",
        "url": "https://fivetran-jasonchletsos.github.io/Manufacturing-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/Manufacturing-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@mfg-ops",
        "connectors": ["sap_s4hana", "rockwell_factorytalk", "osisoft_pi", "ignition_scada"], "pii_tier": "internal",
    },
    {
        "key": "energy-utilities", "name": "Helios Grid", "industry": "Energy & Utilities · Regulated utility: SCADA + AMI + outage + ESG",
        "url": "https://fivetran-jasonchletsos.github.io/Energy-Utilities-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/Energy-Utilities-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@grid-ops",
        "connectors": ["sap_isu", "osisoft_pi_scada", "gis", "itron_ami"], "pii_tier": "OT-restricted",
    },
    {
        "key": "telecom", "name": "Aperture Wireless", "industry": "Telecom · Network + churn + AI care agent",
        "url": "https://fivetran-jasonchletsos.github.io/Telecom-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/Telecom-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@network-ops",
        "connectors": ["amdocs_cis", "salesforce", "ericsson_nokia_oss", "cdr_mediation"], "pii_tier": "PII",
    },
    {
        "key": "hospitality-travel", "name": "Ardmore Hotels", "industry": "Hospitality & Travel · Revenue management + guest experience",
        "url": "https://fivetran-jasonchletsos.github.io/Hospitality-Travel-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/Hospitality-Travel-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@rev-mgmt",
        "connectors": ["oracle_opera_pms", "sabre_amadeus", "booking_com", "cendyn"], "pii_tier": "PII",
    },
    {
        "key": "automotive", "name": "Pinnacle Motors", "industry": "Automotive · OEM + dealer network + 1.2M connected vehicles",
        "url": "https://fivetran-jasonchletsos.github.io/Automotive-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/Automotive-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@auto-data",
        "connectors": ["sap_s4hana", "dealertrack_dms", "cox_manheim", "connected_car_telemetry"], "pii_tier": "PII",
    },
    {
        "key": "higher-ed", "name": "Cascade University", "industry": "Higher Education · Enrollment + student success + research",
        "url": "https://fivetran-jasonchletsos.github.io/HigherEd-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/HigherEd-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@institutional-research",
        "connectors": ["banner_sis", "workday_hcm", "canvas_lms", "slate"], "pii_tier": "FERPA",
    },
    {
        "key": "banking", "name": "Pediment Bank", "industry": "Banking & Capital Markets · Deposits, lending, fraud, AML, commercial",
        "url": "https://fivetran-jasonchletsos.github.io/Banking-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/Banking-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@bank-data",
        "connectors": ["fis_horizon", "salesforce_fsc", "ncino", "plaid"], "pii_tier": "PII",
    },
    {
        "key": "federal-gov", "name": "Bureau of Federal Outcomes", "industry": "Federal Government · Benefits, improper payments, FISMA",
        "url": "https://fivetran-jasonchletsos.github.io/FederalGov-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/FederalGov-ODI-Demo",
        "warehouse": "Snowflake GovCloud", "owner": "@fedciv",
        "connectors": ["benefits_mainframe", "servicenow", "salesforce_public_sector", "treasury_ipp"], "pii_tier": "FedRAMP-PII",
    },
    {
        "key": "qsr", "name": "Hearth Coffee Co.", "industry": "QSR & Food Service · 4,800 locations, mobile app, loyalty, supply chain",
        "url": "https://fivetran-jasonchletsos.github.io/QSR-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/QSR-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@ops",
        "connectors": ["toast_ncr_pos", "olo", "doordash_uber_grubhub", "salesforce_mktg"], "pii_tier": "PII",
    },
    {
        "key": "aerospace", "name": "Argent Aerospace", "industry": "Aerospace & Defense · Commercial OEM + defense programs + MRO",
        "url": "https://fivetran-jasonchletsos.github.io/Aerospace-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/Aerospace-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@aero-ops",
        "connectors": ["sap_s4hana", "siemens_teamcenter", "apriso_mes", "ibm_maximo"], "pii_tier": "ITAR/DFARS",
    },
    {
        "key": "real-estate", "name": "Anchor Properties", "industry": "Real Estate / CRE · $42B portfolio across office, industrial, multifamily",
        "url": "https://fivetran-jasonchletsos.github.io/RealEstate-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/RealEstate-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@reit-analytics",
        "connectors": ["yardi_voyager", "mri_software", "vts", "procore"], "pii_tier": "PII",
    },
    {
        "key": "prof-services", "name": "Whitestone Advisory", "industry": "Professional Services · Audit, tax, consulting, cyber",
        "url": "https://fivetran-jasonchletsos.github.io/ProfServices-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/ProfServices-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@advisory",
        "connectors": ["sap_s4hana", "workday_hcm", "salesforce", "ms_dynamics"], "pii_tier": "PII",
    },
    {
        "key": "cpg-supplychain", "name": "Cardinal Provisions", "industry": "Consumer Packaged Goods · CPG downstream — manufacturer to retailer",
        "url": "https://fivetran-jasonchletsos.github.io/CPG-SupplyChain-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/CPG-SupplyChain-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@cpg-supply",
        "connectors": ["sap_s4hana", "manhattan_wms", "walmart_retail_link", "amazon_vendor_central"], "pii_tier": "internal",
    },
    {
        "key": "pharma-rd", "name": "Acacia Therapeutics", "industry": "Pharma R&D · Discovery, pipeline, RWE, regulatory",
        "url": "https://fivetran-jasonchletsos.github.io/PharmaRD-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/PharmaRD-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@pharma-rd",
        "connectors": ["benchling", "veeva_vault_rim", "openfda", "pubmed"], "pii_tier": "PHI",
    },
    {
        "key": "gaming", "name": "Vault Interactive", "industry": "Gaming · Live-ops, players, monetization, anti-cheat",
        "url": "https://fivetran-jasonchletsos.github.io/Gaming-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/Gaming-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@live-ops",
        "connectors": ["in_house_telemetry", "steam_web_api", "twitch_helix", "discord"], "pii_tier": "PII",
    },
    {
        "key": "sports", "name": "Apex Sports League", "industry": "Sports & Entertainment · 24-team pro league: ticketing, ApexTV streaming, sportsbook",
        "url": "https://fivetran-jasonchletsos.github.io/Sports-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/Sports-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@league-analytics",
        "connectors": ["ticketmaster_stubhub", "apextv_streaming", "apextrack_optical", "sportsbook_feeds"], "pii_tier": "PII",
    },
    {
        "key": "techsaas", "name": "Pulse Analytics", "industry": "Tech SaaS · SaaS metrics + telemetry",
        "url": "https://fivetran-jasonchletsos.github.io/TechSaaS-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/TechSaaS-ODI-Demo",
        "warehouse": "Athena/Iceberg", "owner": "@platform",
        "connectors": ["salesforce", "stripe", "pagerduty", "github"], "pii_tier": "PII",
    },
    {
        "key": "healthcare-epic", "name": "Clarity Health", "industry": "Healthcare · Clinical analytics + dbt Wizard build-time AI",
        "url": "https://fivetran-jasonchletsos.github.io/Healthcare-EPIC-Snowflake-Demo/",
        "repo": "fivetran-jasonchletsos/Healthcare-EPIC-Snowflake-Demo",
        "warehouse": "Snowflake", "owner": "@clinical-data",
        "connectors": ["epic_clarity", "payor_claims_mart", "hl7_adt", "cms_nppes"], "pii_tier": "PHI",
    },
    {
        "key": "sap", "name": "Pendulum Industries", "industry": "Enterprise / SAP · SAP into ODI",
        "url": "https://fivetran-jasonchletsos.github.io/SAP-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/SAP-ODI-Demo",
        "warehouse": "Athena/Iceberg", "owner": "@sap-cdc",
        "connectors": ["sap_ecc_s4hana"], "pii_tier": "PII",
    },
    {
        "key": "liner-notes", "name": "Liner Notes", "industry": "Music · Music canon + Cortex Analyst",
        "url": "https://fivetran-jasonchletsos.github.io/LinerNotes-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/LinerNotes-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@se",
        "connectors": ["spotify_web_api", "musicbrainz", "pitchfork"], "pii_tier": "public",
    },
    {
        "key": "castle-rock", "name": "Castle Rock Archive", "industry": "Books & Film · The Stephen King universe — books, films, cameos, characters",
        "url": "https://fivetran-jasonchletsos.github.io/StephenKing-ODI-Demo/",
        "repo": "fivetran-jasonchletsos/StephenKing-ODI-Demo",
        "warehouse": "Snowflake", "owner": "@se",
        "connectors": ["open_library", "tmdb", "wikidata"], "pii_tier": "public",
    },
    {
        "key": "ebay-pokemon", "name": "Harpua2001 / eBay Pokemon", "industry": "Pokemon TCG · eBay reseller dashboard + Pokemon TCG analytics",
        "url": "https://fivetran-jasonchletsos.github.io/jason_chletsos_ebay_lots/",
        "repo": "fivetran-jasonchletsos/jason_chletsos_ebay_lots",
        "warehouse": "Databricks", "owner": "@se",
        "connectors": ["ebay_api", "pokemon_tcg_api", "tcgplayer"], "pii_tier": "public",
    },
    {
        "key": "petes-movies", "name": "Peter's Must See Movies", "industry": "Movies · Curated movie list + Cortex rejection",
        "url": "https://fivetran-jasonchletsos.github.io/Peters-Must-See-Movies/",
        "repo": "fivetran-jasonchletsos/Peters-Must-See-Movies",
        "warehouse": "Snowflake", "owner": "@se",
        "connectors": ["tmdb", "omdb"], "pii_tier": "public",
    },
]


def seed_for(key: str) -> random.Random:
    h = int(hashlib.sha256(key.encode()).hexdigest()[:12], 16)
    return random.Random(h)


# ---------------------------------------------------------------------------
# Real-ish uptime: HTTP HEAD each demo with short timeout. Failure → "down".
# ---------------------------------------------------------------------------
def probe_uptime(url: str) -> tuple[bool, int]:
    try:
        req = urllib.request.Request(url, method="HEAD",
                                     headers={"User-Agent": "ODI-MissionControl/1.0"})
        t0 = dt.datetime.now()
        with urllib.request.urlopen(req, timeout=6) as r:
            latency_ms = int((dt.datetime.now() - t0).total_seconds() * 1000)
            return (200 <= r.status < 400, latency_ms)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ConnectionError) as e:
        # GH Pages sometimes 405s HEAD; treat as up if it's a method-not-allowed
        msg = str(e)
        if "405" in msg or "Method Not Allowed" in msg:
            return (True, 300)
        return (False, 0)
    except Exception:
        return (False, 0)


def synth_uptime_24h(rng: random.Random, current_up: bool) -> tuple[list, dict]:
    points = []
    incidents = 0
    p50_lat = rng.randint(180, 420)
    p95_lat = p50_lat + rng.randint(120, 380)
    for i in range(24):
        ts = (NOW - dt.timedelta(hours=23 - i)).replace(minute=0, second=0, microsecond=0).isoformat()
        # 99.6% steady-state up rate; a couple blips per week
        up = True
        if rng.random() < 0.012:
            up = False
            incidents += 1
        latency = max(80, int(rng.gauss(p50_lat, 80)))
        if not up:
            latency = 0
        points.append({"ts": ts, "up": up, "latency_ms": latency})
    # Last point reflects the real probe
    points[-1]["up"] = current_up
    return points, {"p50": p50_lat, "p95": p95_lat, "incidents": incidents}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def status_from(up_24h_pct: float, last_probe_up: bool = True) -> str:
    """Map 24h uptime to status. If the most-recent real probe succeeded,
    never escalate past 'degraded' — a single synthetic blip shouldn't show
    a demo as 'failing' when it's serving HTTP 200 right now."""
    if up_24h_pct >= 99.5: return "healthy"
    if up_24h_pct >= 95.0: return "degraded"
    # Below 95% AND live probe is down → genuinely failing.
    return "failing" if not last_probe_up else "degraded"


def days_back_iso(n: int) -> str:
    return (NOW - dt.timedelta(days=n)).replace(microsecond=0).isoformat()


# ---------------------------------------------------------------------------
# Build each output
# ---------------------------------------------------------------------------
def build_uptime() -> list[dict]:
    out = []
    for d in DEMOS:
        is_up, latency = probe_uptime(d["url"])
        rng = seed_for(d["key"] + "uptime")
        points, stats = synth_uptime_24h(rng, is_up)
        ups = sum(1 for p in points if p["up"])
        uptime_24h_pct = ups / len(points) * 100
        # 7d/30d simulated, anchored to 24h
        uptime_7d_pct = max(98.5, min(100.0, uptime_24h_pct - rng.uniform(-0.2, 0.4)))
        uptime_30d_pct = max(98.0, min(100.0, uptime_7d_pct - rng.uniform(-0.4, 0.5)))
        out.append({
            "key": d["key"],
            "points": points,
            "uptime_24h_pct": round(uptime_24h_pct, 2),
            "uptime_7d_pct": round(uptime_7d_pct, 2),
            "uptime_30d_pct": round(uptime_30d_pct, 2),
            "p50_latency_ms": stats["p50"],
            "p95_latency_ms": stats["p95"],
            "incidents_30d": stats["incidents"] + rng.randint(0, 3),
        })
    return out


def build_demos(uptime: list[dict]) -> list[dict]:
    out = []
    for d in DEMOS:
        rng = seed_for(d["key"])
        up = next(u for u in uptime if u["key"] == d["key"])
        rows_24h = rng.randint(800_000, 24_000_000)
        monthly_active = rng.randint(40, 1200)
        cost = round(rng.uniform(120, 2400), 2)
        out.append({
            **d,
            "rows_24h": rows_24h,
            "monthly_active": monthly_active,
            "uptime_pct": up["uptime_30d_pct"],
            "cost_30d_usd": cost,
            "status": status_from(up["uptime_24h_pct"], up["points"][-1]["up"]),
        })
    return out


def build_usage() -> list[dict]:
    out = []
    countries = ["United States", "United Kingdom", "Germany", "India", "Canada", "Brazil", "Japan", "Australia"]
    pages = {
        "tax-assessment": ["/", "/search", "/dashboard", "/map", "/pipeline", "/agent"],
        "healthcare":     ["/", "/patients", "/cohorts", "/pipeline", "/agent"],
        "finserv":        ["/", "/holdings", "/macro", "/complaints", "/pipeline"],
        "media":          ["/", "/audiences", "/channels", "/conversations", "/pipeline"],
        "retail":         ["/", "/orders", "/products", "/channels", "/pipeline"],
        "techsaas":       ["/", "/customers", "/engineering", "/cost", "/pipeline"],
        "supplychain":    ["/", "/shipments", "/inventory", "/lanes", "/pipeline"],
        "lifesci":        ["/", "/trials", "/sites", "/safety", "/pipeline"],
    }
    for d in DEMOS:
        rng = seed_for(d["key"] + "usage")
        base = rng.randint(20, 180)
        trailing = []
        for i in range(30):
            day = (NOW - dt.timedelta(days=29 - i)).date().isoformat()
            weekend = (NOW - dt.timedelta(days=29 - i)).weekday() >= 5
            mult = 0.55 if weekend else 1.0
            sessions = max(5, int(rng.gauss(base, base * 0.18) * mult))
            views = int(sessions * rng.uniform(3.2, 6.8))
            uniques = int(sessions * rng.uniform(0.72, 0.88))
            avg_session = int(rng.gauss(180, 30))
            trailing.append({"date": day, "sessions": sessions, "page_views": views, "uniques": uniques, "avg_session_s": avg_session})
        # Top pages
        ps = pages.get(d["key"], ["/", "/dashboard", "/pipeline"])
        top = sorted(
            [{"path": p, "views": int(trailing[-1]["page_views"] * rng.uniform(0.08, 0.45))} for p in ps],
            key=lambda x: -x["views"],
        )
        # Geo
        geo = []
        total_sessions = sum(t["sessions"] for t in trailing)
        remaining = total_sessions
        for i, c in enumerate(rng.sample(countries, k=min(6, len(countries)))):
            share = max(0.04, rng.uniform(0.05, 0.55) * (1 / (i + 1)))
            n = int(total_sessions * share)
            n = min(n, remaining)
            geo.append({"country": c, "sessions": n})
            remaining -= n
            if remaining <= 0:
                break
        out.append({"key": d["key"], "trailing_30d": trailing, "top_pages": top, "geo": geo})
    return out


# ---------------------------------------------------------------------------
# Quality monitors (Monte Carlo style)
# ---------------------------------------------------------------------------
MONITOR_TEMPLATES = [
    ("freshness",   "freshness SLA ≤ {sla}h", "last seen {obs}h ago"),
    ("volume",      "row-count ±{thr}% vs 7d avg", "{obs}% Δ"),
    ("schema",      "no breaking schema change", "{obs} new column(s)"),
    ("distribution","mean within ±{thr}σ", "{obs}σ from baseline"),
    ("nulls",       "null rate ≤ {thr}%", "{obs}% null"),
    ("uniqueness",  "PK uniqueness 100%", "{obs}% duplicates"),
    ("referential", "FK reference integrity ≥ {thr}%", "{obs}% orphans"),
    ("custom_sql",  "row count > {thr}", "found {obs}"),
]

TABLES = {
    "tax-assessment": ["marts.fct_assessments", "marts.dim_parcel", "marts.fct_exemptions_summary", "marts.fct_appeals"],
    "healthcare":     ["marts.fct_encounter", "marts.dim_patient", "marts.fct_diagnosis", "marts.fct_lab_result"],
    "finserv":        ["marts.fct_holdings", "marts.dim_issuer", "marts.fct_macro_series", "marts.fct_complaints"],
    "media":          ["marts.fct_views", "marts.dim_channel", "marts.fct_conversations", "marts.fct_trend"],
    "retail":         ["marts.fct_orders", "marts.dim_product", "marts.fct_carts", "marts.dim_customer"],
    "techsaas":       ["marts.fct_arr", "marts.dim_account", "marts.fct_incidents", "marts.fct_deploys"],
    "supplychain":    ["marts.fct_shipments", "marts.dim_sku", "marts.fct_inventory", "marts.fct_lane_perf"],
    "lifesci":        ["marts.fct_enrollment", "marts.dim_trial", "marts.fct_adverse_event", "marts.fct_site_visit"],
}


def build_quality() -> tuple[list[dict], list[dict]]:
    monitors: list[dict] = []
    rollup: list[dict] = []
    mid = 0
    for d in DEMOS:
        rng = seed_for(d["key"] + "quality")
        tables = TABLES.get(d["key"], ["marts.unknown"])
        demo_monitors = []
        for table in tables:
            for tmpl in MONITOR_TEMPLATES:
                # 60% pass, 20% warn, 12% fail, 8% paused — biased per-tier
                r = rng.random()
                status = "pass"
                if r > 0.92:   status = "paused"
                elif r > 0.84: status = "fail"
                elif r > 0.66: status = "warn"
                mtype, thr_tmpl, obs_tmpl = tmpl
                sla = rng.choice([1, 4, 12, 24])
                thr = rng.choice([2, 3, 5, 10])
                obs_pass = rng.uniform(0.1, thr * 0.6)
                obs_warn = rng.uniform(thr * 0.6, thr * 1.1)
                obs_fail = rng.uniform(thr * 1.1, thr * 3.2)
                if status == "pass":  obs = obs_pass
                elif status == "warn": obs = obs_warn
                elif status == "fail": obs = obs_fail
                else: obs = 0
                trend = [int(rng.gauss(60, 12)) for _ in range(30)]
                # Hours since last sync — recent
                last_run = (NOW - dt.timedelta(minutes=rng.randint(2, 240))).replace(microsecond=0).isoformat()
                next_run = (NOW + dt.timedelta(minutes=rng.randint(10, 120))).replace(microsecond=0).isoformat()
                mid += 1
                mon = {
                    "id": f"mon_{d['key']}_{mid:04d}",
                    "demo": d["key"],
                    "table": table,
                    "type": mtype,
                    "status": status,
                    "threshold": thr_tmpl.format(thr=thr, sla=sla),
                    "observed": obs_tmpl.format(obs=round(obs, 1)),
                    "trend": trend,
                    "last_run_at": last_run,
                    "next_run_at": next_run,
                    "owner": d["owner"],
                    "sla_hours": sla,
                }
                monitors.append(mon)
                demo_monitors.append(mon)
        # Rollup
        passes = sum(1 for m in demo_monitors if m["status"] == "pass")
        warns  = sum(1 for m in demo_monitors if m["status"] == "warn")
        fails  = sum(1 for m in demo_monitors if m["status"] == "fail")
        pauses = sum(1 for m in demo_monitors if m["status"] == "paused")
        total  = len(demo_monitors)
        # Health score 0-100
        raw = passes * 1 - warns * 2 - fails * 5
        max_raw = total * 1
        min_raw = -total * 5
        score = max(0, min(100, round(100 * (raw - min_raw) / (max_raw - min_raw))))
        rollup.append({
            "demo": d["key"],
            "pass": passes, "warn": warns, "fail": fails, "paused": pauses,
            "monitors_total": total,
            "health_score": score,
        })
    return monitors, rollup


# ---------------------------------------------------------------------------
# Lineage — tiny per-demo DAG (source → bronze → silver → gold → app)
# ---------------------------------------------------------------------------
def build_lineage() -> tuple[list[dict], list[dict]]:
    nodes: list[dict] = []
    edges: list[dict] = []
    for d in DEMOS:
        rng = seed_for(d["key"] + "lineage")
        for conn in d["connectors"]:
            src_id = f"{d['key']}.source.{conn}"
            br_id  = f"{d['key']}.bronze.{conn}"
            sl_id  = f"{d['key']}.silver.{conn}_clean"
            gd_id  = f"{d['key']}.gold.fct_{conn}"
            mart   = f"{d['key']}.mart.{TABLES.get(d['key'], ['marts.unknown'])[0].split('.')[-1]}"
            for nid, layer in [(src_id, "source"), (br_id, "bronze"), (sl_id, "silver"), (gd_id, "gold"), (mart, "mart")]:
                nodes.append({
                    "id": nid,
                    "layer": layer,
                    "demo": d["key"],
                    "rows": rng.randint(50_000, 8_000_000) if layer != "source" else rng.randint(10_000, 5_000_000),
                    "pii_tier": d["pii_tier"],
                })
            edges.extend([
                {"from": src_id, "to": br_id, "transform": "Fivetran SDK · 1:1 mirror"},
                {"from": br_id,  "to": sl_id, "transform": "dbt model · type cast + dedupe"},
                {"from": sl_id,  "to": gd_id, "transform": "dbt model · business logic"},
                {"from": gd_id,  "to": mart,  "transform": "dbt model · final mart"},
            ])
        # App node
        app_id = f"{d['key']}.app.dashboard"
        nodes.append({"id": app_id, "layer": "app", "demo": d["key"],
                      "rows": 0, "pii_tier": d["pii_tier"]})
        # Connect first mart → app
        first_mart = next((n for n in nodes if n["demo"] == d["key"] and n["layer"] == "mart"), None)
        if first_mart:
            edges.append({"from": first_mart["id"], "to": app_id, "transform": "API · cache layer"})
    return nodes, edges


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------
ACTIONS = ["GRANT", "REVOKE", "QUERY", "SCHEMA_CHANGE", "PERMISSION_DENIED", "POLICY_VIOLATION", "SECRET_ACCESS", "DEPLOY"]
ACTORS  = ["alice@fivetran.com", "bob@fivetran.com", "data-eng-bot", "compliance@fivetran.com", "@chletsos",
           "platform-ci", "vendor-svc@fivetran.com", "kim@fivetran.com"]


def build_audit() -> list[dict]:
    events = []
    rng = seed_for("audit-global")
    for d in DEMOS:
        for _ in range(rng.randint(18, 28)):
            ts = (NOW - dt.timedelta(minutes=rng.randint(2, 60 * 24 * 14))).replace(microsecond=0).isoformat()
            action = rng.choice(ACTIONS)
            actor = rng.choice(ACTORS)
            target = rng.choice(TABLES.get(d["key"], ["marts.unknown"]))
            outcome = "blocked" if action in ("PERMISSION_DENIED", "POLICY_VIOLATION") else "ok"
            details = {
                "GRANT":             f"role analytics_reader granted SELECT on {target}",
                "REVOKE":            f"role contractor_read REVOKED from {target}",
                "QUERY":             f"SELECT scanned {rng.randint(1, 50)} GB",
                "SCHEMA_CHANGE":     f"+ column added by Fivetran: {rng.choice(['utm_term', 'last_login_ip', 'consent_ts', 'is_pseudo'])}",
                "PERMISSION_DENIED": f"actor lacked role analytics_admin",
                "POLICY_VIOLATION":  f"PHI column queried without break-glass approval",
                "SECRET_ACCESS":     f"warehouse credential rotated successfully",
                "DEPLOY":            f"dbt run · {rng.randint(20, 80)} models built in {rng.randint(80, 600)}s",
            }[action]
            events.append({
                "ts": ts, "actor": actor, "action": action, "target": target,
                "demo": d["key"], "ip": f"10.{rng.randint(0,255)}.{rng.randint(0,255)}.{rng.randint(0,255)}",
                "outcome": outcome, "detail": details,
            })
    events.sort(key=lambda e: e["ts"], reverse=True)
    return events


# ---------------------------------------------------------------------------
# RBAC, Compliance, Cost, Pipelines, Alerts
# ---------------------------------------------------------------------------
def build_rbac() -> list[dict]:
    return [
        {"role": "analytics_admin",  "users": 4,  "scopes": 12, "example_user": "alice@fivetran.com"},
        {"role": "analytics_reader", "users": 38, "scopes": 8,  "example_user": "bob@fivetran.com"},
        {"role": "data_engineer",    "users": 11, "scopes": 18, "example_user": "@chletsos"},
        {"role": "compliance",       "users": 3,  "scopes": 6,  "example_user": "compliance@fivetran.com"},
        {"role": "executive_view",   "users": 9,  "scopes": 4,  "example_user": "ceo@fivetran.com"},
        {"role": "service_account",  "users": 6,  "scopes": 22, "example_user": "platform-ci"},
        {"role": "contractor_read",  "users": 2,  "scopes": 2,  "example_user": "vendor-svc"},
    ]


def build_compliance() -> list[dict]:
    items = [
        ("SOC 2",   "CC6.1", "Logical access controls",          ["tax-assessment","healthcare","finserv","media","retail","techsaas","supplychain","lifesci"], "RBAC enforced via Iceberg row-level filters; quarterly review"),
        ("SOC 2",   "CC7.2", "Change management",                ["tax-assessment","healthcare","finserv","media","retail","techsaas","supplychain","lifesci"], "All transforms version-controlled in GitHub w/ required reviews"),
        ("HIPAA",   "164.308(a)(1)", "Risk analysis",            ["healthcare","lifesci"], "Annual HIPAA risk assessment; PHI tagged in catalog"),
        ("HIPAA",   "164.312(b)", "Audit controls",              ["healthcare","lifesci"], "Every PHI query logged with actor + purpose; 7-yr retention"),
        ("GDPR",    "Art. 30", "Records of processing",          ["media","retail","techsaas","finserv","healthcare","lifesci"], "Processing register attached to each Fivetran connector"),
        ("GDPR",    "Art. 17", "Right to erasure",               ["media","retail","techsaas"], "DSR pipeline implemented; SLA: 25 days"),
        ("21 CFR Part 11", "11.10(a)", "Validation",             ["lifesci"], "Validation protocol on every dbt model touching clinical data"),
        ("21 CFR Part 11", "11.10(e)", "Audit trail",            ["lifesci"], "Append-only audit log; tamper-evident hash chain"),
        ("ISO 27001", "A.9.2", "User access management",         ["tax-assessment","healthcare","finserv","media","retail","techsaas","supplychain","lifesci"], "Quarterly access reviews; auto-deprovision on offboard"),
        ("ISO 27001", "A.12.4", "Logging and monitoring",        ["tax-assessment","healthcare","finserv","media","retail","techsaas","supplychain","lifesci"], "Centralized log lake w/ 1-yr hot retention"),
        ("PCI DSS", "3.4", "Render PAN unreadable",              ["retail"], "Card data tokenized at Stripe boundary; never lands in warehouse"),
        ("PCI DSS", "10.2", "Audit trails for cardholder data",  ["retail"], "All access logged; quarterly review by compliance"),
    ]
    rng = seed_for("compliance")
    out = []
    for fw, cid, title, applies, evidence in items:
        # Most covered; a few partials/gaps
        s = "covered"
        r = rng.random()
        if r > 0.92: s = "gap"
        elif r > 0.80: s = "partial"
        out.append({
            "framework": fw, "id": cid, "title": title, "status": s,
            "applies_to": applies, "evidence": evidence,
        })
    return out


def build_cost() -> list[dict]:
    out = []
    for d in DEMOS:
        rng = seed_for(d["key"] + "cost")
        compute = round(rng.uniform(40, 480), 2)
        storage = round(rng.uniform(20, 220), 2)
        egress  = round(rng.uniform(5, 70), 2)
        mar     = rng.randint(80_000, 4_200_000)
        total   = round(compute + storage + egress, 2)
        # 30-day daily trend
        trend = []
        base = total / 30
        for _ in range(30):
            trend.append(round(max(0.5, rng.gauss(base, base * 0.18)), 2))
        out.append({
            "demo": d["key"],
            "compute_usd": compute,
            "storage_usd": storage,
            "egress_usd": egress,
            "fivetran_mar": mar,
            "total_30d_usd": total,
            "trend_30d": trend,
        })
    return out


def build_pipelines() -> list[dict]:
    out = []
    for d in DEMOS:
        rng = seed_for(d["key"] + "pipelines")
        for conn in d["connectors"]:
            base_rps = rng.choice([500, 1200, 2800, 5500, 9200])
            tp_24 = [max(0, int(rng.gauss(base_rps, base_rps * 0.18))) for _ in range(24)]
            lag_base = rng.randint(2, 60)
            lag_24 = [max(0, int(rng.gauss(lag_base, lag_base * 0.4))) for _ in range(24)]
            # Per Healthy/degraded/failing
            r = rng.random()
            if r < 0.08:
                status = "failing"
                tp_24[-3:] = [int(tp_24[-3] * 0.4), int(tp_24[-2] * 0.15), 0]
                lag_24[-3:] = [lag_base * 30, lag_base * 80, lag_base * 200]
            elif r < 0.18:
                status = "degraded"
                tp_24[-1] = int(tp_24[-1] * 0.5)
                lag_24[-1] = lag_base * 8
            else:
                status = "healthy"
            out.append({
                "id": f"{d['key']}_{conn}",
                "demo": d["key"],
                "source": conn,
                "destination": d["warehouse"].lower(),
                "status": status,
                "rows_24h": sum(tp_24) * rng.randint(40, 60),
                "lag_s": lag_24[-1],
                "throughput_rps": tp_24[-1],
                "throughput_24h": tp_24,
                "lag_24h": lag_24,
                "last_sync_at": (NOW - dt.timedelta(minutes=rng.randint(1, 360))).replace(microsecond=0).isoformat(),
            })
    return out


def build_alerts(monitors: list[dict], pipelines: list[dict]) -> list[dict]:
    alerts = []
    aid = 0
    rng = seed_for("alerts")
    for m in monitors:
        if m["status"] == "fail":
            aid += 1
            # 70% active, 20% acknowledged, 10% resolved
            r = rng.random()
            st = "active" if r < 0.7 else ("acknowledged" if r < 0.9 else "resolved")
            sev = "sev1" if rng.random() < 0.18 else ("sev2" if rng.random() < 0.5 else "sev3")
            alerts.append({
                "id": f"alrt_{aid:04d}",
                "severity": sev,
                "status": st,
                "demo": m["demo"],
                "monitor_id": m["id"],
                "triggered_at": (NOW - dt.timedelta(minutes=rng.randint(3, 60 * 36))).replace(microsecond=0).isoformat(),
                "resolved_at": (NOW - dt.timedelta(minutes=rng.randint(1, 60))).replace(microsecond=0).isoformat() if st == "resolved" else None,
                "title": f"{m['type'].title()} check failed on {m['table']}",
                "detail": f"Threshold: {m['threshold']} · Observed: {m['observed']}",
                "owner": m["owner"],
                "runbook_url": f"https://runbooks.fivetran-internal.example/{m['type']}",
            })
    for p in pipelines:
        if p["status"] in ("failing", "degraded"):
            aid += 1
            sev = "sev1" if p["status"] == "failing" else "sev2"
            alerts.append({
                "id": f"alrt_{aid:04d}",
                "severity": sev,
                "status": "active",
                "demo": p["demo"],
                "triggered_at": (NOW - dt.timedelta(minutes=rng.randint(5, 60 * 4))).replace(microsecond=0).isoformat(),
                "resolved_at": None,
                "title": f"Connector {p['source']} → {p['destination']} {p['status']}",
                "detail": f"Lag {p['lag_s']}s · throughput dropped to {p['throughput_rps']}/s",
                "owner": next((d["owner"] for d in DEMOS if d["key"] == p["demo"]), "@platform"),
            })
    return alerts


def build_summary(demos: list[dict], uptime: list[dict], rollup: list[dict],
                  monitors: list[dict], pipelines: list[dict], cost: list[dict],
                  alerts: list[dict]) -> dict:
    healthy = sum(1 for d in demos if d["status"] == "healthy")
    degraded = sum(1 for d in demos if d["status"] == "degraded")
    failing = sum(1 for d in demos if d["status"] == "failing")
    rows_24h = sum(d["rows_24h"] for d in demos)
    mau_total = sum(d["monthly_active"] for d in demos)
    cost_total = sum(c["total_30d_usd"] for c in cost)
    uptime_avg = round(sum(u["uptime_30d_pct"] for u in uptime) / len(uptime), 2)
    monitors_total = len(monitors)
    monitors_failing = sum(1 for m in monitors if m["status"] == "fail")
    active_alerts = sum(1 for a in alerts if a["status"] == "active")
    open_incidents = sum(u["incidents_30d"] for u in uptime)

    # 30-day sparklines
    rng = seed_for("summary-spark")
    spark_uptime = [round(min(100.0, max(98.0, uptime_avg + rng.gauss(0, 0.25))), 2) for _ in range(30)]
    spark_rows = [int(rng.gauss(rows_24h, rows_24h * 0.08)) for _ in range(30)]
    spark_alerts = [max(0, int(rng.gauss(active_alerts, active_alerts * 0.4 + 0.5))) for _ in range(30)]
    spark_active = [int(rng.gauss(mau_total / 30, mau_total / 100)) for _ in range(30)]

    return {
        "generated_at": NOW_ISO,
        "source": "demo",
        "demos_total": len(demos),
        "demos_healthy": healthy,
        "demos_degraded": degraded,
        "demos_failing": failing,
        "rows_24h_total": rows_24h,
        "monthly_active_total": mau_total,
        "active_alerts": active_alerts,
        "open_incidents": open_incidents,
        "monitors_total": monitors_total,
        "monitors_failing": monitors_failing,
        "cost_30d_usd_total": round(cost_total, 2),
        "uptime_30d_pct": uptime_avg,
        "spark_uptime": spark_uptime,
        "spark_rows_per_day": spark_rows,
        "spark_alerts_per_day": spark_alerts,
        "spark_active_users": spark_active,
    }


def write_json(name: str, payload: dict) -> None:
    (OUTPUT_DIR / f"{name}.json").write_text(json.dumps(payload, indent=2))


def main() -> int:
    print("Probing live uptime…")
    uptime = build_uptime()
    print(f"  {len(uptime)} demos probed")
    demos = build_demos(uptime)
    print("Synthesizing usage, monitors, lineage, audit, cost, pipelines, alerts…")
    usage = build_usage()
    monitors, rollup = build_quality()
    lineage_nodes, lineage_edges = build_lineage()
    audit = build_audit()
    rbac = build_rbac()
    compliance = build_compliance()
    cost = build_cost()
    pipelines = build_pipelines()
    alerts = build_alerts(monitors, pipelines)
    summary = build_summary(demos, uptime, rollup, monitors, pipelines, cost, alerts)

    write_json("summary",    summary)
    write_json("demos",      {"demos": demos})
    write_json("uptime",     {"uptime": uptime})
    write_json("usage",      {"usage": usage})
    write_json("quality",    {"monitors": monitors, "rollup": rollup})
    write_json("lineage",    {"nodes": lineage_nodes, "edges": lineage_edges})
    write_json("audit",      {"events": audit})
    write_json("rbac",       {"roles": rbac})
    write_json("compliance", {"controls": compliance})
    write_json("cost",       {"breakdown": cost})
    write_json("pipelines",  {"connectors": pipelines})
    write_json("alerts",     {"alerts": alerts})

    print(f"  → wrote 12 files to {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
