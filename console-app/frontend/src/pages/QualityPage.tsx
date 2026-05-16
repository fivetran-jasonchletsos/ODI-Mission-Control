import { useEffect, useMemo, useState } from 'react';
import { api, relTime } from '../api/queries';
import Sparkline from '../components/Sparkline';
import type {
  DemoKey,
  MonitorStatus,
  MonitorType,
  QualityMonitor,
  QualityRollup,
} from '../types';

// ============================================================
// Demo metadata — keeps page self-contained for filtering/labels.
// Keyed by string (not DemoKey) so the page survives snapshots that
// include demos not yet declared in the DemoKey union (e.g. insurance).
// ============================================================
const DEMO_META: Record<string, { name: string; industry: string }> = {
  'tax-assessment': { name: 'Tax Assessment', industry: 'Public Sector' },
  healthcare:       { name: 'Healthcare',     industry: 'Health & Life Sciences' },
  finserv:          { name: 'FinServ',        industry: 'Financial Services' },
  insurance:        { name: 'Insurance',      industry: 'Insurance' },
  media:            { name: 'Media',          industry: 'Media & Ent.' },
  retail:           { name: 'Retail',         industry: 'Retail & CPG' },
  techsaas:         { name: 'Tech / SaaS',    industry: 'Technology' },
  supplychain:      { name: 'Supply Chain',   industry: 'Manufacturing' },
  lifesci:          { name: 'Life Sciences',  industry: 'Pharma & Biotech' },
};

function demoMeta(k: string): { name: string; industry: string } {
  return DEMO_META[k] ?? { name: k, industry: '—' };
}

const ALL_DEMOS: DemoKey[] = [
  'tax-assessment', 'healthcare', 'finserv', 'media',
  'retail', 'techsaas', 'supplychain', 'lifesci',
];

const STATUS_PRIORITY: Record<MonitorStatus, number> = {
  fail: 0, warn: 1, pass: 2, paused: 3,
};

const MONITOR_TYPES: MonitorType[] = [
  'freshness', 'volume', 'schema', 'distribution',
  'nulls', 'uniqueness', 'referential', 'custom_sql',
];

// Deterministic per-demo sparkline if rollup history is missing.
function pseudoSpark(seed: string, n = 30): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    out.push(60 + (h % 40));
  }
  return out;
}

function healthColor(score: number): string {
  if (score >= 85) return 'var(--ok)';
  if (score >= 70) return 'var(--warn)';
  return 'var(--bad)';
}

function statusPillClass(s: MonitorStatus): string {
  if (s === 'pass')   return 'pill pill-ok';
  if (s === 'warn')   return 'pill pill-warn';
  if (s === 'fail')   return 'pill pill-bad';
  return 'pill pill-dim';
}

function typeBadgeColor(t: MonitorType): string {
  switch (t) {
    case 'freshness':    return '#22d3ee';
    case 'volume':       return '#a78bfa';
    case 'schema':       return '#f59e0b';
    case 'distribution': return '#34d399';
    case 'nulls':        return '#fb7185';
    case 'uniqueness':   return '#fbbf24';
    case 'referential':  return '#60a5fa';
    case 'custom_sql':   return '#94a3b8';
  }
}

export default function QualityPage() {
  const [monitors, setMonitors] = useState<QualityMonitor[]>([]);
  const [rollup, setRollup]     = useState<QualityRollup[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<string>('');
  const [demoFilter, setDemoFilter]   = useState<DemoKey | null>(null);
  const [expanded, setExpanded]       = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getQualityMonitors(), api.getQualityRollup()])
      .then(([m, r]) => {
        if (!alive) return;
        setMonitors(m);
        setRollup(r);
        setRefreshedAt(new Date().toISOString());
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // ---- KPI tallies across all monitors ----
  const kpis = useMemo(() => {
    let pass = 0, warn = 0, fail = 0, paused = 0;
    for (const m of monitors) {
      if (m.status === 'pass')   pass++;
      else if (m.status === 'warn') warn++;
      else if (m.status === 'fail') fail++;
      else if (m.status === 'paused') paused++;
    }
    return { total: monitors.length, pass, warn, fail, paused };
  }, [monitors]);

  // ---- Rollup-by-demo (fallback if API didn't supply it) ----
  const rollupByDemo = useMemo<Record<string, QualityRollup>>(() => {
    const out: Record<string, QualityRollup> = {};
    for (const r of rollup) out[r.demo] = r;
    // Backfill from monitors if anything is missing.
    for (const k of ALL_DEMOS) {
      if (out[k]) continue;
      const here = monitors.filter((m) => m.demo === k);
      const pass = here.filter((m) => m.status === 'pass').length;
      const warn = here.filter((m) => m.status === 'warn').length;
      const fail = here.filter((m) => m.status === 'fail').length;
      const paused = here.filter((m) => m.status === 'paused').length;
      const total = here.length;
      const raw = pass * 1 - warn * 2 - fail * 5;
      const score = total > 0 ? Math.max(0, Math.min(100, Math.round(70 + (raw / total) * 6))) : 0;
      out[k] = { demo: k, pass, warn, fail, paused, monitors_total: total, health_score: score };
    }
    return out;
  }, [rollup, monitors]);

  // ---- Monitor-type breakdown ----
  const typeCounts = useMemo<Record<MonitorType, number>>(() => {
    const base = Object.fromEntries(MONITOR_TYPES.map((t) => [t, 0])) as Record<MonitorType, number>;
    for (const m of monitors) base[m.type]++;
    return base;
  }, [monitors]);
  const maxTypeCount = useMemo(
    () => Math.max(1, ...Object.values(typeCounts)),
    [typeCounts],
  );

  // ---- Filtered + sorted table rows ----
  const tableRows = useMemo(() => {
    const filtered = demoFilter ? monitors.filter((m) => m.demo === demoFilter) : monitors;
    return [...filtered].sort((a, b) => {
      const d = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (d !== 0) return d;
      return a.table.localeCompare(b.table);
    });
  }, [monitors, demoFilter]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6">
      {/* ---------- Page Header ---------- */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <div className="eyebrow">Observability · monitors</div>
          <h1 className="text-2xl font-bold tracking-tight mt-1" style={{ color: 'var(--ink)' }}>
            Data Quality
            <span className="ml-2 font-mono text-sm" style={{ color: 'var(--ink-muted)' }}>
              · 8 demos · {loading ? '…' : kpis.total} monitors
            </span>
          </h1>
        </div>
        <div className="text-[11px] font-mono flex items-center gap-2" style={{ color: 'var(--ink-dim)' }}>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--ok)' }}
          />
          LAST REFRESH {refreshedAt ? relTime(refreshedAt) : '—'}
        </div>
      </header>

      {/* ---------- KPI strip (5 tiles) ---------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <Kpi label="Total monitors" value={kpis.total} />
        <Kpi label="Passing"  value={kpis.pass}   color="var(--ok)" />
        <Kpi label="Warning"  value={kpis.warn}   color="var(--warn)" />
        <Kpi label="Failing"  value={kpis.fail}   color="var(--bad)" />
        <Kpi label="Paused"   value={kpis.paused} color="var(--ink-muted)" />
      </div>

      {/* ---------- Health score by demo ---------- */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="eyebrow">Health by demo</div>
          {demoFilter && (
            <button
              type="button"
              onClick={() => setDemoFilter(null)}
              className="font-mono text-[11px] px-2 py-1 rounded border"
              style={{ borderColor: 'var(--hairline-2)', color: 'var(--ink-2)' }}
            >
              Clear filter ({demoMeta(demoFilter).name}) ×
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {ALL_DEMOS.map((k) => {
            const r = rollupByDemo[k];
            const meta = demoMeta(k);
            const active = demoFilter === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setDemoFilter(active ? null : k)}
                className="panel text-left transition-colors"
                style={{
                  padding: '12px 12px 10px',
                  borderColor: active ? 'var(--info)' : 'var(--hairline)',
                  background: active ? 'rgba(34,211,238,0.04)' : 'var(--panel)',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                      {meta.name}
                    </div>
                    <div className="text-[10px] font-mono truncate" style={{ color: 'var(--ink-dim)' }}>
                      {meta.industry}
                    </div>
                  </div>
                  <Sparkline
                    values={pseudoSpark(k)}
                    width={56}
                    height={20}
                    stroke={healthColor(r.health_score)}
                  />
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span
                    className="text-2xl font-bold tabular"
                    style={{ color: healthColor(r.health_score) }}
                  >
                    {r.health_score}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--ink-dim)' }}>
                    /100
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] font-mono">
                  <span style={{ color: 'var(--ok)' }}>{r.pass}P</span>
                  <span style={{ color: 'var(--warn)' }}>{r.warn}W</span>
                  <span style={{ color: 'var(--bad)' }}>{r.fail}F</span>
                  <span style={{ color: 'var(--ink-dim)' }}>· {r.monitors_total} total</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------- Monitor type breakdown ---------- */}
      <section className="panel mb-6">
        <div className="panel-head">
          <div className="panel-title">Monitor Type Breakdown</div>
          <div className="panel-sub">{kpis.total} total · 8 types</div>
        </div>
        <div className="p-4 space-y-2">
          {MONITOR_TYPES.map((t) => {
            const c = typeCounts[t];
            const pct = (c / maxTypeCount) * 100;
            return (
              <div key={t} className="flex items-center gap-3">
                <div
                  className="w-32 text-[11px] font-mono uppercase tracking-wider shrink-0"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  {t.replace('_', ' ')}
                </div>
                <div className="flex-1 h-2.5 rounded-sm relative" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{ width: `${pct}%`, background: typeBadgeColor(t), opacity: 0.85 }}
                  />
                </div>
                <div
                  className="w-10 text-right text-[12px] font-mono tabular"
                  style={{ color: 'var(--ink-2)' }}
                >
                  {c}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- Active monitors table ---------- */}
      <section className="panel">
        <div className="panel-head">
          <div className="panel-title">
            Active Monitors
            {demoFilter && (
              <span className="ml-2 normal-case tracking-normal font-normal text-[11px]"
                    style={{ color: 'var(--ink-dim)' }}>
                · filtered to {demoMeta(demoFilter).name}
              </span>
            )}
          </div>
          <div className="panel-sub">{tableRows.length} rows · failing first</div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Demo</th>
                <th>Table</th>
                <th>Type</th>
                <th>Status</th>
                <th>Threshold</th>
                <th>Observed</th>
                <th>Trend</th>
                <th>Last run</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="text-center font-mono text-[11px]"
                      style={{ color: 'var(--ink-dim)' }}>
                    LOADING MONITORS…
                  </td>
                </tr>
              )}
              {!loading && tableRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center font-mono text-[11px]"
                      style={{ color: 'var(--ink-dim)' }}>
                    NO MONITORS FOUND
                  </td>
                </tr>
              )}
              {tableRows.map((m) => {
                const isOpen = expanded === m.id;
                const stroke =
                  m.status === 'fail' ? 'var(--bad)' :
                  m.status === 'warn' ? 'var(--warn)' :
                  m.status === 'paused' ? 'var(--ink-muted)' : 'var(--ok)';
                return (
                  <RowFragment key={m.id}>
                    <tr
                      className="row-link"
                      onClick={() => setExpanded(isOpen ? null : m.id)}
                    >
                      <td className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                        {demoMeta(m.demo).name}
                      </td>
                      <td className="font-mono text-[12px]" style={{ color: 'var(--ink)' }}>
                        {m.table}
                      </td>
                      <td>
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider"
                          style={{
                            color: typeBadgeColor(m.type),
                            background: 'rgba(255,255,255,0.04)',
                            border: `1px solid ${typeBadgeColor(m.type)}33`,
                          }}
                        >
                          {m.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span className={statusPillClass(m.status)}>
                          <span className={`dot${m.status === 'fail' ? ' pulse' : ''}`} />
                          {m.status}
                        </span>
                      </td>
                      <td className="text-[12px] font-mono" style={{ color: 'var(--ink-muted)' }}>
                        {m.threshold}
                      </td>
                      <td className="text-[12px] font-mono" style={{ color: 'var(--ink-2)' }}>
                        {m.observed}
                      </td>
                      <td>
                        <Sparkline values={m.trend} width={88} height={22} stroke={stroke} />
                      </td>
                      <td className="text-[12px] font-mono" style={{ color: 'var(--ink-dim)' }}>
                        {relTime(m.last_run_at)}
                      </td>
                      <td className="text-[12px] font-mono" style={{ color: 'var(--ink-2)' }}>
                        {m.owner}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr style={{ background: 'rgba(34,211,238,0.04)' }}>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <ExpandedMonitor m={m} onClose={() => setExpanded(null)} />
                        </td>
                      </tr>
                    )}
                  </RowFragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================
function Kpi({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function RowFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ExpandedMonitor({ m, onClose }: { m: QualityMonitor; onClose: () => void }) {
  return (
    <div className="p-4 grid md:grid-cols-3 gap-4" style={{ borderTop: '1px solid var(--hairline)' }}>
      <div>
        <div className="eyebrow mb-1.5">Monitor</div>
        <div className="font-mono text-[12px] break-all" style={{ color: 'var(--ink)' }}>{m.id}</div>
        <div className="font-mono text-[11px] mt-1" style={{ color: 'var(--ink-dim)' }}>
          SLA · {m.sla_hours}h
        </div>
      </div>
      <div>
        <div className="eyebrow mb-1.5">Schedule</div>
        <div className="font-mono text-[12px]" style={{ color: 'var(--ink-2)' }}>
          Next run · {relTime(m.next_run_at)}
        </div>
        <div className="font-mono text-[11px] mt-1" style={{ color: 'var(--ink-dim)' }}>
          Last run · {relTime(m.last_run_at)}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end items-start">
        <ActionBtn label="Acknowledge" />
        <ActionBtn label="Snooze 1h" />
        <ActionBtn label="Mute" tone="dim" />
        <ActionBtn label="Close" tone="ghost" onClick={onClose} />
      </div>
    </div>
  );
}

function ActionBtn({
  label, tone = 'primary', onClick,
}: { label: string; tone?: 'primary' | 'dim' | 'ghost'; onClick?: () => void }) {
  const style: React.CSSProperties =
    tone === 'primary'
      ? { borderColor: 'var(--info)', color: 'var(--info)', background: 'rgba(34,211,238,0.08)' }
      : tone === 'dim'
      ? { borderColor: 'var(--hairline-2)', color: 'var(--ink-muted)' }
      : { borderColor: 'transparent', color: 'var(--ink-dim)' };
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="px-2.5 py-1 rounded border font-mono text-[11px] uppercase tracking-wider"
      style={style}
    >
      {label}
    </button>
  );
}
