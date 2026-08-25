// Viewport-accurate screenshots: desktop dark, desktop light, mobile.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9334;
const BASE = "http://localhost:3000";

const edge = spawn(EDGE, [
  "--headless=new",
  "--disable-gpu",
  "--mute-audio",
  "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + process.cwd() + "\\.tmp\\edge-shots",
  "--no-first-run",
  "--window-size=1440,900",
  "about:blank",
]);
edge.stderr.on("data", () => {});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 60; i++) {
  await sleep(500);
  try {
    targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    if (targets.find((t) => t.type === "page")) break;
  } catch {}
}
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let seq = 0;
const pending = new Map();
ws.onmessage = (raw) => {
  const m = JSON.parse(raw.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, (m) => resolve(m.result ?? {}));
    ws.send(JSON.stringify({ id, method, params }));
  });

const evaluate = (expression) =>
  send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })
    .then((r) => r.result?.value);

async function metrics(width, height, mobile = false) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
}

async function shot(file) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  if (r.data) writeFileSync(file, Buffer.from(r.data, "base64"));
  console.log("wrote", file);
}

await send("Page.enable");
await send("Runtime.enable");

async function goto(url) {
  await send("Page.navigate", { url });
  await sleep(4200);
}

const setTheme = (t) =>
  evaluate(`(() => { localStorage.setItem('noor-theme', '${t}');
    document.documentElement.classList.toggle('dark', ${t === "dark"}); })()`);

/* Desktop light — landing, scrolled to the tasbeeh. */
await metrics(1440, 900);
await goto(`${BASE}/`);
await setTheme("light");
await sleep(400);
await evaluate(
  `document.getElementById('tasbeeh').scrollIntoView({ block: 'center' })`
);
await sleep(1200);
await shot(".tmp/s-tasbeeh-light.png");

/* Desktop light — Qur'an page, viewport only so sticky bits sit correctly. */
await goto(`${BASE}/quran`);
await sleep(3000);
await evaluate(`window.scrollTo(0, 260)`);
await sleep(900);
await shot(".tmp/s-quran-light.png");

/* Mobile dark — landing at the orb. */
await metrics(390, 844, true);
await goto(`${BASE}/`);
await setTheme("dark");
await sleep(500);
await evaluate(
  `document.querySelector('[aria-label^="Count"]').scrollIntoView({ block: 'center' })`
);
await sleep(1200);
await shot(".tmp/s-tasbeeh-mobile.png");

/* Mobile dark — Qur'an. */
await goto(`${BASE}/quran`);
await sleep(3200);
await evaluate(`window.scrollTo(0, 420)`);
await sleep(900);
await shot(".tmp/s-quran-mobile.png");

/* Overflow audit at 390px: anything wider than the viewport? */
const overflow = await evaluate(`(() => {
  const bad = [];
  const vw = document.documentElement.clientWidth;
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
      bad.push(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
        ? '.' + el.className.split(' ').slice(0, 2).join('.') : '')
        + ' [' + Math.round(r.left) + '→' + Math.round(r.right) + ']');
    }
  }
  return { vw, scrollW: document.documentElement.scrollWidth, bad: bad.slice(0, 12) };
})()`);
console.log("overflow audit:", JSON.stringify(overflow, null, 2));

ws.close();
edge.kill();
process.exit(0);
