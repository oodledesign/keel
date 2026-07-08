const swatches = [
  { name: 'Canvas', token: '--ozer-surface-canvas', value: '#351E28' },
  { name: 'Panel', token: '--ozer-surface-panel', value: '#2A1720' },
  { name: 'Panel hover', token: '--ozer-surface-panel-hover', value: '#3D2A33' },
  { name: 'Accent (coral)', token: '--ozer-accent', value: '#FF5C34' },
  { name: 'Accent hover', token: '--ozer-accent-hover', value: '#FF7A5C' },
  { name: 'Info', token: '--ozer-info', value: '#41606F' },
  { name: 'Text on dark', token: '--ozer-text-on-dark', value: '#FBF6EC' },
  { name: 'Active gradient from', token: '--ozer-gradient-active-from', value: '#C2452A' },
  { name: 'Active gradient to', token: '--ozer-gradient-active-to', value: '#FF5C34' },
];

const logos = [
  { label: 'Wordmark (light)', path: '/brand/ozer-wordmark-on-light.svg' },
  { label: 'Wordmark (dark)', path: '/brand/ozer-wordmark-on-dark.svg' },
  { label: 'Icon (flower mark)', path: '/brand/ozer-icon.svg' },
  { label: 'Brand guide (HTML)', path: '/brand/ozer-brand-guide.html' },
];

export function OzerBrandingGuide() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Typography</h2>
        <div className="rounded-xl border p-6">
          <p className="font-sans text-sm text-muted-foreground">Font families (Fontshare)</p>
          <p className="mt-1 font-heading text-2xl font-bold">Cabinet Grotesk — headings</p>
          <p className="mt-2 font-sans text-base">General Sans — body &amp; navigation</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <p className="text-base font-normal">Body 400</p>
            <p className="text-base font-medium">Navigation 500</p>
            <p className="font-heading text-base font-bold">Headings 700</p>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Edit <code className="text-xs">apps/web/styles/ozer-tokens.css</code> to change fonts
            or colours.
          </p>
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
                <p className="font-mono text-xs text-muted-foreground">{swatch.value}</p>
                <p className="font-mono text-xs text-muted-foreground">{swatch.token}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Logos &amp; reference</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {logos.map((logo) => (
            <div
              key={logo.path}
              className="flex flex-col items-center gap-3 rounded-xl border p-6"
            >
              {logo.path.endsWith('.html') ? (
                <a
                  href={logo.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline"
                >
                  Open brand guide
                </a>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo.path} alt={logo.label} className="h-12 w-auto" />
              )}
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
            Primary actions use <code className="text-xs">ozer-gradient-btn</code> (alias{' '}
            <code className="text-xs">ozer-gradient-btn</code>) or{' '}
            <code className="text-xs">workspace-btn-primary</code> (coral via{' '}
            <code className="text-xs">--ozer-accent</code>).
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="ozer-gradient-btn h-10 rounded-lg px-4 text-sm font-semibold text-white"
            >
              Primary
            </button>
            <button
              type="button"
              className="h-10 rounded-lg border border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 text-sm text-[var(--workspace-shell-text-on-dark)]"
            >
              Secondary
            </button>
            <button
              type="button"
              className="ozer-gradient-active h-10 rounded-lg px-4 text-sm font-semibold"
            >
              Active nav
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
