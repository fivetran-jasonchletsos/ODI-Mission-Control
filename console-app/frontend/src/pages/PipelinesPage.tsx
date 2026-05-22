// PipelinesPage — aggregate connector replication health across all 8 demos.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { api, formatCompact, formatLagSeconds, relTime } from '../api/queries';
import type { Demo, DemoKey, PipelineConnector, Status } from '../types';
import Sparkline from '../components/Sparkline';

const STATUS_COLOR: Record<Status, string> = {
  healthy:  'var(--ok)',
  degraded: 'var(--warn)',
  failing:  'var(--bad)',
  unknown:  'var(--ink-dim)',
};

const STATUS_STROKE: Record<Status, string> = {
  healthy:  '#22c55e',
  degraded: '#f59e0b',
  failing:  '#ef4444',
  unknown:  '#64748b',
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

function MinMax({ values, format }: { values: number[]; format: (n: number) => string }) {
  if (!values || values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (
    <span className="text-[10px] font-mono" style={{ color: 'var(--ink-dim)' }}>
      min {format(min)} · max {format(max)}
    </span>
  );
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<PipelineConnector[] | null>(null);
  const [demos, setDemos] = useState<Demo[] | null>(null);
  const [loadedAt, setLoadedAt] = useState<string>(new Date().toISOString());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    Promise.all([api.getPipelines(), api.getDemos()])
      .then(([p, d]) => {
        if (cancel) return;
        setPipelines(p);
        setDemos(d);
        setLoadedAt(new Date().toISOString());
      })
      .catch((e: unknown) => {
        if (!cancel) setError(e instanceof Error ? e.message : 'Failed to load pipelines');
      });
    return () => { cancel = true; };
  }, []);

  const demoNameByKey = useMemo(() => {
    const map = new Map<DemoKey, string>();
    (demos ?? []).forEach((d) => map.set(d.key, d.name));
    return map;
  }, [demos]);

  const kpis = useMemo(() => {
    if (!pipelines) return { total: 0, healthy: 0, degraded: 0, failing: 0 };
    return {
      total:    pipelines.length,
      healthy:  pipelines.filter((p) => p.status === 'healthy').length,
      degraded: pipelines.filter((p) => p.status === 'degraded').length,
      failing:  pipelines.filter((p) => p.status === 'failing').length,
    };
  }, [pipelines]);

  // Group by demo for section dividers, preserving demo order from /demos.
  const grouped = useMemo(() => {
    if (!pipelines) return [];
    const byDemo = new Map<DemoKey, PipelineConnector[]>();
    pipelines.forEach((p) => {
      const arr = byDemo.get(p.demo) ?? [];
      arr.push(p);
      byDemo.set(p.demo, arr);
    });
    const order: DemoKey[] = (demos ?? []).map((d) => d.key);
    // Append any demos that appear in pipelines but not in demo list.
    byDemo.forEach((_v, k) => { if (!order.includes(k)) order.push(k); });
    return order
      .filter((k) => byDemo.has(k))
      .map((k) => ({ demo: k, name: demoNameByKey.get(k) ?? k, rows: byDemo.get(k)! }));
  }, [pipelines, demos, demoNameByKey]);

  return (
    <div className="mc-page mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <div className="eyebrow mb-1">Pipelines</div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
            Replication Pipelines{' '}
            <span style={{ color: 'var(--ink-dim)' }}>· live status across the portfolio</span>
          </h1>
        </div>
        <div className="text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
          LAST REFRESHED {relTime(loadedAt)}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="kpi">
          <div className="kpi-label">Total connectors</div>
          <div className="kpi-value tabular">{kpis.total}</div>
          <div className="kpi-hint">across all demos</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Healthy</div>
          <div className="kpi-value tabular" style={{ color: 'var(--ok)' }}>{kpis.healthy}</div>
          <div className="kpi-hint">syncing on-cadence</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Degraded</div>
          <div className="kpi-value tabular" style={{ color: 'var(--warn)' }}>{kpis.degraded}</div>
          <div className="kpi-hint">elevated lag / errors</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Failing</div>
          <div className="kpi-value tabular" style={{ color: 'var(--bad)' }}>{kpis.failing}</div>
          <div className="kpi-hint">action required</div>
        </div>
      </div>

      {/* Body */}
      <div className="panel overflow-hidden">
        <div className="panel-head">
          <div className="flex items-center gap-3">
            <span className="panel-title">Connector Health</span>
            <span className="panel-sub">{pipelines?.length ?? 0} pipelines · grouped by demo</span>
          </div>
          <span className="text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
            24H WINDOW
          </span>
        </div>

        {error && (
          <div className="px-4 py-6 text-[12px] font-mono" style={{ color: 'var(--bad)' }}>
            ERROR · {error}
          </div>
        )}

        {!pipelines && !error && (
          <div className="px-4 py-10 text-center text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
            LOADING PIPELINES…
          </div>
        )}

        {pipelines && pipelines.length === 0 && (
          <div className="px-4 py-10 text-center text-[12px]" style={{ color: 'var(--ink-muted)' }}>
            No connectors registered.
          </div>
        )}

        {grouped.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Connector</th>
                  <th>Source → Destination</th>
                  <th>Status</th>
                  <th>Throughput (24h)</th>
                  <th>Lag (24h)</th>
                  <th>Last sync</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => (
                  <Fragment key={group.demo}>
                    {/* Demo section divider */}
                    <tr style={{ background: 'rgba(255,255,255,0.025)' }}>
                      <td colSpan={7} style={{ padding: '8px 12px', borderBottom: '1px solid var(--hairline-2)' }}>
                        <div className="flex items-center gap-2">
                          <span className="eyebrow" style={{ color: 'var(--ink-muted)' }}>
                            {group.name}
                          </span>
                          <span className="font-mono text-[10px]" style={{ color: 'var(--ink-dim)' }}>
                            {group.demo} · {group.rows.length} connector{group.rows.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {group.rows.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-[12px]" style={{ color: 'var(--ink)' }}>
                              {p.source}
                            </span>
                            {p.fivetran_id && (
                              <span className="font-mono text-[10px]" style={{ color: 'var(--ink-dim)' }}>
                                {p.fivetran_id}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="font-mono text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
                            <span style={{ color: 'var(--ink-2)' }}>{p.source}</span>
                            <span className="px-1.5" style={{ color: 'var(--ink-dim)' }}>→</span>
                            <span style={{ color: 'var(--info)' }}>{p.destination}</span>
                          </span>
                        </td>
                        <td>{statusPill(p.status)}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Sparkline
                              values={p.throughput_24h}
                              stroke={STATUS_STROKE[p.status]}
                              width={96}
                              height={24}
                            />
                            <div className="flex flex-col leading-tight">
                              <span className="font-mono tabular text-[12px]" style={{ color: 'var(--ink)' }}>
                                {formatCompact(p.throughput_rps)} r/s
                              </span>
                              <MinMax
                                values={p.throughput_24h}
                                format={(n) => `${formatCompact(n)} r/s`}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Sparkline
                              values={p.lag_24h}
                              stroke={STATUS_STROKE[p.status]}
                              width={96}
                              height={24}
                            />
                            <div className="flex flex-col leading-tight">
                              <span
                                className="font-mono tabular text-[12px]"
                                style={{ color: STATUS_COLOR[p.status] }}
                              >
                                {formatLagSeconds(p.lag_s)}
                              </span>
                              <MinMax values={p.lag_24h} format={formatLagSeconds} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="font-mono text-[11.5px]" style={{ color: 'var(--ink-muted)' }}>
                            {relTime(p.last_sync_at)}
                          </span>
                        </td>
                        <td>
                          {p.fivetran_id && (
                            <a
                              className="btn-fivetran"
                              href={`https://fivetran.com/dashboard/connectors/${p.fivetran_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Open connector ${p.fivetran_id} in Fivetran`}
                            >
                              Open in Fivetran
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
