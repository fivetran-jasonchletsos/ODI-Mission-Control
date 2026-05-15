import { useEffect, useMemo, useState } from 'react';
import { api, formatCurrency, formatNumber } from '../api/queries';
import Sparkline from '../components/Sparkline';
import type { CostBreakdown } from '../types';

// ============================================================
// CostPage — 30-day spend by demo, service, warehouse
// ============================================================

interface Anomaly {
  demo: string;
  multiplier: number;
}

export default function CostPage() {
  const [cost, setCost] = useState<CostBreakdown[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .getCost()
      .then((c) => setCost(c))
      .catch((e: unknown) => setErr(String(e)));
  }, []);

  // ---- Aggregates ----
  const totals = useMemo(() => {
    if (!cost) return { total: 0, compute: 0, storage: 0, egress: 0 };
    return cost.reduce(
      (acc, c) => ({
        total: acc.total + c.total_30d_usd,
        compute: acc.compute + c.compute_usd,
        storage: acc.storage + c.storage_usd,
        egress: acc.egress + c.egress_usd,
      }),
      { total: 0, compute: 0, storage: 0, egress: 0 },
    );
  }, [cost]);

  // ---- Spend trend (sum daily) ----
  const dailyTotals = useMemo(() => {
    if (!cost || cost.length === 0) return [] as number[];
    const len = Math.max(...cost.map((c) => c.trend_30d?.length ?? 0));
    const out: number[] = new Array(len).fill(0);
    cost.forEach((c) => {
      (c.trend_30d ?? []).forEach((v, i) => {
        out[i] = (out[i] ?? 0) + v;
      });
    });
    return out;
  }, [cost]);

  // ---- Sort demos by total desc ----
  const sortedDemos = useMemo(() => {
    if (!cost) return [];
    return [...cost].sort((a, b) => b.total_30d_usd - a.total_30d_usd);
  }, [cost]);

  const top3 = useMemo(
    () => new Set(sortedDemos.slice(0, 3).map((d) => d.demo)),
    [sortedDemos],
  );

  // ---- Anomalies (last day > 2x 30d avg) ----
  const anomalies = useMemo<Anomaly[]>(() => {
    if (!cost) return [];
    const out: Anomaly[] = [];
    cost.forEach((c) => {
      const t = c.trend_30d ?? [];
      if (t.length < 2) return;
      const last = t[t.length - 1];
      const avg = t.reduce((a, b) => a + b, 0) / t.length;
      if (avg > 0 && last > avg * 2) {
        out.push({ demo: c.demo, multiplier: last / avg });
      }
    });
    return out.sort((a, b) => b.multiplier - a.multiplier);
  }, [cost]);

  if (err) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6">
        <div className="panel p-6 font-mono text-sm" style={{ color: 'var(--bad)' }}>
          Failed to load cost data: {err}
        </div>
      </div>
    );
  }

  const loading = !cost;

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6">
      {/* Anomaly banners */}
      {anomalies.length > 0 && (
        <div className="mb-4 space-y-2">
          {anomalies.map((a) => (
            <div
              key={a.demo}
              className="flex items-center gap-3 px-4 py-2.5 rounded font-mono text-[13px]"
              style={{
                background: 'var(--warn-bg)',
                border: '1px solid rgba(245,158,11,0.35)',
                color: 'var(--warn)',
              }}
            >
              <span className="inline-flex items-center gap-1.5 font-bold tracking-wider text-[11px]">
                <span
                  className="dot pulse"
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--warn)',
                  }}
                />
                ANOMALY
              </span>
              <span>
                <span className="font-bold">{a.demo}</span> spend spiked{' '}
                <span className="font-bold">{a.multiplier.toFixed(1)}x</span> today vs. 30d avg.
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <div className="eyebrow">Cost</div>
        <h1 className="mt-1 text-[22px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          Cost · 30-day spend by demo, service, warehouse
        </h1>
        <p className="mt-1 text-[12px] font-mono" style={{ color: 'var(--ink-dim)' }}>
          {loading
            ? 'Loading…'
            : `${cost!.length} demos · ${formatCurrency(totals.total)} trailing 30d`}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi label="Total 30d" value={formatCurrency(totals.total)} hint="all demos" />
        <Kpi
          label="Compute"
          value={formatCurrency(totals.compute)}
          hint={`${pctOf(totals.compute, totals.total)} of total`}
          tone="info"
        />
        <Kpi
          label="Storage"
          value={formatCurrency(totals.storage)}
          hint={`${pctOf(totals.storage, totals.total)} of total`}
          tone="accent"
        />
        <Kpi
          label="Egress"
          value={formatCurrency(totals.egress)}
          hint={`${pctOf(totals.egress, totals.total)} of total`}
          tone="warn"
        />
      </div>

      {/* Spend trend */}
      <section className="mb-6">
        <div className="panel">
          <div className="panel-head">
            <div className="flex items-center gap-3">
              <span className="panel-title">Spend trend · last 30 days</span>
              <span className="panel-sub">total daily $</span>
            </div>
            <div className="text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
              peak: {formatCurrency(Math.max(...(dailyTotals.length ? dailyTotals : [0])))} · low:{' '}
              {formatCurrency(Math.min(...(dailyTotals.length ? dailyTotals : [0])))}
            </div>
          </div>
          <div className="p-4">
            <LineChart values={dailyTotals} height={220} />
          </div>
        </div>
      </section>

      {/* Demo cost table */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="eyebrow">Demo breakdown</div>
            <h2 className="text-[16px] font-semibold mt-0.5">By demo · 30d spend</h2>
          </div>
          <div className="text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
            sorted by total desc
          </div>
        </div>
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Demo</th>
                  <th className="text-right">Compute</th>
                  <th className="text-right">Storage</th>
                  <th className="text-right">Egress</th>
                  <th className="text-right">Fivetran MAR</th>
                  <th className="text-right">30d Total</th>
                  <th>30d trend</th>
                </tr>
              </thead>
              <tbody>
                {sortedDemos.map((c) => (
                  <tr key={c.demo}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px]" style={{ color: 'var(--ink)' }}>
                          {c.demo}
                        </span>
                        {top3.has(c.demo) && (
                          <span
                            className="font-mono text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                            style={{
                              background: 'rgba(251,191,36,0.15)',
                              color: 'var(--gold)',
                              border: '1px solid rgba(251,191,36,0.30)',
                            }}
                          >
                            TOP 3
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right font-mono tabular">
                      {formatCurrency(c.compute_usd)}
                    </td>
                    <td className="text-right font-mono tabular">
                      {formatCurrency(c.storage_usd)}
                    </td>
                    <td className="text-right font-mono tabular">
                      {formatCurrency(c.egress_usd)}
                    </td>
                    <td className="text-right font-mono tabular">
                      {formatNumber(c.fivetran_mar)}
                    </td>
                    <td
                      className="text-right font-mono tabular font-bold"
                      style={{ color: 'var(--ink)' }}
                    >
                      {formatCurrency(c.total_30d_usd)}
                    </td>
                    <td>
                      <Sparkline
                        values={c.trend_30d ?? []}
                        stroke="#22d3ee"
                        width={120}
                        height={26}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Service breakdown */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="eyebrow">Service mix</div>
            <h2 className="text-[16px] font-semibold mt-0.5">Compute · storage · egress</h2>
          </div>
          <Legend />
        </div>
        <div className="panel p-4 space-y-2.5">
          {sortedDemos.map((c) => {
            const total = c.compute_usd + c.storage_usd + c.egress_usd;
            const cp = total ? (c.compute_usd / total) * 100 : 0;
            const sp = total ? (c.storage_usd / total) * 100 : 0;
            const ep = total ? (c.egress_usd / total) * 100 : 0;
            return (
              <div key={c.demo} className="flex items-center gap-3">
                <div
                  className="w-28 shrink-0 font-mono text-[12px] truncate"
                  style={{ color: 'var(--ink-2)' }}
                  title={c.demo}
                >
                  {c.demo}
                </div>
                <div
                  className="flex-1 h-5 rounded overflow-hidden flex"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  <div
                    style={{ width: `${cp}%`, background: 'var(--info)' }}
                    title={`Compute ${formatCurrency(c.compute_usd)} (${cp.toFixed(1)}%)`}
                  />
                  <div
                    style={{ width: `${sp}%`, background: 'var(--accent)' }}
                    title={`Storage ${formatCurrency(c.storage_usd)} (${sp.toFixed(1)}%)`}
                  />
                  <div
                    style={{ width: `${ep}%`, background: 'var(--warn)' }}
                    title={`Egress ${formatCurrency(c.egress_usd)} (${ep.toFixed(1)}%)`}
                  />
                </div>
                <div
                  className="w-24 text-right font-mono tabular text-[12px]"
                  style={{ color: 'var(--ink-2)' }}
                >
                  {formatCurrency(total)}
                </div>
              </div>
            );
          })}
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
  tone?: 'info' | 'accent' | 'warn';
}) {
  const toneColor =
    tone === 'info'
      ? 'var(--info)'
      : tone === 'accent'
        ? 'var(--accent)'
        : tone === 'warn'
          ? 'var(--warn)'
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

function Legend() {
  const item = (color: string, label: string) => (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-mono"
      style={{ color: 'var(--ink-muted)' }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          background: color,
          borderRadius: 2,
        }}
      />
      {label}
    </span>
  );
  return (
    <div className="flex items-center gap-3">
      {item('var(--info)', 'Compute')}
      {item('var(--accent)', 'Storage')}
      {item('var(--warn)', 'Egress')}
    </div>
  );
}

function pctOf(part: number, total: number): string {
  if (!total) return '—';
  return `${((part / total) * 100).toFixed(0)}%`;
}

// ============================================================
// LineChart — SVG line chart with axes/gridlines, no deps.
// ============================================================

function LineChart({ values, height = 220 }: { values: number[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);

  if (!values || values.length < 2) {
    return (
      <div
        className="flex items-center justify-center font-mono text-[11px]"
        style={{ height, color: 'var(--ink-dim)' }}
      >
        not enough data
      </div>
    );
  }

  const width = 1100; // viewBox internal width; scales to container.
  const padL = 56;
  const padR = 16;
  const padT = 12;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const min = 0; // anchor at 0 for spend
  const max = Math.max(...values) * 1.08 || 1;
  const span = max - min || 1;

  const xFor = (i: number) => padL + (i / (values.length - 1)) * innerW;
  const yFor = (v: number) => padT + innerH - ((v - min) / span) * innerH;

  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`)
    .join(' ');

  const fillPath =
    `${path} L${xFor(values.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)}` +
    ` L${xFor(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const gridSteps = 4;
  const gridYs = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const v = min + (span * i) / gridSteps;
    return { v, y: yFor(v) };
  });

  const tickEvery = Math.max(1, Math.floor(values.length / 6));
  const xTicks = values
    .map((_, i) => i)
    .filter((i) => i % tickEvery === 0 || i === values.length - 1);

  const hoverIdx = hover !== null && hover >= 0 && hover < values.length ? hover : null;

  function handleMove(ev: React.MouseEvent<SVGSVGElement>) {
    const svg = ev.currentTarget;
    const rect = svg.getBoundingClientRect();
    const xVb = ((ev.clientX - rect.left) / rect.width) * width;
    if (xVb < padL || xVb > width - padR) {
      setHover(null);
      return;
    }
    const ratio = (xVb - padL) / innerW;
    const idx = Math.round(ratio * (values.length - 1));
    setHover(Math.max(0, Math.min(values.length - 1, idx)));
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      onMouseMove={handleMove}
      onMouseLeave={() => setHover(null)}
      role="img"
      aria-label="30-day spend trend"
    >
      {gridYs.map((g, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={width - padR}
            y1={g.y}
            y2={g.y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
          <text
            x={padL - 8}
            y={g.y + 3}
            textAnchor="end"
            fontFamily="ui-monospace, monospace"
            fontSize={10}
            fill="rgba(148,163,184,0.85)"
          >
            {formatCurrency(g.v)}
          </text>
        </g>
      ))}

      {xTicks.map((i) => (
        <text
          key={i}
          x={xFor(i)}
          y={height - 8}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize={10}
          fill="rgba(148,163,184,0.85)"
        >
          d-{values.length - 1 - i}
        </text>
      ))}

      <path d={fillPath} fill="var(--info)" opacity={0.12} />
      <path
        d={path}
        fill="none"
        stroke="var(--info)"
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {hoverIdx !== null && (
        <g>
          <line
            x1={xFor(hoverIdx)}
            x2={xFor(hoverIdx)}
            y1={padT}
            y2={padT + innerH}
            stroke="rgba(255,255,255,0.20)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <circle cx={xFor(hoverIdx)} cy={yFor(values[hoverIdx])} r={3.5} fill="var(--info)" />
          <rect
            x={Math.min(width - 130, Math.max(padL, xFor(hoverIdx) + 8))}
            y={Math.max(padT, yFor(values[hoverIdx]) - 28)}
            width={120}
            height={24}
            rx={3}
            fill="rgba(17,20,26,0.95)"
            stroke="var(--hairline-2)"
          />
          <text
            x={Math.min(width - 130, Math.max(padL, xFor(hoverIdx) + 8)) + 8}
            y={Math.max(padT, yFor(values[hoverIdx]) - 28) + 15}
            fontFamily="ui-monospace, monospace"
            fontSize={11}
            fill="var(--ink)"
          >
            d-{values.length - 1 - hoverIdx} · {formatCurrency(values[hoverIdx])}
          </text>
        </g>
      )}
    </svg>
  );
}
