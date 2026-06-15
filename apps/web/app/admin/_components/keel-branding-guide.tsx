const swatches = [
  { name: 'Canvas', token: '--workspace-shell-canvas', value: '#0B132B' },
  { name: 'Panel', token: '--workspace-shell-panel', value: '#0F1B35' },
  { name: 'Panel hover', token: '--workspace-shell-panel-hover', value: '#152544' },
  { name: 'Teal', token: '--keel-teal', value: '#2A9D8F' },
  { name: 'Accent blue', token: '--keel-accent-blue', value: '#2563EB' },
  { name: 'Gradient from', token: '--keel-gradient-from', value: '#152544' },
  { name: 'Gradient to', token: '--keel-gradient-to', value: '#18352F' },
];

const logos = [
  { label: 'Dark sidebar', path: '/brand/keel-logo-dark.png' },
  { label: 'Light surface', path: '/brand/keel-logo-light.png' },
  { label: 'Icon', path: '/brand/keel-logo-icon.png' },
];

export function KeelBrandingGuide() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Typography</h2>
        <div className="rounded-xl border p-6">
          <p className="font-sans text-sm text-muted-foreground">Font family</p>
          <p className="mt-1 text-2xl font-bold">Inter</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <p className="text-base font-normal">Body 400</p>
            <p className="text-base font-medium">Navigation 500</p>
            <p className="text-base font-bold">Headings 700</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Colours</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {swatches.map((swatch) => (
            <div key={swatch.token} className="overflow-hidden rounded-xl border">
              <div
                className="h-20"
                style={{ backgroundColor: swatch.value }}
                aria-hidden
              />
              <div className="space-y-1 p-4 text-sm">
                <p className="font-medium">{swatch.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {swatch.value}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {swatch.token}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Logos</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {logos.map((logo) => (
            <div
              key={logo.path}
              className="flex flex-col items-center gap-3 rounded-xl border p-6"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo.path} alt={logo.label} className="h-12 w-auto" />
              <p className="text-sm font-medium">{logo.label}</p>
              <p className="font-mono text-xs text-muted-foreground">{logo.path}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Components</h2>
        <div className="rounded-xl border p-6">
          <p className="text-sm text-muted-foreground">
            Primary actions use <code className="text-xs">keel-gradient-btn</code>{' '}
            or solid teal <code className="text-xs">#2A9D8F</code>. Focus states
            use a subtle teal border — not default browser blue rings.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="keel-gradient-btn h-10 rounded-lg px-4 text-sm font-semibold text-white"
            >
              Primary
            </button>
            <button
              type="button"
              className="h-10 rounded-lg border border-white/10 bg-[var(--workspace-shell-panel)] px-4 text-sm text-white"
            >
              Secondary
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
