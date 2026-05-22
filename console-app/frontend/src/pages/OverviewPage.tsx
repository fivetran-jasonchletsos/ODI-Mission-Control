// OverviewPage — the wall of glass. First page anyone lands on.
// Shows: portfolio-wide health KPIs · per-demo grid · live alert feed · data
// quality bands · audit pulse · cost burn. This is the page a Chief Data
// Officer or VP of Analytics screenshots for the all-hands.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api, formatCompact, formatCurrency, formatNumber, formatPct, relTime,
} from '../api/queries';
import Sparkline from '../components/Sparkline';
import type {
  Alert, AuditEvent, Demo, PortfolioSummary, QualityRollup,
} from '../types';

const STATUS_COLOR = {
  healthy:  'var(--ok)',
  degraded: 'var(--warn)',
  failing:  'var(--bad)',
  unknown:  'var(--ink-dim)',
} as const;

const SEV_COLOR = {
  sev1: 'var(--bad)',
  sev2: 'var(--warn)',
  sev3: 'var(--gold)',
  info: 'var(--info)',
} as const;

const PII_TIER_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  PHI:      { bg: 'rgba(239,68,68,0.15)',  fg: '#f87171', label: 'PHI' },
  PCI:      { bg: 'rgba(251,146,60,0.15)', fg: '#fb923c', label: 'PCI' },
  PII:      { bg: 'rgba(245,158,11,0.15)', fg: '#fbbf24', label: 'PII' },
  internal: { bg: 'rgba(148,163,184,0.15)',fg: '#94a3b8', label: 'INT' },
  public:   { bg: 'rgba(34,197,94,0.15)',  fg: '#4ade80', label: 'PUB' },
};

const STATUS_ORDER: Record<string, number> = { failing: 0, degraded: 1, healthy: 2, unknown: 3 };

export default function OverviewPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [demos, setDemos] = useState<Demo[]>([]);
  const [rollup, setRollup] = useState<QualityRollup[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getSummary(),
      api.getDemos(),
      api.getQualityRollup(),
      api.getAlerts(),
      api.getAudit(),
    ])
      .then(([s, d, r, a, e]) => {
        setSummary(s);
        setDemos(d);
        setRollup(r);
        setAlerts(a);
        setAudit(e);
      })
      .finally(() => setLoading(false));
  }, []);

  const sortedDemos = useMemo(
    () => [...demos].sort((a, b) =>
      (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || a.name.localeCompare(b.name)),
    [demos],
  );

  const rollupByKey = useMemo(() => {
    const m = new Map<string, QualityRollup>();
    rollup.forEach((r) => m.set(r.demo, r));
    return m;
  }, [rollup]);

  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === 'active'), [alerts]);
  const sev1Alerts = activeAlerts.filter((a) => a.severity === 'sev1').length;
  const sev2Alerts = activeAlerts.filter((a) => a.severity === 'sev2').length;

  if (loading || !summary) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-20 text-center font-mono text-xs"
           style={{ color: 'var(--ink-dim)' }}>
        LOADING SNAPSHOT…
      </div>
    );
  }

  return (
    <div className="mc-page mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6">
      {/* Hero strip — mission control banner */}
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="eyebrow mb-1">Mission Control · {relTime(summary.generated_at)}</div>
          <h1 className="text-[26px] font-bold tracking-wide" style={{ color: 'var(--ink)', letterSpacing: '0.04em' }}>
            Portfolio Observability
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
            Governance, data quality, and pipeline health across {summary.demos_total} live ODI demos.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          {sev1Alerts > 0 && (
            <span className="pill pill-bad"><span className="dot pulse" />{sev1Alerts} SEV1</span>
          )}
          {sev2Alerts > 0 && (
            <span className="pill pill-warn"><span className="dot" />{sev2Alerts} SEV2</span>
          )}
          {sev1Alerts === 0 && sev2Alerts === 0 && (
            <span className="pill pill-ok"><span className="dot pulse" />All systems nominal</span>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiTile label="Demos online"
                 value={`${summary.demos_healthy + summary.demos_degraded} / ${summary.demos_total}`}
                 hint={`${summary.demos_failing} failing`}
                 spark={summary.spark_uptime} color="var(--ok)" />
        <KpiTile label="Uptime 30d"
                 value={formatPct(summary.uptime_30d_pct, 2)}
                 hint="last 30 days"
                 spark={summary.spark_uptime} color="var(--info)" />
        <KpiTile label="Rows 24h"
                 value={formatCompact(summary.rows_24h_total)}
                 hint="across all connectors"
                 spark={summary.spark_rows_per_day} color="var(--gold)" />
        <KpiTile label="Monthly active"
                 value={formatNumber(summary.monthly_active_total)}
                 hint="last 30 days"
                 spark={summary.spark_active_users} color="var(--accent)" />
        <KpiTile label="Active alerts"
                 value={String(summary.active_alerts)}
                 hint={`${summary.open_incidents} open incidents`}
                 spark={summary.spark_alerts_per_day} color="var(--bad)" />
        <KpiTile label="Cost 30d"
                 value={formatCurrency(summary.cost_30d_usd_total)}
                 hint={`${summary.monitors_total} monitors`}
                 spark={summary.spark_rows_per_day} color="var(--gold)" />
      </div>

      {/* Main grid: 2/3 demo cards, 1/3 alerts feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Demo portfolio grid */}
        <section className="panel lg:col-span-2">
          <div className="panel-head">
            <div className="panel-title">Demo Portfolio</div>
            <Link to="/portfolio" className="text-[11px] font-mono"
                  style={{ color: 'var(--info)' }}>
              full table →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x"
               style={{ borderColor: 'var(--hairline)' }}>
            {sortedDemos.map((d, i) => {
              const r = rollupByKey.get(d.key);
              const pii = PII_TIER_STYLE[d.pii_tier];
              const rowDivider = i >= 2 ? { borderTop: '1px solid var(--hairline)' } : {};
              return (
                <a
                  key={d.key}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-4 hover:bg-white/[0.025] transition-colors"
                  style={rowDivider}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ background: STATUS_COLOR[d.status] }}
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-[14px] truncate"
                              style={{ color: 'var(--ink)' }}>{d.name}</span>
                      </div>
                      <div className="text-[11px] font-mono truncate"
                           style={{ color: 'var(--ink-dim)' }}>{d.industry}</div>
                    </div>
                    <span
                      className="shrink-0 inline-flex items-center justify-center px-1.5 rounded text-[9px] font-bold font-mono tracking-wider"
                      style={{ background: pii.bg, color: pii.fg }}
                      title={`Data classification: ${d.pii_tier}`}
                    >
                      {pii.label}
                    </span>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="grid grid-cols-3 gap-3 flex-1 text-[11px]">
                      <div>
                        <div className="font-mono uppercase tracking-wider"
                             style={{ color: 'var(--ink-muted)', fontSize: 9 }}>Uptime</div>
                        <div className="tabular font-semibold"
                             style={{ color: 'var(--ink)' }}>{formatPct(d.uptime_pct, 2)}</div>
                      </div>
                      <div>
                        <div className="font-mono uppercase tracking-wider"
                             style={{ color: 'var(--ink-muted)', fontSize: 9 }}>Rows 24h</div>
                        <div className="tabular font-semibold"
                             style={{ color: 'var(--ink)' }}>{formatCompact(d.rows_24h)}</div>
                      </div>
                      <div>
                        <div className="font-mono uppercase tracking-wider"
                             style={{ color: 'var(--ink-muted)', fontSize: 9 }}>DQ Score</div>
                        <div className="tabular font-semibold"
                             style={{ color: r ? scoreColor(r.health_score) : 'var(--ink-dim)' }}>
                          {r ? r.health_score : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* DQ bar */}
                  {r && (
                    <div className="mt-2 flex h-1.5 rounded-sm overflow-hidden"
                         title={`Pass ${r.pass} · Warn ${r.warn} · Fail ${r.fail}`}>
                      <div style={{ flex: r.pass,   background: 'var(--ok)' }} />
                      <div style={{ flex: r.warn,   background: 'var(--warn)' }} />
                      <div style={{ flex: r.fail,   background: 'var(--bad)' }} />
                      <div style={{ flex: r.paused, background: 'var(--ink-dim)' }} />
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        </section>

        {/* Alerts feed */}
        <section className="panel">
          <div className="panel-head">
            <div className="panel-title">Active Alerts</div>
            <Link to="/alerts" className="text-[11px] font-mono"
                  style={{ color: 'var(--info)' }}>
              all alerts →
            </Link>
          </div>
          {activeAlerts.length === 0 ? (
            <div className="px-4 py-12 text-center text-[12px] font-mono"
                 style={{ color: 'var(--ink-dim)' }}>
              No active alerts. Everything's green.
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--hairline)' }}>
              {activeAlerts.slice(0, 8).map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="shrink-0 mt-0.5 inline-block w-1.5 h-1.5 rounded-full"
                      style={{ background: SEV_COLOR[a.severity] }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-[10px] uppercase tracking-wider font-bold"
                              style={{ color: SEV_COLOR[a.severity] }}>
                          {a.severity}
                        </span>
                        <span className="font-mono text-[10px]"
                              style={{ color: 'var(--ink-dim)' }}>{a.demo}</span>
                        <span className="ml-auto font-mono text-[10px]"
                              style={{ color: 'var(--ink-dim)' }}>{relTime(a.triggered_at)}</span>
                      </div>
                      <div className="text-[12px] truncate"
                           style={{ color: 'var(--ink)' }}>{a.title}</div>
                      <div className="text-[11px] truncate font-mono"
                           style={{ color: 'var(--ink-muted)' }}>{a.detail}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Quality bands + audit pulse */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <section className="panel">
          <div className="panel-head">
            <div className="panel-title">Data Quality · per demo</div>
            <Link to="/quality" className="text-[11px] font-mono"
                  style={{ color: 'var(--info)' }}>
              monitors →
            </Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Demo</th>
                <th>Score</th>
                <th style={{ width: '40%' }}>Pass · Warn · Fail</th>
                <th className="text-right">Monitors</th>
              </tr>
            </thead>
            <tbody>
              {[...rollup].sort((a, b) => a.health_score - b.health_score).map((r) => {
                const d = demos.find((x) => x.key === r.demo);
                return (
                  <tr key={r.demo}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-1.5 h-1.5 rounded-full"
                              style={{ background: STATUS_COLOR[d?.status ?? 'unknown'] }} />
                        <span style={{ color: 'var(--ink)' }}>{d?.name ?? r.demo}</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-semibold tabular text-[15px]"
                            style={{ color: scoreColor(r.health_score) }}>
                        {r.health_score}
                      </span>
                    </td>
                    <td>
                      <div className="flex h-2 rounded-sm overflow-hidden bg-white/[0.05]">
                        <div style={{ flex: r.pass,   background: 'var(--ok)' }} title={`Pass ${r.pass}`} />
                        <div style={{ flex: r.warn,   background: 'var(--warn)' }} title={`Warn ${r.warn}`} />
                        <div style={{ flex: r.fail,   background: 'var(--bad)' }} title={`Fail ${r.fail}`} />
                        <div style={{ flex: r.paused, background: 'var(--ink-dim)' }} title={`Paused ${r.paused}`} />
                      </div>
                      <div className="mt-1 flex gap-3 text-[10px] font-mono"
                           style={{ color: 'var(--ink-dim)' }}>
                        <span style={{ color: 'var(--ok)' }}>{r.pass} pass</span>
                        <span style={{ color: 'var(--warn)' }}>{r.warn} warn</span>
                        <span style={{ color: 'var(--bad)' }}>{r.fail} fail</span>
                      </div>
                    </td>
                    <td className="text-right tabular font-mono"
                        style={{ color: 'var(--ink-muted)' }}>{r.monitors_total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div className="panel-title">Audit Pulse · last 8 events</div>
            <Link to="/governance" className="text-[11px] font-mono"
                  style={{ color: 'var(--info)' }}>
              audit log →
            </Link>
          </div>
          <ul className="divide-y" style={{ borderColor: 'var(--hairline)' }}>
            {audit.slice(0, 8).map((e, i) => (
              <li key={i} className="px-4 py-2.5 grid grid-cols-[80px,90px,1fr,auto] gap-2 items-center text-[12px]">
                <span className="font-mono text-[10px]" style={{ color: 'var(--ink-dim)' }}>
                  {relTime(e.ts)}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider font-bold"
                      style={{ color: actionColor(e.action) }}>
                  {e.action.replace('_', ' ')}
                </span>
                <span className="truncate font-mono" style={{ color: 'var(--ink-2)' }}>
                  <span style={{ color: 'var(--ink-muted)' }}>{e.actor}</span>
                  {' · '}
                  <span style={{ color: 'var(--ink)' }}>{e.target}</span>
                </span>
                <span className={`pill ${e.outcome === 'ok' ? 'pill-ok' : 'pill-bad'}`}>
                  {e.outcome}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Bottom-right Datadog-ish "live" tag */}
      <div className="mt-5 text-center text-[10px] font-mono uppercase tracking-widest"
           style={{ color: 'var(--ink-dim)' }}>
        Snapshot {summary.source} · {summary.demos_total} demos · {summary.monitors_total} monitors · refreshes daily
      </div>
    </div>
  );
}

// ----- helpers -----

function KpiTile({
  label, value, hint, spark, color,
}: { label: string; value: string; hint: string; spark: number[]; color: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="kpi-hint">{hint}</div>
        <Sparkline values={spark} stroke={color} width={64} height={20} fill={true} />
      </div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 85) return 'var(--ok)';
  if (score >= 70) return 'var(--warn)';
  return 'var(--bad)';
}

function actionColor(a: string): string {
  switch (a) {
    case 'GRANT':              return 'var(--ok)';
    case 'REVOKE':             return 'var(--warn)';
    case 'PERMISSION_DENIED':  return 'var(--bad)';
    case 'POLICY_VIOLATION':   return 'var(--bad)';
    case 'SCHEMA_CHANGE':      return 'var(--info)';
    case 'QUERY':              return 'var(--ink-muted)';
    case 'SECRET_ACCESS':      return 'var(--accent)';
    case 'DEPLOY':             return 'var(--info)';
    default:                   return 'var(--ink-2)';
  }
}
