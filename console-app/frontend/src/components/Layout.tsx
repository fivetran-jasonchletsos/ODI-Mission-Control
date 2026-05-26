import { NavLink, Outlet, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, getSnapshotTime, relTime } from '../api/queries';

const NAV: { to: string; label: string }[] = [
  { to: '/',           label: 'Overview' },
  { to: '/portfolio',  label: 'Portfolio' },
  { to: '/quality',    label: 'Data Quality' },
  { to: '/lineage',    label: 'Lineage' },
  { to: '/pipelines',  label: 'Pipelines' },
  { to: '/governance', label: 'Governance' },
  { to: '/cost',       label: 'Cost' },
  { to: '/alerts',     label: 'Alerts' },
  { to: '/traffic',    label: 'Usage' },
];

export default function Layout() {
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<number>(0);

  useEffect(() => {
    api.getSummary().then((s) => {
      setSnapshotAt(getSnapshotTime() ?? s.generated_at);
      setActiveAlerts(s.active_alerts);
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top chrome */}
      <header
        className="sticky top-0 z-30"
        style={{
          background: 'rgba(7,9,13,0.94)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(0,212,245,0.12)',
          boxShadow: '0 1px 24px rgba(0,0,0,0.6)',
        }}
      >
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <span
              className="inline-flex w-8 h-8 rounded-sm items-center justify-center font-black text-sm"
              style={{
                background: 'linear-gradient(135deg, #0d1018 0%, #101620 100%)',
                color: 'var(--info)',
                border: '1px solid rgba(0,212,245,0.35)',
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.05em',
                boxShadow: '0 0 12px rgba(0,212,245,0.12)',
              }}
              aria-hidden="true"
            >
              MC
            </span>
            <div className="flex flex-col leading-tight">
              <span
                className="text-[14px] font-bold tracking-wide"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em', color: 'var(--ink)' }}
              >
                ODI MISSION CONTROL
              </span>
              <span className="text-[9px] uppercase tracking-[0.22em]" style={{ color: 'var(--ink-dim)', fontFamily: 'var(--font-display)' }}>
                Governance · Observability
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 ml-2">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                {item.label}
                {item.to === '/alerts' && activeAlerts > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold"
                        style={{ background: 'var(--bad)', color: '#000' }}>
                    {activeAlerts}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-[11px] font-mono" style={{ color: 'var(--ink-dim)' }}>
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <span className="dot pulse" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)' }} />
              SNAPSHOT {snapshotAt ? relTime(snapshotAt) : '—'}
            </span>
            <a
              href="https://fivetran-jasonchletsos.github.io/tax-assessment-databricks-demo/"
              target="_blank" rel="noopener noreferrer"
              className="px-2.5 py-1 rounded border"
              style={{ borderColor: 'var(--hairline-2)', color: 'var(--ink-2)' }}
            >
              ← Back to Portfolio
            </a>
          </div>
        </div>

        {/* Mobile nav scroller */}
        <nav className="md:hidden overflow-x-auto px-4 pb-2 -mt-1 flex gap-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-link shrink-0 ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-auto" style={{ borderTop: '1px solid rgba(0,212,245,0.10)' }}>
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
             style={{ color: 'var(--ink-dim)' }}>
          <span className="text-[11px] font-mono">Fivetran ODI · governance + observability · 8 industry demos</span>
          <span className="text-[10px] uppercase tracking-[0.16em]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-dim)' }}>v1 · daily refresh</span>
        </div>
      </footer>
    </div>
  );
}
