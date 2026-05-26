// ============================================================
// ODI Mission Control — shared types for the governance + analytics
// observability layer that sits across all 8 Fivetran ODI demos.
// ============================================================

// Was a closed union of 8 keys. Now an opaque string so the portfolio
// can grow (38 demos as of May 26, 2026) without churning this type.
export type DemoKey = string;

export type Status = 'healthy' | 'degraded' | 'failing' | 'unknown';
export type Severity = 'sev1' | 'sev2' | 'sev3' | 'info';
export type PIITier = 'PII' | 'PHI' | 'PCI' | 'internal' | 'public';

export interface Demo {
  key: DemoKey;
  name: string;
  industry: string;
  url: string;
  repo: string;            // github full slug
  warehouse: 'Databricks' | 'Snowflake' | 'Athena/Iceberg';
  connectors: string[];    // source connector names
  owner: string;           // owner alias
  rows_24h: number;        // rows ingested in last 24h
  monthly_active: number;  // synth — active users in last 30d
  uptime_pct: number;      // last 30d
  cost_30d_usd: number;    // synthesized monthly run cost
  status: Status;
  pii_tier: PIITier;
}

export interface UptimePoint {
  ts: string;        // ISO timestamp
  up: boolean;
  latency_ms: number;
}

export interface DemoUptime {
  key: DemoKey;
  points: UptimePoint[];        // last 24h hourly checks
  uptime_24h_pct: number;
  uptime_7d_pct: number;
  uptime_30d_pct: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  incidents_30d: number;
}

export interface UsagePoint {
  date: string;
  sessions: number;
  page_views: number;
  uniques: number;
  avg_session_s: number;
}

export interface DemoUsage {
  key: DemoKey;
  trailing_30d: UsagePoint[];
  top_pages: { path: string; views: number }[];
  geo: { country: string; sessions: number }[];
}

export type MonitorType =
  | 'freshness'
  | 'volume'
  | 'schema'
  | 'distribution'
  | 'nulls'
  | 'uniqueness'
  | 'referential'
  | 'custom_sql';

export type MonitorStatus = 'pass' | 'warn' | 'fail' | 'paused';

export interface QualityMonitor {
  id: string;
  demo: DemoKey;
  table: string;                       // e.g. "marts.fct_assessments"
  type: MonitorType;
  status: MonitorStatus;
  threshold: string;                   // human-readable
  observed: string;                    // human-readable current value
  trend: number[];                     // 30 points
  last_run_at: string;                 // ISO
  next_run_at: string;                 // ISO
  owner: string;
  sla_hours: number;                   // freshness SLA
}

export interface QualityRollup {
  demo: DemoKey;
  pass: number;
  warn: number;
  fail: number;
  paused: number;
  monitors_total: number;
  // Score 0-100 — weighted: fail = -5, warn = -2, pass = +1
  health_score: number;
}

export interface LineageNode {
  id: string;                          // e.g. "bronze.veeva__trial"
  layer: 'source' | 'bronze' | 'silver' | 'gold' | 'mart' | 'app';
  demo: DemoKey;
  rows: number;
  pii_tier: PIITier;
}

export interface LineageEdge {
  from: string;
  to: string;
  transform: string;                   // e.g. "dbt model: stg_trial"
}

export interface AuditEvent {
  ts: string;
  actor: string;
  action:
    | 'GRANT'
    | 'REVOKE'
    | 'QUERY'
    | 'SCHEMA_CHANGE'
    | 'PERMISSION_DENIED'
    | 'POLICY_VIOLATION'
    | 'SECRET_ACCESS'
    | 'DEPLOY';
  target: string;                      // table or resource
  demo: DemoKey;
  ip?: string;
  outcome: 'ok' | 'blocked';
  detail: string;
}

export interface RBACRole {
  role: string;
  users: number;
  scopes: number;
  example_user: string;
}

export interface ComplianceControl {
  framework: 'SOC 2' | 'HIPAA' | 'GDPR' | '21 CFR Part 11' | 'ISO 27001' | 'PCI DSS';
  id: string;                          // e.g. "CC6.1"
  title: string;
  status: 'covered' | 'partial' | 'gap';
  applies_to: DemoKey[];               // which demos
  evidence: string;
}

export interface CostBreakdown {
  demo: DemoKey;
  compute_usd: number;
  storage_usd: number;
  egress_usd: number;
  fivetran_mar: number;
  total_30d_usd: number;
  trend_30d: number[];                 // 30-day daily spend
}

export interface PipelineConnector {
  id: string;
  fivetran_id?: string;                // Fivetran connector slug for deep-link
  demo: DemoKey;
  source: string;                      // e.g. "postgres", "veeva"
  destination: string;                 // e.g. "databricks"
  status: Status;
  rows_24h: number;
  lag_s: number;
  throughput_rps: number;
  throughput_24h: number[];
  lag_24h: number[];
  last_sync_at: string;
}

export interface Alert {
  id: string;
  severity: Severity;
  status: 'active' | 'acknowledged' | 'resolved';
  demo: DemoKey;
  monitor_id?: string;
  triggered_at: string;
  resolved_at?: string;
  title: string;
  detail: string;
  owner: string;
  runbook_url?: string;
}

export interface PortfolioSummary {
  generated_at: string;
  source: 'live' | 'demo';
  demos_total: number;
  demos_healthy: number;
  demos_degraded: number;
  demos_failing: number;
  rows_24h_total: number;
  monthly_active_total: number;
  active_alerts: number;
  open_incidents: number;
  monitors_total: number;
  monitors_failing: number;
  cost_30d_usd_total: number;
  uptime_30d_pct: number;
  // Sparklines (last 30 days)
  spark_uptime: number[];
  spark_rows_per_day: number[];
  spark_alerts_per_day: number[];
  spark_active_users: number[];
}
