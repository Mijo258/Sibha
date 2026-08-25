// Minimal CDP driver — launches headless Edge, collects console/page errors,
// exercises the UI, and writes screenshots. No external deps.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
const BASE = "http://localhost:3000";

const edge = spawn(EDGE, [
  "--headless=new",
  "--disable-gpu",
  "--mute-audio",
  "--autoplay-policy=no-user-gesture-required",
  "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + process.cwd() + "\\.tmp\\edge-profile",
  "--no-first-run",
  "--window-size=1440,1000",
  "about:blank",
]);
edge.stderr.on("data", () => {});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wait for the debugging endpoint.
let targets;
for (let i = 0; i < 60; i++) {
  await sleep(500);
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    targets = await res.json();
    if (targets.find((t) => t.type === "page")) break;
  } catch {}
}

const page = targets.find((t) => t.type === "page");
if (!page) {
  console.error("could not attach to Edge");
  edge.kill();
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let seq = 0;
const pending = new Map();
const problems = [];
const events = [];

ws.onmessage = (raw) => {
  const msg = JSON.parse(raw.data);

  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
    return;
  }

  events.push(msg.method);

  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    problems.push(
      `EXCEPTION: ${d.exception?.description ?? d.text}`.split("\n")[0]
    );
  }
  if (msg.method === "Runtime.consoleAPICalled") {
    const { type, args } = msg.params;
    if (type === "error" || type === "warning") {
      const text = args
        .map((a) => a.value ?? a.description ?? a.type)
        .join(" ")
        .slice(0, 400);
      problems.push(`CONSOLE.${type.toUpperCase()}: ${text}`);
    }
  }
  if (msg.method === "Log.entryAdded") {
    const e = msg.params.entry;
    if (e.level === "error" || e.level === "warning") {
      problems.push(`LOG.${e.level.toUpperCase()}: ${e.text.slice(0, 300)}`);
    }
  }
};

function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, (m) =>
      resolve(m.error ? { error: m.error } : (m.result ?? {}))
    );
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    return { __error: r.exceptionDetails.exception?.description ?? "threw" };
  }
  return r.result?.value;
}

async function goto(url) {
  await send("Page.navigate", { url });
  await sleep(4500);
}

async function shot(file) {
  const r = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  if (r.data) writeFileSync(file, Buffer.from(r.data, "base64"));
}

await send("Runtime.enable");
await send("Page.enable");
await send("Log.enable");

const report = [];
const check = (label, ok, detail = "") =>
  report.push(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);

/* ─── Landing page ─────────────────────────────────────────────────────── */
await goto(`${BASE}/`);

const orbSel = '[aria-label^="Count"]';
const countExpr = `document.querySelector('${orbSel}').innerText.split('\\n')[0].trim()`;

check("landing page rendered", (await evaluate("document.title")) === "Noor — Tasbeeh & Qur'an");
check("orb present", await evaluate(`!!document.querySelector('${orbSel}')`));
check("initial count is 0", (await evaluate(countExpr)) === "0");

// Tap the orb 5 times.
await evaluate(
  `(async () => { const b = document.querySelector('${orbSel}');
    for (let i = 0; i < 5; i++) { b.click(); await new Promise(r => setTimeout(r, 90)); } })()`
);
await sleep(700);
check("count after 5 taps", (await evaluate(countExpr)) === "5", `got ${await evaluate(countExpr)}`);

const stored = await evaluate(`localStorage.getItem('noor-tasbeeh')`);
check("written to localStorage", !!stored && JSON.parse(stored).counts?.subhanallah === 5, String(stored).slice(0, 120));

// Ring should have advanced (5/33).
const dashNow = await evaluate(
  `getComputedStyle(document.querySelector('svg circle:nth-of-type(2)')).strokeDashoffset`
);
check("progress ring advanced", parseFloat(dashNow) > 0, `dashoffset ${dashNow}`);

// Undo.
await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Undo').click()`);
await sleep(500);
check("undo decrements to 4", (await evaluate(countExpr)) === "4", `got ${await evaluate(countExpr)}`);

// Switch dhikr; count should be independent.
await evaluate(
  `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Astaghfirullah')).click()`
);
await sleep(500);
check("switching dhikr shows its own count 0", (await evaluate(countExpr)) === "0", `got ${await evaluate(countExpr)}`);
check("target follows dhikr (100)", (await evaluate(`document.querySelector('${orbSel}').innerText.includes('100')`)) === true);

// Persist across reload.
await goto(`${BASE}/`);
const afterReload = await evaluate(
  `JSON.parse(localStorage.getItem('noor-tasbeeh')).counts.subhanallah`
);
check("count survives reload", afterReload === 4, `subhanallah = ${afterReload}`);
check("active dhikr survives reload", (await evaluate(`document.querySelector('${orbSel}').getAttribute('aria-label')`))?.includes("Astaghfirullah"));

// Reset only clears the active dhikr.
await evaluate(
  `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Subhan Allah')).click()`
);
await sleep(400);
await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Reset').click()`);
await sleep(500);
check("reset clears active count", (await evaluate(countExpr)) === "0", `got ${await evaluate(countExpr)}`);

/* ─── Custom dhikr ─────────────────────────────────────────────────────── */
await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Add dhikr')).click()`);
await sleep(900);
check("add-dhikr dialog opened", await evaluate(`!!document.querySelector('[data-slot="dialog-content"]')`));

await evaluate(`(() => {
  const setVal = (el, v) => {
    const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    d.set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const inputs = [...document.querySelectorAll('[data-slot="dialog-content"] input')];
  setVal(inputs[0], 'يَا لَطِيف');
  setVal(inputs[1], 'Ya Latif');
  setVal(inputs[2], 'O Most Gentle');
  return inputs.length;
})()`);
await sleep(400);
await evaluate(`[...document.querySelectorAll('[data-slot="dialog-content"] button')].find(b=>b.textContent.includes('Add to my list')).click()`);
await sleep(900);

check("custom dhikr became active", (await evaluate(`document.querySelector('${orbSel}').getAttribute('aria-label')`))?.includes("Ya Latif"));
check("custom dhikr in list", await evaluate(`document.body.innerText.includes('Ya Latif')`));
check("custom dhikr persisted", await evaluate(`JSON.parse(localStorage.getItem('noor-tasbeeh')).custom.some(d=>d.transliteration==='Ya Latif')`));

await evaluate(`document.querySelector('${orbSel}').click()`);
await sleep(500);
check("custom dhikr counts", (await evaluate(countExpr)) === "1", `got ${await evaluate(countExpr)}`);

// Remove it.
await evaluate(`document.querySelector('[aria-label^="Remove Ya Latif"]').click()`);
await sleep(700);
check("custom dhikr removed", (await evaluate(`document.body.innerText.includes('Ya Latif')`)) === false);

await shot(".tmp/tasbeeh-live.png");

/* ─── Qur'an page ──────────────────────────────────────────────────────── */
await goto(`${BASE}/quran`);
await sleep(2500);

check("surah 1 loaded by default", await evaluate(`document.body.innerText.includes('Al-Faatiha')`));
check("ayah count rendered (7)", (await evaluate(`document.querySelectorAll('[id^="ayah-"]').length`)) === 7);
check("audio element has an mp3 src", (await evaluate(`document.querySelector('audio')?.getAttribute('src')`))?.includes("ar.alafasy"));
check("Al-Fatiha keeps basmala as ayah 1 (no separate heading)", (await evaluate(
  `document.querySelectorAll('[id^="ayah-"]')[0].innerText.includes('بِسۡمِ')`
)) === true);

// Select Al-Ikhlas (112) from the sidebar.
await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Al-Ikhlaas')).click()`);
await sleep(3500);
check("switched to Al-Ikhlas", await evaluate(`document.body.innerText.includes('Al-Ikhlaas')`));
check("Al-Ikhlas has 4 ayahs", (await evaluate(`document.querySelectorAll('[id^="ayah-"]').length`)) === 4);
check("basmala lifted to its own heading", await evaluate(
  `(() => { const first = document.querySelectorAll('[id^="ayah-"]')[0].innerText;
    return !first.includes('ٱلرَّحِیمِ') && document.body.innerText.includes('ٱلرَّحِيمِ'); })()`
));

// Play.
await evaluate(`document.querySelector('[aria-label="Play recitation"]').click()`);
await sleep(3000);
const audioState = await evaluate(`(() => { const a = document.querySelector('audio');
  return { paused: a.paused, t: a.currentTime, dur: a.duration, src: a.currentSrc.slice(-24) }; })()`);
check("audio is playing", audioState && audioState.paused === false, JSON.stringify(audioState));
check("playback time advanced", audioState && audioState.t > 0, `t=${audioState?.t}`);
check("pause button now shown", await evaluate(`!!document.querySelector('[aria-label="Pause recitation"]')`));

// Next ayah.
await evaluate(`document.querySelector('[aria-label="Next ayah"]').click()`);
await sleep(2000);
check("next ayah advances src", (await evaluate(`document.querySelector('audio').currentSrc.split('/').pop()`)) !== `${audioState?.src}`);

// Click an ayah to play from there.
await evaluate(`document.querySelectorAll('[id^="ayah-"] button')[3].click()`);
await sleep(2000);
check("tapping ayah 4 seeks there", await evaluate(
  `document.querySelectorAll('[id^="ayah-"]')[3].querySelector('button').className.includes('border-gilded')`
));

await shot(".tmp/quran-live.png");

/* ─── Report ───────────────────────────────────────────────────────────── */
console.log("\n──────── interaction report ────────");
console.log(report.join("\n"));
const failed = report.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${report.length - failed}/${report.length} passed`);

console.log("\n──────── console / page problems ────────");
const unique = [...new Set(problems)];
console.log(unique.length ? unique.join("\n") : "none");

ws.close();
edge.kill();
process.exit(0);
