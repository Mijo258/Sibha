/**
 * Fixed ambient backdrop: a night-sky wash plus a tiling girih lattice.
 * Purely decorative, so it is hidden from assistive tech and never
 * intercepts pointer events.
 */
export function GeometricBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      {/* Base wash — emerald low, gold glow high. */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_-10%,color-mix(in_oklch,var(--gold),transparent_88%),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(100%_70%_at_15%_105%,color-mix(in_oklch,var(--primary),transparent_86%),transparent_65%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_88%_92%,color-mix(in_oklch,var(--gold),transparent_92%),transparent_60%)]" />

      {/* Lattice: ink strokes in light mode, moonlight strokes in dark. */}
      <div className="pattern-islamic-ink animate-drift absolute inset-0 opacity-[0.055] dark:hidden" />
      <div className="pattern-islamic animate-drift absolute inset-0 hidden opacity-[0.045] dark:block" />

      {/* Vignette so the lattice recedes at the edges. */}
      <div className="absolute inset-0 bg-[radial-gradient(75%_60%_at_50%_45%,transparent,var(--background)_105%)]" />
    </div>
  );
}
