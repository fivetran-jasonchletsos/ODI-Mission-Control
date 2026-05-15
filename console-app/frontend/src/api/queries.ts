// Static-snapshot reader. Generated daily by scripts/build_snapshot.py.
import type {
  PortfolioSummary,
  Demo,
  DemoUptime,
  DemoUsage,
  QualityMonitor,
  QualityRollup,
  LineageNode,
  LineageEdge,
  AuditEvent,
  RBACRole,
  ComplianceControl,
  CostBreakdown,
  PipelineConnector,
  Alert,
} from '../types';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

async function fetchJson<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Failed ${path}: ${r.status}`);
  return r.json() as Promise<T>;
}

let _summary: PortfolioSummary | null = null;
let _demos: Demo[] | null = null;

export const api = {
  getSummary: async (): Promise<PortfolioSummary> => {
    if (_summary) return _summary;
    _summary = await fetchJson<PortfolioSummary>('/data/summary.json');
    return _summary;
  },
  getDemos: async (): Promise<Demo[]> => {
    if (_demos) return _demos;
    _demos = (await fetchJson<{ demos: Demo[] }>('/data/demos.json')).demos;
    return _demos;
  },
  getUptime: async (): Promise<DemoUptime[]> =>
    (await fetchJson<{ uptime: DemoUptime[] }>('/data/uptime.json')).uptime,
  getUsage: async (): Promise<DemoUsage[]> =>
    (await fetchJson<{ usage: DemoUsage[] }>('/data/usage.json')).usage,
  getQualityMonitors: async (): Promise<QualityMonitor[]> =>
    (await fetchJson<{ monitors: QualityMonitor[] }>('/data/quality.json')).monitors,
  getQualityRollup: async (): Promise<QualityRollup[]> =>
    (await fetchJson<{ rollup: QualityRollup[] }>('/data/quality.json')).rollup,
  getLineage: async (): Promise<{ nodes: LineageNode[]; edges: LineageEdge[] }> =>
    fetchJson<{ nodes: LineageNode[]; edges: LineageEdge[] }>('/data/lineage.json'),
  getAudit: async (): Promise<AuditEvent[]> =>
    (await fetchJson<{ events: AuditEvent[] }>('/data/audit.json')).events,
  getRBAC: async (): Promise<RBACRole[]> =>
    (await fetchJson<{ roles: RBACRole[] }>('/data/rbac.json')).roles,
  getCompliance: async (): Promise<ComplianceControl[]> =>
    (await fetchJson<{ controls: ComplianceControl[] }>('/data/compliance.json')).controls,
  getCost: async (): Promise<CostBreakdown[]> =>
    (await fetchJson<{ breakdown: CostBreakdown[] }>('/data/cost.json')).breakdown,
  getPipelines: async (): Promise<PipelineConnector[]> =>
    (await fetchJson<{ connectors: PipelineConnector[] }>('/data/pipelines.json')).connectors,
  getAlerts: async (): Promise<Alert[]> =>
    (await fetchJson<{ alerts: Alert[] }>('/data/alerts.json')).alerts,
};

export function getSnapshotTime(): string | null {
  return _summary?.generated_at ?? null;
}

// ============================================================
// Formatters
// ============================================================

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9)  return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6)  return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3)  return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function formatLagSeconds(s: number | null | undefined): string {
  if (s === null || s === undefined) return '—';
  if (s >= 3600) return `${(s / 3600).toFixed(1)}h`;
  if (s >= 60)   return `${Math.round(s / 60)}m`;
  return `${Math.round(s)}s`;
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const s = Math.round(diff / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
