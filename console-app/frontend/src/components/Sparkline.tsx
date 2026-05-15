// Shared inline-SVG sparkline. No external deps; dark-theme friendly.

interface Props {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: boolean;
  ariaLabel?: string;
}

export default function Sparkline({
  values,
  width = 96,
  height = 26,
  stroke = '#22d3ee',
  fill = true,
  ariaLabel,
}: Props) {
  if (!values || values.length < 2) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <line x1={2} x2={width - 2} y1={height / 2} y2={height / 2}
              stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="3 3" />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * w;
    const y = pad + h - ((v - min) / span) * h;
    return [x, y] as const;
  });
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const fillPath = fill
    ? `${path} L${pts[pts.length - 1][0].toFixed(1)} ${(height - pad).toFixed(1)} L${pts[0][0].toFixed(1)} ${(height - pad).toFixed(1)} Z`
    : '';
  const last = pts[pts.length - 1];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? 'trend sparkline'}
      className="overflow-visible"
    >
      {fill && <path d={fillPath} fill={stroke} opacity={0.10} />}
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={1.8} fill={stroke} />
    </svg>
  );
}
