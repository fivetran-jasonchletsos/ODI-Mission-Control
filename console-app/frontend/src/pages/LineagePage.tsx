import { useEffect, useMemo, useState } from 'react';
import { api, formatCompact, formatNumber } from '../api/queries';
import type { DemoKey, LineageEdge, LineageNode, PIITier } from '../types';

// ============================================================
// Demo metadata
// ============================================================
const DEMO_META: Record<DemoKey, { name: string; industry: string }> = {
  'tax-assessment': { name: 'Tax Assessment', industry: 'Public Sector' },
  healthcare:       { name: 'Healthcare',     industry: 'Health & Life Sciences' },
  finserv:          { name: 'FinServ',        industry: 'Financial Services' },
  media:            { name: 'Media',          industry: 'Media & Ent.' },
  retail:           { name: 'Retail',         industry: 'Retail & CPG' },
  techsaas:         { name: 'Tech / SaaS',    industry: 'Technology' },
  supplychain:      { name: 'Supply Chain',   industry: 'Manufacturing' },
  lifesci:          { name: 'Life Sciences',  industry: 'Pharma & Biotech' },
};

const ALL_DEMOS: DemoKey[] = [
  'tax-assessment', 'healthcare', 'finserv', 'media',
  'retail', 'techsaas', 'supplychain', 'lifesci',
];

type Layer = LineageNode['layer'];
const LAYER_ORDER: Layer[] = ['source', 'bronze', 'silver', 'gold', 'mart', 'app'];

const LAYER_COLORS: Record<Layer, { fill: string; border: string; tag: string }> = {
  source: { fill: '#1e293b',                  border: '#475569', tag: '#94a3b8' },
  bronze: { fill: 'rgba(180,83,9,0.18)',      border: '#b45309', tag: '#f59e0b' },
  silver: { fill: 'rgba(148,163,184,0.16)',   border: '#94a3b8', tag: '#cbd5e1' },
  gold:   { fill: 'rgba(251,191,36,0.14)',    border: '#d97706', tag: '#fbbf24' },
  mart:   { fill: 'rgba(34,211,238,0.14)',    border: '#0e7490', tag: '#22d3ee' },
  app:    { fill: 'rgba(167,139,250,0.16)',   border: '#7c3aed', tag: '#a78bfa' },
};

const PII_COLOR: Record<PIITier, string> = {
  PII:      '#ef4444',
  PHI:      '#fb7185',
  PCI:      '#f59e0b',
  internal: '#94a3b8',
  public:   '#22c55e',
  'FedRAMP-PII':   '#8b5cf6',
  'FERPA':         '#22d3ee',
  'ITAR/DFARS':    '#ef4444',
  'OT-restricted': '#f97316',
};
const piiColor = (t: PIITier): string => PII_COLOR[t] ?? '#94a3b8';

// ---- node display ----
const NODE_W = 140;
const NODE_H = 70;
const COL_GAP = 220;
const ROW_GAP = 18;
const PAD_X = 40;
const PAD_Y = 30;

function shortName(id: string): string {
  const parts = id.split('.');
  if (parts.length >= 3) return parts.slice(2).join('.');
  if (parts.length === 2) return parts[1];
  return id;
}

// ============================================================
// Page
// ============================================================
export default function LineagePage() {
  const [nodes, setNodes] = useState<LineageNode[]>([]);
  const [edges, setEdges] = useState<LineageEdge[]>([]);
  const [demo, setDemo]   = useState<DemoKey>('tax-assessment');
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let alive = true;
    api.getLineage().then((d) => {
      if (!alive) return;
      setNodes(d.nodes);
      setEdges(d.edges);
    }).catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => { setSelected(null); }, [demo]);

  const demoNodes = useMemo(() => nodes.filter((n) => n.demo === demo), [nodes, demo]);
  const nodeIds   = useMemo(() => new Set(demoNodes.map((n) => n.id)), [demoNodes]);
  const demoEdges = useMemo(
    () => edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to)),
    [edges, nodeIds],
  );

  const layerCols = useMemo(() => {
    const cols: Record<Layer, LineageNode[]> = {
      source: [], bronze: [], silver: [], gold: [], mart: [], app: [],
    };
    for (const n of demoNodes) cols[n.layer].push(n);
    for (const k of LAYER_ORDER) cols[k].sort((a, b) => a.id.localeCompare(b.id));
    return cols;
  }, [demoNodes]);

  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    LAYER_ORDER.forEach((layer, colIdx) => {
      const list = layerCols[layer];
      list.forEach((n, rowIdx) => {
        pos[n.id] = {
          x: PAD_X + colIdx * COL_GAP,
          y: PAD_Y + rowIdx * (NODE_H + ROW_GAP),
        };
      });
    });
    return pos;
  }, [layerCols]);

  const svgWidth  = PAD_X * 2 + (LAYER_ORDER.length - 1) * COL_GAP + NODE_W;
  const maxRows   = Math.max(1, ...LAYER_ORDER.map((l) => layerCols[l].length));
  const svgHeight = PAD_Y * 2 + maxRows * (NODE_H + ROW_GAP);

  const selectedNode = useMemo(
    () => demoNodes.find((n) => n.id === selected) ?? null,
    [demoNodes, selected],
  );
  const incoming = useMemo(
    () => selectedNode ? demoEdges.filter((e) => e.to === selectedNode.id) : [],
    [demoEdges, selectedNode],
  );
  const outgoing = useMemo(
    () => selectedNode ? demoEdges.filter((e) => e.from === selectedNode.id) : [],
    [demoEdges, selectedNode],
  );

  const sensitiveNodes = useMemo(
    () => demoNodes.filter((n) => n.pii_tier === 'PII' || n.pii_tier === 'PHI' || n.pii_tier === 'PCI'),
    [demoNodes],
  );
  const sensitiveInApp = useMemo(
    () => sensitiveNodes.filter((n) => n.layer === 'app').length,
    [sensitiveNodes],
  );

  return (
    <div className="mc-page mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6">
      {/* ---------- Header ---------- */}
      <header className="mb-5">
        <div className="eyebrow">Lineage explorer</div>
        <h1 className="text-2xl font-bold tracking-tight mt-1" style={{ color: 'var(--ink)' }}>
          Lineage
          <span className="ml-2 font-mono text-sm" style={{ color: 'var(--ink-muted)' }}>
            · sources to apps across the warehouse
          </span>
        </h1>
      </header>

      {/* ---------- Demo selector ---------- */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {ALL_DEMOS.map((k) => {
          const active = k === demo;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setDemo(k)}
              className="px-3 py-1.5 rounded-full text-[12px] font-mono border transition-colors"
              style={{
                borderColor: active ? 'var(--info)' : 'var(--hairline-2)',
                color: active ? 'var(--info)' : 'var(--ink-muted)',
                background: active ? 'rgba(34,211,238,0.08)' : 'transparent',
              }}
            >
              {DEMO_META[k].name}
            </button>
          );
        })}
      </div>

      {/* ---------- DAG + side panel ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <section className="panel">
          <div className="panel-head">
            <div className="panel-title">
              {DEMO_META[demo].name} · DAG
            </div>
            <div className="panel-sub">
              {demoNodes.length} nodes · {demoEdges.length} edges
            </div>
          </div>

          {/* Layer header strip */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${LAYER_ORDER.length}, minmax(0,1fr))`,
              borderBottom: '1px solid var(--hairline)',
            }}
          >
            {LAYER_ORDER.map((l, i) => {
              // dbt labs powers the bronze→silver and silver→gold transformations.
              const showDbtBadge =
                (l === 'silver' && LAYER_ORDER[i - 1] === 'bronze') ||
                (l === 'gold' && LAYER_ORDER[i - 1] === 'silver');
              return (
                <div
                  key={l}
                  className="relative px-3 py-2 text-[10px] font-mono uppercase tracking-widest"
                  style={{ color: LAYER_COLORS[l].tag, borderRight: '1px solid var(--hairline)' }}
                >
                  {l}
                  {showDbtBadge && (
                    <span
                      className="absolute -top-2 -left-3 px-1.5 py-0.5 rounded-sm text-[8px] font-extrabold tracking-[0.5px]"
                      style={{
                        background: '#FF694A',
                        color: '#ffffff',
                        border: '1px solid #FF694A',
                        zIndex: 2,
                      }}
                    >
                      dbt labs
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto" style={{ background: 'var(--bg)' }}>
            {loading ? (
              <div className="text-center font-mono text-[11px] py-10"
                   style={{ color: 'var(--ink-dim)' }}>
                LOADING LINEAGE…
              </div>
            ) : demoNodes.length === 0 ? (
              <div className="text-center font-mono text-[11px] py-10"
                   style={{ color: 'var(--ink-dim)' }}>
                NO LINEAGE FOR {DEMO_META[demo].name.toUpperCase()}
              </div>
            ) : (
              <svg
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                role="img"
                aria-label={`Lineage DAG for ${DEMO_META[demo].name}`}
                style={{ display: 'block' }}
              >
                {/* Column guides */}
                {LAYER_ORDER.map((_, i) => {
                  const x = PAD_X + i * COL_GAP + NODE_W / 2;
                  return (
                    <line
                      key={i}
                      x1={x} x2={x} y1={0} y2={svgHeight}
                      stroke="rgba(255,255,255,0.025)"
                      strokeWidth={1}
                    />
                  );
                })}

                {/* Edges (curved bezier) */}
                {demoEdges.map((e, i) => {
                  const a = positions[e.from];
                  const b = positions[e.to];
                  if (!a || !b) return null;
                  const x1 = a.x + NODE_W;
                  const y1 = a.y + NODE_H / 2;
                  const x2 = b.x;
                  const y2 = b.y + NODE_H / 2;
                  const mx = (x1 + x2) / 2;
                  const path = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
                  const isActive =
                    selected !== null && (e.from === selected || e.to === selected);
                  return (
                    <path
                      key={`${e.from}->${e.to}-${i}`}
                      d={path}
                      fill="none"
                      stroke={isActive ? '#22d3ee' : 'rgba(148,163,184,0.35)'}
                      strokeWidth={isActive ? 1.6 : 1}
                      strokeOpacity={isActive ? 0.95 : 0.7}
                    />
                  );
                })}

                {/* Nodes */}
                {demoNodes.map((n) => {
                  const p = positions[n.id];
                  if (!p) return null;
                  const c = LAYER_COLORS[n.layer];
                  const isSel = selected === n.id;
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${p.x},${p.y})`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelected(isSel ? null : n.id)}
                    >
                      <rect
                        x={0} y={0}
                        width={NODE_W} height={NODE_H}
                        rx={6} ry={6}
                        fill={c.fill}
                        stroke={isSel ? '#22d3ee' : c.border}
                        strokeWidth={isSel ? 1.6 : 1}
                      />
                      <text
                        x={10} y={20}
                        fontSize={11}
                        fontFamily="ui-monospace, SF Mono, Menlo, monospace"
                        fill="#f3f4f6"
                      >
                        {truncate(shortName(n.id), 18)}
                      </text>
                      <text
                        x={10} y={38}
                        fontSize={10}
                        fontFamily="ui-monospace, SF Mono, Menlo, monospace"
                        fill="#94a3b8"
                      >
                        {formatCompact(n.rows)} rows
                      </text>
                      {/* PII tier badge */}
                      <g transform="translate(10, 48)">
                        <rect
                          x={0} y={0}
                          width={tierBadgeWidth(n.pii_tier)} height={14}
                          rx={3} ry={3}
                          fill={`${piiColor(n.pii_tier)}26`}
                          stroke={`${piiColor(n.pii_tier)}66`}
                          strokeWidth={1}
                        />
                        <text
                          x={6} y={10}
                          fontSize={9}
                          fontFamily="ui-monospace, SF Mono, Menlo, monospace"
                          fill={piiColor(n.pii_tier)}
                          letterSpacing={0.5}
                        >
                          {n.pii_tier.toUpperCase()}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </section>

        {/* ---------- Side panel ---------- */}
        <aside className="panel" style={{ alignSelf: 'start', position: 'sticky', top: 70 }}>
          <div className="panel-head">
            <div className="panel-title">Node detail</div>
            {selectedNode && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-[11px] font-mono"
                style={{ color: 'var(--ink-dim)' }}
              >
                Clear ×
              </button>
            )}
          </div>
          <div className="p-4">
            {!selectedNode ? (
              <div className="text-[12px] font-mono" style={{ color: 'var(--ink-dim)' }}>
                Click a node in the DAG to inspect its lineage edges.
              </div>
            ) : (
              <div className="space-y-3 text-[12px]">
                <div>
                  <div className="eyebrow mb-1">Table</div>
                  <div className="font-mono break-all" style={{ color: 'var(--ink)' }}>
                    {shortName(selectedNode.id)}
                  </div>
                  <div className="font-mono text-[10px] mt-0.5 break-all" style={{ color: 'var(--ink-dim)' }}>
                    {selectedNode.id}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Layer"
                        value={selectedNode.layer}
                        color={LAYER_COLORS[selectedNode.layer].tag} />
                  <Stat label="Rows" value={formatNumber(selectedNode.rows)} />
                  <Stat label="PII"
                        value={selectedNode.pii_tier}
                        color={piiColor(selectedNode.pii_tier)} />
                </div>
                <EdgeList title={`Incoming · ${incoming.length}`} edges={incoming} side="from" />
                <EdgeList title={`Outgoing · ${outgoing.length}`} edges={outgoing} side="to" />
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ---------- PII flow callout ---------- */}
      <section
        className="mt-5 rounded-md p-4 flex flex-col sm:flex-row sm:items-center gap-3"
        style={{
          background: sensitiveInApp > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.06)',
          border: `1px solid ${sensitiveInApp > 0 ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.3)'}`,
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-flex w-9 h-9 rounded items-center justify-center font-mono font-bold"
            style={{
              background: sensitiveInApp > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.16)',
              color: sensitiveInApp > 0 ? 'var(--bad)' : 'var(--ok)',
              border: '1px solid var(--hairline-2)',
            }}
            aria-hidden="true"
          >
            {sensitiveInApp > 0 ? '!' : 'OK'}
          </span>
          <div>
            <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
              PII / PHI / PCI flow
            </div>
            <div className="text-[11px] font-mono" style={{ color: 'var(--ink-muted)' }}>
              {sensitiveNodes.length} sensitive node{sensitiveNodes.length === 1 ? '' : 's'} in {DEMO_META[demo].name}
              {' · '}
              {sensitiveInApp > 0
                ? `${sensitiveInApp} reach the app layer — confirm masking, RBAC, and row-level policies.`
                : 'no sensitive data exposed at the app layer.'}
            </div>
          </div>
        </div>
        <div className="sm:ml-auto flex flex-wrap gap-1.5">
          {(['PII', 'PHI', 'PCI'] as PIITier[]).map((tier) => {
            const n = sensitiveNodes.filter((s) => s.pii_tier === tier).length;
            if (n === 0) return null;
            return (
              <span
                key={tier}
                className="px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider"
                style={{
                  color: piiColor(tier),
                  background: `${piiColor(tier)}1f`,
                  border: `1px solid ${piiColor(tier)}55`,
                }}
              >
                {tier} · {n}
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================
function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function tierBadgeWidth(tier: PIITier): number {
  if (tier === 'internal') return 56;
  if (tier === 'public')   return 46;
  return 32;
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-widest"
           style={{ color: 'var(--ink-dim)' }}>
        {label}
      </div>
      <div className="font-mono text-[12px]" style={{ color: color ?? 'var(--ink-2)' }}>
        {value}
      </div>
    </div>
  );
}

function EdgeList({
  title, edges, side,
}: { title: string; edges: LineageEdge[]; side: 'from' | 'to' }) {
  return (
    <div>
      <div className="eyebrow mb-1">{title}</div>
      {edges.length === 0 ? (
        <div className="text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
          (none)
        </div>
      ) : (
        <ul className="space-y-1.5">
          {edges.map((e, i) => {
            const rawId = side === 'from' ? e.from : e.to;
            return (
              <li
                key={`${e.from}->${e.to}-${i}`}
                className="rounded px-2 py-1.5"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--hairline)' }}
              >
                <div className="font-mono text-[11px] break-all" style={{ color: 'var(--ink-2)' }}>
                  {shortName(rawId)}
                </div>
                <div className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--ink-dim)' }}>
                  {e.transform}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
