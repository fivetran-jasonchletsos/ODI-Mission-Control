// AlertsPage — active and recent alerts across the portfolio.
import { useEffect, useMemo, useState } from 'react';
import { api, relTime } from '../api/queries';
import type { Alert, Demo, DemoKey, Severity } from '../types';

type AlertStatus = Alert['status'];

const SEVERITY_ORDER: Record<Severity, number> = {
  sev1: 0,
  sev2: 1,
  sev3: 2,
  info: 3,
};

const STATUS_ORDER: Record<AlertStatus, number> = {
  active: 0,
  acknowledged: 1,
  resolved: 2,
};

function severityPill(s: Severity) {
  // sev1 = bad red, sev2 = warn amber, sev3 = gold, info = slate
  const style =
    s === 'sev1' ? { bg: 'var(--bad-bg)',  fg: 'var(--bad)',  pulse: true  } :
    s === 'sev2' ? { bg: 'var(--warn-bg)', fg: 'var(--warn)', pulse: true  } :
    s === 'sev3' ? { bg: 'rgba(251,191,36,0.16)', fg: 'var(--gold)', pulse: false } :
                   { bg: 'rgba(148,163,184,0.16)', fg: 'var(--ink-muted)', pulse: false };
  return (
    <span className="pill font-mono" style={{ background: style.bg, color: style.fg }}>
      <span className={`dot${style.pulse ? ' pulse' : ''}`} />
      {s}
    </span>
  );
}

function statusPill(s: AlertStatus) {
  const cls =
    s === 'active'       ? 'pill-bad' :
    s === 'acknowledged' ? 'pill-warn' :
                           'pill-ok';
  return (
    <span className={`pill ${cls}`}>
      <span className={`dot${s === 'active' ? ' pulse' : ''}`} />
      {s}
    </span>
  );
}

const SEV_FILTERS: Severity[] = ['sev1', 'sev2', 'sev3'];
const STATUS_FILTERS: AlertStatus[] = ['active', 'acknowledged', 'resolved'];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [demos, setDemos] = useState<Demo[] | null>(null);
  const [loadedAt, setLoadedAt] = useState<string>(new Date().toISOString());
  const [error, setError] = useState<string | null>(null);
  const [sevFilter, setSevFilter] = useState<Record<Severity, boolean>>({
    sev1: true, sev2: true, sev3: true, info: true,
  });
  const [statusFilter, setStatusFilter] = useState<Record<AlertStatus, boolean>>({
    active: true, acknowledged: true, resolved: true,
  });

  useEffect(() => {
    let cancel = false;
    Promise.all([api.getAlerts(), api.getDemos()])
      .then(([a, d]) => {
        if (cancel) return;
        setAlerts(a);
        setDemos(d);
        setLoadedAt(new Date().toISOString());
      })
      .catch((e: unknown) => {
        if (!cancel) setError(e instanceof Error ? e.message : 'Failed to load alerts');
      });
    return () => { cancel = true; };
  }, []);

  const demoNameByKey = useMemo(() => {
    const map = new Map<DemoKey, string>();
    (demos ?? []).forEach((d) => map.set(d.key, d.name));
    return map;
  }, [demos]);

  const filtered = useMemo(() => {
    if (!alerts) return [];
    return alerts
      .filter((a) => sevFilter[a.severity] && statusFilter[a.status])
      .sort((a, b) => {
        const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (so !== 0) return so;
        const sv = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        if (sv !== 0) return sv;
        return new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime();
      });
  }, [alerts, sevFilter, statusFilter]);

  const kpis = useMemo(() => {
    const now = Date.now();
    const sevenDays = 7 * 86400 * 1000;
    const list = alerts ?? [];
    const active = list.filter((a) => a.status === 'active').length;
    const acknowledged = list.filter((a) => a.status === 'acknowledged').length;
    const resolved7d = list.filter((a) => {
      if (a.status !== 'resolved' || !a.resolved_at) return false;
      return now - new Date(a.resolved_at).getTime() <= sevenDays;
    }).length;
    return { active, acknowledged, resolved7d };
  }, [alerts]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <div className="eyebrow mb-1">Alerts</div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
            Alerts{' '}
            <span style={{ color: 'var(--ink-dim)' }}>· sev1, sev2, sev3, info — across the portfolio</span>
          </h1>
        </div>
        <div className="text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
          LAST REFRESHED {relTime(loadedAt)}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="kpi">
          <div className="kpi-label">Active</div>
          <div className="kpi-value tabular" style={{ color: 'var(--bad)' }}>{kpis.active}</div>
          <div className="kpi-hint">requires attention</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Acknowledged</div>
          <div className="kpi-value tabular" style={{ color: 'var(--warn)' }}>{kpis.acknowledged}</div>
          <div className="kpi-hint">owner engaged</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Resolved 7d</div>
          <div className="kpi-value tabular" style={{ color: 'var(--ok)' }}>{kpis.resolved7d}</div>
          <div className="kpi-hint">closed in trailing week</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">MTTR avg</div>
          <div className="kpi-value tabular">47m</div>
          <div className="kpi-hint">trailing 30d · synth</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="panel mb-4">
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--ink-muted)' }}>
              Severity
            </span>
            {SEV_FILTERS.map((s) => (
              <label
                key={s}
                className="flex items-center gap-1.5 cursor-pointer text-[11.5px] font-mono"
                style={{ color: 'var(--ink-2)' }}
              >
                <input
                  type="checkbox"
                  checked={sevFilter[s]}
                  onChange={(e) => setSevFilter({ ...sevFilter, [s]: e.target.checked })}
                  className="accent-[#22d3ee]"
                />
                {severityPill(s)}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--ink-muted)' }}>
              Status
            </span>
            {STATUS_FILTERS.map((s) => (
              <label
                key={s}
                className="flex items-center gap-1.5 cursor-pointer text-[11.5px] font-mono"
                style={{ color: 'var(--ink-2)' }}
              >
                <input
                  type="checkbox"
                  checked={statusFilter[s]}
                  onChange={(e) => setStatusFilter({ ...statusFilter, [s]: e.target.checked })}
                  className="accent-[#22d3ee]"
                />
                {statusPill(s)}
              </label>
            ))}
          </div>
          <div className="ml-auto text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
            {filtered.length} / {alerts?.length ?? 0} alerts
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <div className="panel-head">
          <span className="panel-title">Alert Feed</span>
          <span className="panel-sub">sorted by status · severity · recency</span>
        </div>

        {error && (
          <div className="px-4 py-6 text-[12px] font-mono" style={{ color: 'var(--bad)' }}>
            ERROR · {error}
          </div>
        )}

        {!alerts && !error && (
          <div className="px-4 py-10 text-center text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
            LOADING ALERTS…
          </div>
        )}

        {alerts && filtered.length === 0 && !error && (
          <div className="px-4 py-10 text-center text-[12px]" style={{ color: 'var(--ink-muted)' }}>
            No alerts match your filters.
          </div>
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Demo</th>
                  <th>Title</th>
                  <th>Owner</th>
                  <th>Triggered</th>
                  <th>Runbook</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td>{severityPill(a.severity)}</td>
                    <td>{statusPill(a.status)}</td>
                    <td>
                      <span className="font-mono text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
                        {demoNameByKey.get(a.demo) ?? a.demo}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-[12.5px]" style={{ color: 'var(--ink)' }}>{a.title}</span>
                        <span className="text-[11px]" style={{ color: 'var(--ink-dim)' }}>{a.detail}</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-[11.5px]" style={{ color: 'var(--ink-muted)' }}>
                        {a.owner}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-[11.5px]" style={{ color: 'var(--ink-muted)' }}>
                        {relTime(a.triggered_at)}
                      </span>
                    </td>
                    <td>
                      {a.runbook_url ? (
                        <a
                          href={a.runbook_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11.5px] font-mono"
                          style={{ color: 'var(--info)' }}
                        >
                          Runbook ↗
                        </a>
                      ) : (
                        <span className="text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
