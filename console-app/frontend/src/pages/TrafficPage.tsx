import { useEffect, useState } from 'react';

type ViewPoint = { timestamp: string; count: number; uniques: number };
type Views14d  = { count: number; uniques: number; views: ViewPoint[] };
type PopularPath = { path: string; title: string; count: number; uniques: number };
type Referrer = { referrer: string; count: number; uniques: number };
type DemoTraffic = {
  repo: string;
  views_14d: Views14d;
  popular_paths: PopularPath[];
  top_referrers: Referrer[];
};
type Snapshot = {
  fetched_at: string;
  owner: string;
  demos: DemoTraffic[];
};

const DEMO_LABELS: Record<string, string> = {
  'tax-assessment-databricks-demo': 'Allegheny County Tax',
  'FinServ-ODI-Demo':               'Meridian Capital',
  'Insurance-ODI-Demo':             'Atlas Risk',
  'Media-ODI-Demo':                 'Lighthouse Media',
  'RetailEcom-ODI-Demo':            'Storefront',
  'TechSaaS-ODI-Demo':              'SaaS Pulse',
  'SupplyChain-ODI-Demo':           'Manifest',
  'LifeSci-ODI-Demo':               'Cohort',
  'ODI-Mission-Control':            'Mission Control',
  'What_Is_ODI_Demo':               'Helio Commerce (What is ODI)',
  'SAP-ODI-Demo':                   'Keystone (SAP ODI)',
  'LinerNotes-ODI-Demo':            'Liner Notes',
  'Peters-Must-See-Movies':         "Pete's Must-See Movies",
};

const base = (import.meta as any).env?.BASE_URL || './';

export default function TrafficPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${base}data/github_traffic.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: Snapshot) => setSnap(d))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: 'var(--accent)' }}>
          Traffic — GitHub Pages
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
          Who is using which demos and which pages.
        </h1>
        <p className="mt-3 max-w-3xl leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          Live traffic from the GitHub Pages traffic API — 14-day rolling window.
          For each demo: total views, uniques, and the most-visited paths within
          the app. Updated daily by a workflow in this repo.
        </p>
      </div>

      {error && (
        <div
          className="p-5 rounded-md font-mono text-xs"
          style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)', color: 'var(--ink)' }}
        >
          <div className="mb-2 font-semibold uppercase tracking-wider text-amber-400">No live snapshot yet</div>
          <p className="text-[var(--ink-muted)] mb-2 leading-relaxed">
            github_traffic.json hasn't been published yet. To enable live data:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[var(--ink-muted)]">
            <li>Create a GitHub PAT with "Administration: Read" on each demo repo.</li>
            <li>Add it as repo secret <code>TRAFFIC_PAT</code> on this repo.</li>
            <li>Manually trigger the <code>Fetch GitHub traffic stats</code> workflow under Actions.</li>
          </ol>
          <p className="text-xs mt-2" style={{ color: 'var(--ink-dim)' }}>
            Error: {error}
          </p>
        </div>
      )}

      {snap && (
        <>
          <div className="mb-6 text-xs font-mono" style={{ color: 'var(--ink-dim)' }}>
            Snapshot at {new Date(snap.fetched_at).toLocaleString()} · owner: {snap.owner}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-10">
            {snap.demos
              .slice()
              .sort((a, b) => (b.views_14d?.count ?? 0) - (a.views_14d?.count ?? 0))
              .map((d) => (
                <div key={d.repo} className="border rounded-md p-4" style={{ borderColor: 'var(--hairline)', background: 'var(--card)' }}>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-muted)' }}>
                    {DEMO_LABELS[d.repo] ?? d.repo}
                  </div>
                  <div className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
                    {d.views_14d?.count?.toLocaleString() ?? '0'}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--ink-dim)' }}>
                    14-day views · {d.views_14d?.uniques?.toLocaleString() ?? '0'} unique
                  </div>
                </div>
              ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {snap.demos
              .filter((d) => (d.popular_paths?.length ?? 0) > 0)
              .sort((a, b) => (b.views_14d?.count ?? 0) - (a.views_14d?.count ?? 0))
              .map((d) => (
                <div key={d.repo} className="border rounded-md" style={{ borderColor: 'var(--hairline)', background: 'var(--card)' }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--hairline)' }}>
                    <div className="font-semibold" style={{ color: 'var(--ink)' }}>{DEMO_LABELS[d.repo] ?? d.repo}</div>
                    <div className="text-xs" style={{ color: 'var(--ink-dim)' }}>Most-visited paths · 14d</div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>
                        <th className="py-2 px-4">Path</th>
                        <th className="py-2 px-4 text-right">Views</th>
                        <th className="py-2 px-4 text-right">Uniques</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.popular_paths.slice(0, 10).map((p, i) => (
                        <tr key={i} className="border-t" style={{ borderColor: 'var(--hairline-soft)' }}>
                          <td className="py-1.5 px-4 font-mono text-xs" style={{ color: 'var(--ink)' }}>
                            {p.path}
                          </td>
                          <td className="py-1.5 px-4 text-right" style={{ color: 'var(--ink-muted)' }}>
                            {p.count.toLocaleString()}
                          </td>
                          <td className="py-1.5 px-4 text-right" style={{ color: 'var(--ink-muted)' }}>
                            {p.uniques.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
