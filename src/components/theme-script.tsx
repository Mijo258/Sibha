/**
 * Applies the stored theme before first paint so the app never flashes
 * light-on-dark. Must run as a blocking inline script in <head>.
 */
export function ThemeScript() {
  const js = `
(function () {
  try {
    var stored = localStorage.getItem("noor-theme");
    // Night is the intended default — the palette is built for it.
    var dark = stored ? stored === "dark" : true;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`.trim();

  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
