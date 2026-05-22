import { useEffect, useMemo, useState } from 'react';
import { api, relTime } from '../api/queries';
import type {
  AuditEvent,
  RBACRole,
  ComplianceControl,
  DemoKey,
} from '../types';

// ============================================================
// Helpers
// ============================================================

const FRAMEWORK_ORDER: ComplianceControl['framework'][] = [
  'SOC 2',
  'HIPAA',
  'GDPR',
  '21 CFR Part 11',
  'ISO 27001',
  'PCI DSS',
];

function statusPillClass(status: ComplianceControl['status']): string {
  if (status === 'covered') return 'pill pill-ok';
  if (status === 'partial') return 'pill pill-warn';
  return 'pill pill-bad';
}

function actionStyle(action: AuditEvent['action']): {
  bg: string;
  fg: string;
  border: string;
} {
  // Color-coded per spec.
  switch (action) {
    case 'GRANT':
      return { bg: 'var(--ok-bg)', fg: 'var(--ok)', border: 'rgba(34,197,94,0.30)' };
    case 'REVOKE':
      return { bg: 'var(--warn-bg)', fg: 'var(--warn)', border: 'rgba(245,158,11,0.30)' };
    case 'PERMISSION_DENIED':
    case 'POLICY_VIOLATION':
      return { bg: 'var(--bad-bg)', fg: 'var(--bad)', border: 'rgba(239,68,68,0.30)' };
    case 'SCHEMA_CHANGE':
    case 'DEPLOY':
      return { bg: 'var(--info-bg)', fg: 'var(--info)', border: 'rgba(34,211,238,0.30)' };
    case 'SECRET_ACCESS':
      return { bg: 'var(--accent-bg)', fg: 'var(--accent)', border: 'rgba(167,139,250,0.30)' };
    case 'QUERY':
    default:
      return {
        bg: 'rgba(148,163,184,0.12)',
        fg: 'var(--ink-muted)',
        border: 'rgba(148,163,184,0.25)',
      };
  }
}

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function formatIsoShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
  } catch {
    return iso;
  }
}

// ============================================================
// Page
// ============================================================

export default function GovernancePage() {
  const [controls, setControls] = useState<ComplianceControl[] | null>(null);
  const [roles, setRoles] = useState<RBACRole[] | null>(null);
  const [audit, setAudit] = useState<AuditEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getCompliance(), api.getRBAC(), api.getAudit()])
      .then(([c, r, a]) => {
        setControls(c);
        setRoles(r);
        setAudit(a);
      })
      .catch((e: unknown) => setErr(String(e)));
  }, []);

  // ---- KPI calcs ----
  const kpis = useMemo(() => {
    const totalRoles = roles?.length ?? 0;
    const totalControls = controls?.length ?? 0;
    const covered = (controls ?? []).filter((c) => c.status === 'covered').length;
    const gaps = (controls ?? []).filter((c) => c.status === 'gap').length;
    const coveredPct = totalControls ? (covered / totalControls) * 100 : 0;
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    const recent = (audit ?? []).filter((e) => {
      const t = Date.parse(e.ts);
      return !Number.isNaN(t) && t >= cutoff;
    }).length;
    return { totalRoles, coveredPct, covered, totalControls, gaps, recent };
  }, [controls, roles, audit]);

  // ---- Grouped compliance ----
  const grouped = useMemo(() => {
    const m = new Map<ComplianceControl['framework'], ComplianceControl[]>();
    (controls ?? []).forEach((c) => {
      const arr = m.get(c.framework) ?? [];
      arr.push(c);
      m.set(c.framework, arr);
    });
    // Sort frameworks: those with any gap first, else by canonical order.
    return FRAMEWORK_ORDER.filter((f) => m.has(f))
      .map((f) => ({ framework: f, items: m.get(f)! }))
      .sort((a, b) => {
        const aGap = a.items.some((x) => x.status === 'gap') ? 0 : 1;
        const bGap = b.items.some((x) => x.status === 'gap') ? 0 : 1;
        return aGap - bGap;
      });
  }, [controls]);

  // ---- Recent audit (last 50, newest first) ----
  const recentAudit = useMemo(() => {
    if (!audit) return [];
    return [...audit]
      .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
      .slice(0, 50);
  }, [audit]);

  if (err) {
    return (
      <div className="mc-page mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6">
        <div className="panel p-6 font-mono text-sm" style={{ color: 'var(--bad)' }}>
          Failed to load governance data: {err}
        </div>
      </div>
    );
  }

  const loading = !controls || !roles || !audit;

  return (
    <div className="mc-page mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-5">
        <div className="eyebrow">Governance</div>
        <h1 className="mt-1 text-[22px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          Governance · access, audit, compliance posture
        </h1>
        <p className="mt-1 text-[12px] font-mono" style={{ color: 'var(--ink-dim)' }}>
          {loading ? 'Loading…' : `${controls!.length} controls · ${roles!.length} roles · ${audit!.length} audit events tracked`}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi
          label="Active roles"
          value={kpis.totalRoles.toString()}
          hint="RBAC catalog"
        />
        <Kpi
          label="Controls covered"
          value={`${kpis.coveredPct.toFixed(0)}%`}
          hint={`${kpis.covered} of ${kpis.totalControls}`}
          tone={kpis.coveredPct >= 80 ? 'ok' : kpis.coveredPct >= 60 ? 'warn' : 'bad'}
        />
        <Kpi
          label="Compliance gaps"
          value={kpis.gaps.toString()}
          hint="status = gap"
          tone={kpis.gaps === 0 ? 'ok' : kpis.gaps <= 2 ? 'warn' : 'bad'}
        />
        <Kpi
          label="Audit events 7d"
          value={kpis.recent.toLocaleString()}
          hint="rolling window"
        />
      </div>

      {/* Compliance posture grid */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="eyebrow">Compliance posture</div>
            <h2 className="text-[16px] font-semibold mt-0.5">By framework</h2>
          </div>
          <div className="text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
            frameworks with gaps surfaced first
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {grouped.map(({ framework, items }) => {
            const gapN = items.filter((x) => x.status === 'gap').length;
            const partN = items.filter((x) => x.status === 'partial').length;
            const covN = items.filter((x) => x.status === 'covered').length;
            return (
              <div key={framework} className="panel">
                <div className="panel-head">
                  <div className="flex items-center gap-3">
                    <span className="panel-title">{framework}</span>
                    <span className="panel-sub">{items.length} controls</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {covN > 0 && (
                      <span className="pill pill-ok">
                        <span className="dot" /> {covN}
                      </span>
                    )}
                    {partN > 0 && (
                      <span className="pill pill-warn">
                        <span className="dot" /> {partN}
                      </span>
                    )}
                    {gapN > 0 && (
                      <span className="pill pill-bad">
                        <span className="dot" /> {gapN}
                      </span>
                    )}
                  </div>
                </div>
                <ul className="divide-y" style={{ borderColor: 'var(--hairline)' }}>
                  {items.map((c) => (
                    <ComplianceRow key={`${c.framework}-${c.id}`} c={c} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* RBAC table */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="eyebrow">RBAC</div>
            <h2 className="text-[16px] font-semibold mt-0.5">Roles &amp; scopes</h2>
          </div>
          <div className="text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
            click row to expand
          </div>
        </div>
        <div className="panel overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th className="text-right">Users</th>
                <th className="text-right">Scopes</th>
                <th>Example user</th>
              </tr>
            </thead>
            <tbody>
              {(roles ?? []).map((r) => {
                const open = expandedRole === r.role;
                return (
                  <>
                    <tr
                      key={r.role}
                      className="row-link"
                      onClick={() => setExpandedRole(open ? null : r.role)}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <span
                            className="font-mono text-[10px]"
                            style={{ color: 'var(--ink-dim)' }}
                          >
                            {open ? '▼' : '▸'}
                          </span>
                          <span className="font-semibold" style={{ color: 'var(--ink)' }}>
                            {r.role}
                          </span>
                        </div>
                      </td>
                      <td className="text-right font-mono tabular">{r.users}</td>
                      <td className="text-right font-mono tabular">{r.scopes}</td>
                      <td className="font-mono" style={{ color: 'var(--ink-2)' }}>
                        {r.example_user}
                      </td>
                    </tr>
                    {open && (
                      <tr key={`${r.role}-x`}>
                        <td colSpan={4} style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <div
                            className="text-[12px] font-mono px-2 py-1"
                            style={{ color: 'var(--ink-muted)' }}
                          >
                            <span style={{ color: 'var(--ink-dim)' }}>scope summary →</span>{' '}
                            {r.scopes} scope(s) across {r.users} user(s). Sample principal:{' '}
                            <span style={{ color: 'var(--info)' }}>{r.example_user}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Audit log feed */}
      <section className="mb-2">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="eyebrow">Audit log</div>
            <h2 className="text-[16px] font-semibold mt-0.5">Recent events</h2>
          </div>
          <div className="text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
            last 50 · newest first
          </div>
        </div>
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>TS</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Demo</th>
                  <th>Outcome</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {recentAudit.map((e, i) => (
                  <AuditRow key={`${e.ts}-${i}`} e={e} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  const toneColor =
    tone === 'ok'
      ? 'var(--ok)'
      : tone === 'warn'
        ? 'var(--warn)'
        : tone === 'bad'
          ? 'var(--bad)'
          : 'var(--ink)';
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value tabular" style={{ color: toneColor }}>
        {value}
      </div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

function ComplianceRow({ c }: { c: ComplianceControl }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="px-3 py-2.5 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-start gap-3">
        <span className={statusPillClass(c.status)} style={{ marginTop: 2 }}>
          <span className="dot" />
          {c.status}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] font-bold" style={{ color: 'var(--info)' }}>
              {c.id}
            </span>
            <span className="text-[13px]" style={{ color: 'var(--ink)' }}>
              {c.title}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-left text-[12px] font-mono w-full"
            style={{ color: 'var(--ink-muted)' }}
            title={c.evidence}
          >
            <span style={{ color: 'var(--ink-dim)' }}>evidence:</span>{' '}
            {expanded ? c.evidence : truncate(c.evidence, 90)}
          </button>
          {c.applies_to && c.applies_to.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {c.applies_to.map((d: DemoKey) => (
                <span
                  key={d}
                  className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: 'var(--ink-muted)',
                    border: '1px solid var(--hairline)',
                  }}
                >
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function AuditRow({ e, index }: { e: AuditEvent; index: number }) {
  const a = actionStyle(e.action);
  const zebra = index % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent';
  return (
    <tr style={{ background: zebra }}>
      <td className="font-mono text-[11px] whitespace-nowrap" title={e.ts}>
        <span style={{ color: 'var(--ink-2)' }}>{relTime(e.ts)}</span>
        <div className="text-[10px]" style={{ color: 'var(--ink-dim)' }}>
          {formatIsoShort(e.ts)}
        </div>
      </td>
      <td className="font-mono text-[12px]" style={{ color: 'var(--ink-2)' }}>
        {e.actor}
      </td>
      <td>
        <span
          className="inline-flex items-center font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 rounded"
          style={{
            background: a.bg,
            color: a.fg,
            border: `1px solid ${a.border}`,
            letterSpacing: '0.06em',
          }}
        >
          {e.action}
        </span>
      </td>
      <td className="font-mono text-[12px]" style={{ color: 'var(--ink-2)' }}>
        {e.target}
      </td>
      <td>
        <span
          className="font-mono text-[10px] px-1.5 py-0.5 rounded"
          style={{
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--ink-muted)',
            border: '1px solid var(--hairline)',
          }}
        >
          {e.demo}
        </span>
      </td>
      <td>
        <span className={e.outcome === 'ok' ? 'pill pill-ok' : 'pill pill-bad'}>
          <span className="dot" />
          {e.outcome}
        </span>
      </td>
      <td
        className="text-[12px] max-w-[360px] truncate"
        title={e.detail}
        style={{ color: 'var(--ink-muted)' }}
      >
        {e.detail}
      </td>
    </tr>
  );
}
