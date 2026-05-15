// PortfolioPage — drilldown table over all 8 ODI demos.
// Ops-console aesthetic: dense rows, status pills, sparklines, mono timestamps.
import { useEffect, useMemo, useState } from 'react';
import { api, formatCompact, formatCurrency, formatNumber, formatPct, relTime } from '../api/queries';
import type { Demo, PIITier, Status } from '../types';
import Sparkline from '../components/Sparkline';

const STATUS_ORDER: Record<Status, number> = {
  failing: 0,
  degraded: 1,
  unknown: 2,
  healthy: 3,
};

const STATUS_COLOR: Record<Status, string> = {
  healthy:  'var(--ok)',
  degraded: 'var(--warn)',
  failing:  'var(--bad)',
  unknown:  'var(--ink-dim)',
};

function statusPill(s: Status) {
  const cls =
    s === 'healthy'  ? 'pill-ok' :
    s === 'degraded' ? 'pill-warn' :
    s === 'failing'  ? 'pill-bad' :
                       'pill-dim';
  return (
    <span className={`pill ${cls}`}>
      <span className={`dot${s === 'failing' || s === 'degraded' ? ' pulse' : ''}`} />
      {s}
    </span>
  );
}

const PII_STYLE: Record<PIITier, { bg: string; fg: string; border: string }> = {
  PHI:      { bg: 'rgba(239,68,68,0.14)',  fg: '#fca5a5', border: 'rgba(239,68,68,0.32)' },
  PCI:      { bg: 'rgba(249,115,22,0.14)', fg: '#fdba74', border: 'rgba(249,115,22,0.32)' },
  PII:      { bg: 'rgba(245,158,11,0.14)', fg: '#fcd34d', border: 'rgba(245,158,11,0.32)' },
  internal: { bg: 'rgba(100,116,139,0.18)', fg: '#cbd5e1', border: 'rgba(148,163,184,0.30)' },
  public:   { bg: 'rgba(16,185,129,0.14)',  fg: '#6ee7b7', border: 'rgba(16,185,129,0.32)' },
};

function piiBadge(t: PIITier) {
  const s = PII_STYLE[t];
  return (
    <span
      className="pill font-mono"
      style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}` }}
    >
      {t}
    </span>
  );
}

// Deterministic pseudo-random sparkline trace derived from uptime + key.
function uptimeSpark(seed: string, target: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < 30; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const jitter = ((h % 1000) / 1000 - 0.5) * 1.2; // ±0.6%
    out.push(Math.min(100, Math.max(0, target + jitter)));
  }
  return out;
}

type SortKey = 'status' | 'name' | 'uptime' | 'rows' | 'mau' | 'cost';

export default function PortfolioPage() {
  const [demos, setDemos] = useState<Demo[] | null>(null);
  const [loadedAt, setLoadedAt] = useState<string>(new Date().toISOString());
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('status');

  useEffect(() => {
    let cancel = false;
    api.getDemos()
      .then((d) => { if (!cancel) { setDemos(d); setLoadedAt(new Date().toISOString()); } })
      .catch((e: unknown) => {
        if (!cancel) setError(e instanceof Error ? e.message : 'Failed to load demos');
      });
    return () => { cancel = true; };
  }, []);

  const sorted = useMemo(() => {
    if (!demos) return [];
    const copy = [...demos];
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'name':   return a.name.localeCompare(b.name);
        case 'uptime': return b.uptime_pct - a.uptime_pct;
        case 'rows':   return b.rows_24h - a.rows_24h;
        case 'mau':    return b.monthly_active - a.monthly_active;
        case 'cost':   return b.cost_30d_usd - a.cost_30d_usd;
        case 'status':
        default: {
          const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          return so !== 0 ? so : a.name.localeCompare(b.name);
        }
      }
    });
    return copy;
  }, [demos, sortKey]);

  const kpis = useMemo(() => {
    if (!demos || demos.length === 0) {
      return { total: 0, healthy: 0, degraded: 0, failing: 0, avgUptime: 0, mauTotal: 0 };
    }
    const healthy  = demos.filter((d) => d.status === 'healthy').length;
    const degraded = demos.filter((d) => d.status === 'degraded').length;
    const failing  = demos.filter((d) => d.status === 'failing').length;
    const avgUptime = demos.reduce((s, d) => s + d.uptime_pct, 0) / demos.length;
    const mauTotal  = demos.reduce((s, d) => s + d.monthly_active, 0);
    return { total: demos.length, healthy, degraded, failing, avgUptime, mauTotal };
  }, [demos]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <div className="eyebrow mb-1">Portfolio</div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
            Demo Portfolio <span style={{ color: 'var(--ink-dim)' }}>· Health and ownership</span>
          </h1>
        </div>
        <div className="text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
          LAST REFRESHED {relTime(loadedAt)}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="kpi">
          <div className="kpi-label">Total demos</div>
          <div className="kpi-value">{kpis.total}</div>
          <div className="kpi-hint">across 8 industries</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Health breakdown</div>
          <div className="kpi-value flex items-baseline gap-2">
            <span style={{ color: 'var(--ok)' }}>{kpis.healthy}</span>
            <span style={{ color: 'var(--ink-dim)', fontSize: 18 }}>/</span>
            <span style={{ color: 'var(--warn)' }}>{kpis.degraded}</span>
            <span style={{ color: 'var(--ink-dim)', fontSize: 18 }}>/</span>
            <span style={{ color: 'var(--bad)' }}>{kpis.failing}</span>
          </div>
          <div className="kpi-hint">healthy / degraded / failing</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Avg uptime 30d</div>
          <div className="kpi-value tabular">{formatPct(kpis.avgUptime, 2)}</div>
          <div className="kpi-hint">portfolio mean</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Monthly active</div>
          <div className="kpi-value tabular">{formatCompact(kpis.mauTotal)}</div>
          <div className="kpi-hint">trailing 30 days</div>
        </div>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <div className="panel-head">
          <div className="flex items-center gap-3">
            <span className="panel-title">All Demos</span>
            <span className="panel-sub">{sorted.length} rows</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
            <span>SORT</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="bg-transparent border rounded px-2 py-1"
              style={{ borderColor: 'var(--hairline-2)', color: 'var(--ink-2)' }}
            >
              <option value="status">Status</option>
              <option value="name">Name</option>
              <option value="uptime">Uptime</option>
              <option value="rows">Rows 24h</option>
              <option value="mau">MAU</option>
              <option value="cost">Cost 30d</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="px-4 py-6 text-[12px] font-mono" style={{ color: 'var(--bad)' }}>
            ERROR · {error}
          </div>
        )}

        {!demos && !error && (
          <div className="px-4 py-10 text-center text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
            LOADING DEMOS…
          </div>
        )}

        {demos && demos.length === 0 && (
          <div className="px-4 py-10 text-center text-[12px]" style={{ color: 'var(--ink-muted)' }}>
            No demos registered.
          </div>
        )}

        {sorted.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Demo</th>
                  <th>Warehouse</th>
                  <th>Connectors</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th className="text-right">Uptime 30d</th>
                  <th className="text-right">Rows 24h</th>
                  <th className="text-right">MAU</th>
                  <th className="text-right">Cost 30d</th>
                  <th>PII tier</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => {
                  const spark = uptimeSpark(d.key, d.uptime_pct);
                  return (
                    <tr
                      key={d.key}
                      className="row-link"
                      onClick={() => window.open(d.url, '_blank', 'noopener,noreferrer')}
                    >
                      <td>
                        <div className="flex flex-col">
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[13px] font-semibold flex items-center gap-1"
                            style={{ color: 'var(--ink)' }}
                          >
                            {d.name}
                            <span style={{ color: 'var(--info)' }}>↗</span>
                          </a>
                          <span className="text-[11px]" style={{ color: 'var(--ink-dim)' }}>
                            {d.industry}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className="pill font-mono"
                          style={{
                            background: 'rgba(167,139,250,0.10)',
                            color: 'var(--accent)',
                            border: '1px solid rgba(167,139,250,0.28)',
                          }}
                        >
                          {d.warehouse}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1 max-w-[260px]">
                          {d.connectors.map((c) => (
                            <span
                              key={c}
                              className="font-mono text-[10.5px] px-1.5 py-0.5 rounded"
                              style={{
                                background: 'rgba(255,255,255,0.04)',
                                color: 'var(--ink-2)',
                                border: '1px solid var(--hairline)',
                              }}
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-[12px]" style={{ color: 'var(--ink-2)' }}>
                          {d.owner}
                        </span>
                      </td>
                      <td>{statusPill(d.status)}</td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <span className="font-mono tabular text-[12px]">{formatPct(d.uptime_pct, 2)}</span>
                          <Sparkline values={spark} stroke={STATUS_COLOR[d.status]} width={64} height={20} />
                        </div>
                      </td>
                      <td className="text-right font-mono tabular">{formatCompact(d.rows_24h)}</td>
                      <td className="text-right font-mono tabular">{formatNumber(d.monthly_active)}</td>
                      <td className="text-right font-mono tabular">{formatCurrency(d.cost_30d_usd)}</td>
                      <td>{piiBadge(d.pii_tier)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
