// app.js
// samux: state, the live pretend-tmux model, keyboard interception, the
// fake shell, and all UI wiring. ghostty-web is the real terminal renderer,
// but we feed it our own scene, no PTY, no backend.

import { init, Terminal, FitAddon } from "../vendor/ghostty-web.js";
import { PRESETS, SAMUX_DEFAULT, PALETTE_ROLES, TERM_OPTIONS } from "./themes.js";
import { generateConfig } from "./config.js";
import { renderScene, presetBarTokens } from "./render.js";

// --- State: the configuration being built --------------------------------

function defaultState() {
  return {
    presetId: SAMUX_DEFAULT.id,
    themeName: SAMUX_DEFAULT.name,
    palette: { ...SAMUX_DEFAULT.palette },
    statusPosition: "top",
    left: { session: true, userhost: false },
    right: { git: true, battery: true, date: true, clock: true },
    features: {
      vim: true, mouse: true, windows1: true, altnum: true, altnav: true,
      passthrough: true, truecolor: true, wayland: true, copy: false,
      bell: true, autorename: true,
    },
    term: "tmux-256color",
    clock24: true,
  };
}

let state = defaultState();
let currentConfig = "";

// --- Model: the live pretend session -------------------------------------

const CLEAR = Symbol("clear");

function S(t, c, bold) { return { t, c, bold }; }
function L(...segs) { return segs; }

function seedShell() {
  return [
    L(S(" samux shell. Type ", "comment"), S("help", "accent"), S(" for commands.", "comment")),
    L(S("❯ ", "green", true), S("~/projects/samux ", "accent"), S("git:(main) ", "pink"), S("ls", "fg")),
    L(S("  ", "fg"), S("docs ", "accent", true), S("scripts ", "accent", true), S("src ", "accent", true), S(".github ", "accent", true)),
    L(S("  ", "fg"), S("tmux.conf  ", "fg"), S("README.md  ", "fg"), S("LICENSE", "fg")),
  ];
}

function seedClaude() {
  return [
    L(S(" ✦ ", "orange", true), S("Claude Code", "orange", true), S(" v1.x", "comment")),
    L(S("")),
    L(S(" /tips for tips, /help for help", "comment")),
    L(S(" cwd: ", "comment"), S("~/projects/samux", "accent")),
    L(S("")),
    L(S(" This pane runs inside a tmux window.", "comment")),
  ];
}

function seedLogs() {
  const t = "2026-06-29 14:32:0";
  return [
    logLine(t + "1", "INFO ", "cyan", "tmux server started (pid 4242)"),
    logLine(t + "2", "INFO ", "cyan", "new session: samux"),
    logLine(t + "3", "WARN ", "yellow", "escape-time was 50ms, samux set it to 0"),
    logLine(t + "4", "INFO ", "cyan", "status bar painted with truecolor"),
    logLine(t + "5", "ERROR", "red", "battery script not found (this is expected)"),
    logLine(t + "6", "INFO ", "cyan", "Alt+1..9 and Ctrl-b prefix are live here"),
  ];
}
function logLine(ts, lvl, lvlColor, msg) {
  return L(S(ts + " ", "comment"), S(lvl + " ", lvlColor, true), S(msg, "fg"));
}

function makeShellPane(opts = {}) {
  return {
    title: opts.title || "zsh",
    cwd: opts.cwd || "~/projects/samux",
    promptColor: opts.promptColor || "green",
    history: opts.seed ? opts.seed() : [],
    input: "",
    cmdHistory: [],
    cmdHistoryIdx: -1,
  };
}

function makeInitialModel() {
  return {
    session: "samux",
    activeWindow: 0,
    prefixArmed: false,
    windows: [
      { name: "dev", split: "none", activePane: 0, panes: [makeShellPane({ title: "zsh", seed: seedShell })] },
      { name: "claude", split: "none", activePane: 0, panes: [makeShellPane({ title: "claude", promptColor: "orange", seed: seedClaude })] },
      { name: "logs", split: "none", activePane: 0, panes: [makeShellPane({ title: "logs", promptColor: "cyan", seed: seedLogs })] },
    ],
  };
}

let model = makeInitialModel();

function activeWin() { return model.windows[model.activeWindow]; }
function activePane() { const w = activeWin(); return w.panes[w.activePane]; }

function selectWindow(i) {
  if (i < 0 || i >= model.windows.length) return;
  model.activeWindow = i;
  const w = activeWin();
  if (w.activePane >= w.panes.length) w.activePane = 0;
}
function prevWindow() { model.activeWindow = (model.activeWindow - 1 + model.windows.length) % model.windows.length; }
function nextWindow() { model.activeWindow = (model.activeWindow + 1) % model.windows.length; }
function moveWindow(dir) {
  const i = model.activeWindow, j = i + dir;
  if (j < 0 || j >= model.windows.length) return;
  [model.windows[i], model.windows[j]] = [model.windows[j], model.windows[i]];
  model.activeWindow = j;
}
function addWindow(name) {
  const n = model.windows.length + 1;
  const pane = makeShellPane({ title: name || "zsh" });
  pane.history = [L(S(" new window. Type ", "comment"), S("help", "accent"), S(".", "comment"))];
  model.windows.push({ name: name || ("win" + n), split: "none", activePane: 0, panes: [pane] });
  model.activeWindow = model.windows.length - 1;
}
function splitWindow(orient) {
  const w = activeWin();
  if (w.panes.length >= 2) return;
  const p = makeShellPane({ title: "zsh" });
  p.history = [L(S(" split pane.", "comment"))];
  w.panes.push(p);
  w.split = orient;
  w.activePane = 1;
}
function cyclePane() {
  const w = activeWin();
  if (w.panes.length < 2) return;
  w.activePane = 1 - w.activePane;
}
function closeActive() {
  const w = activeWin();
  if (w.panes.length > 1) {
    w.panes.splice(w.activePane, 1);
    w.split = "none";
    w.activePane = 0;
  } else if (model.windows.length > 1) {
    model.windows.splice(model.activeWindow, 1);
    model.activeWindow = Math.max(0, model.activeWindow - 1);
  } else {
    const p = w.panes[0];
    p.history = []; p.input = "";
  }
}

// --- Command shell -------------------------------------------------------

function echoLine(pane, cmd) {
  return [
    { t: "❯ ", c: pane.promptColor, bold: true },
    { t: pane.cwd + " ", c: "accent" },
    { t: "git:(main) ", c: "pink" },
    { t: cmd, c: "fg" },
  ];
}

function boxLines(text, color) {
  const inner = [...text].length;
  const dash = "━".repeat(inner + 2);
  return [
    L(S("  ┏" + dash + "┓", color)),
    L(S("  ┃ " + text + " ┃", color, true)),
    L(S("  ┗" + dash + "┛", color)),
  ];
}

function helpOut() {
  return [
    L(S(" Commands", "accent", true)),
    L(S("  help, ls, pwd, echo, clear, date, whoami", "fg")),
    L(S("  neofetch, banner, samux, themes", "fg")),
    L(S("  theme <name>    switch the live theme", "fg")),
    L(S("  windows         list open windows", "fg")),
    L(S("  new [name]      create a window", "fg")),
    L(S("  split | hsplit  split the active window", "fg")),
    L(S("  close           close the active pane", "fg")),
    L(S(" Keybindings (these match the generated config)", "accent", true)),
    L(S("  Alt+1..9        switch window", "fg")),
    L(S("  Alt+h / Alt+l   previous / next window", "fg")),
    L(S("  Alt+j / Alt+k   swap window position", "fg")),
    L(S("  Ctrl-b c        new window", "fg")),
    L(S('  Ctrl-b % / "    split vertical / horizontal', "fg")),
    L(S("  Ctrl-b o        cycle pane", "fg")),
    L(S("  Ctrl-b x        close pane", "fg")),
  ];
}

function lsOut() {
  return [
    L(S("  ", "fg"), S("docs ", "accent", true), S("scripts ", "accent", true), S("src ", "accent", true), S(".github ", "accent", true)),
    L(S("  ", "fg"), S("tmux.conf  ", "fg"), S("README.md  ", "fg"), S("LICENSE  ", "fg"), S(".gitignore", "fg")),
  ];
}

function neofetchOut() {
  const info = [
    ["you", "@samux"],
    ["os", "Linux (Arch) x86_64"],
    ["shell", "zsh 5.9"],
    ["tmux", "3.5a"],
    ["term", state.term],
    ["theme", state.themeName],
  ];
  const lines = [
    L(S("  ╭──────────╮", "accent")),
    L(S("  │  samux   │", "accent", true)),
    L(S("  ╰──────────╯", "accent")),
    L(S("")),
  ];
  for (const [k, v] of info) lines.push(L(S("  " + k + ": ", "green"), S(v, "fg")));
  return lines;
}

function bannerOut() {
  return [
    ...boxLines("samux: sane tmux", "accent"),
    L(S("")),
    L(S("  Try: help, neofetch, theme tokyo-night", "comment")),
  ];
}

function aboutOut() {
  return [
    L(S(" samux", "accent", true), S(": sane tmux configuration", "fg")),
    L(S(" Interactive builder with a live terminal preview.", "comment")),
    L(S(" Tweak colors and features, then download your .tmux.conf.", "comment")),
    L(S(" Source: github.com/nathabonfim59/samux", "comment")),
  ];
}

function themesOut() {
  return [L(S(" Ready-made themes:", "accent", true)),
    ...PRESETS.map((p) => L(S("  " + p.name, p.id === state.presetId ? "green" : "fg"), S(p.id === state.presetId ? "  (active)" : "", "comment")))];
}

function windowsOut() {
  return [L(S(" windows:", "accent", true)),
    ...model.windows.map((w, i) => L(S("  " + (i + 1) + ": " + w.name, i === model.activeWindow ? "green" : "fg"), S(i === model.activeWindow ? "  *" : "", "comment")))];
}

function themeCmd(args) {
  if (!args.length) return themesOut();
  const q = args.join(" ").toLowerCase();
  const preset = PRESETS.find((p) => p.name.toLowerCase() === q || p.id === q || p.name.toLowerCase().includes(q));
  if (!preset) return [L(S("no theme named '" + args.join(" ") + "'. Try: themes", "red"))];
  loadPreset(preset);
  return [L(S("theme: " + preset.name, "green"))];
}

function execute(raw, pane) {
  const cmd = raw.trim();
  if (cmd === "") return [];
  const parts = cmd.split(/\s+/);
  const name = parts[0];
  const args = parts.slice(1);
  switch (name) {
    case "help": case "?": return helpOut();
    case "ls": case "ll": case "la": case "dir": return lsOut();
    case "pwd": return [L(S(pane.cwd, "accent"))];
    case "clear": case "cls": return CLEAR;
    case "echo": return [L(S(args.join(" "), "fg"))];
    case "date": return [L(S(new Date().toString(), "comment"))];
    case "whoami": return [L(S("you", "accent"))];
    case "neofetch": return neofetchOut();
    case "banner": case "figlet": return bannerOut();
    case "samux": case "about": return aboutOut();
    case "themes": case "list-themes": return themesOut();
    case "theme": return themeCmd(args);
    case "windows": case "w": return windowsOut();
    case "new": case "neww": case "new-window": addWindow(args[0]); return [L(S("created window", "green"))];
    case "split": case "vsplit": splitWindow("vertical"); return [L(S("split vertically", "green"))];
    case "hsplit": splitWindow("horizontal"); return [L(S("split horizontally", "green"))];
    case "close": case "exit": case "quit": closeActive(); return [];
    default: return [L(S("zsh: command not found: " + name, "red"))];
  }
}

function runCommand(pane) {
  const raw = pane.input;
  pane.history.push(echoLine(pane, raw));
  pane.input = "";
  if (raw.trim().length) {
    pane.cmdHistory.push(raw);
    pane.cmdHistoryIdx = pane.cmdHistory.length;
    const out = execute(raw, pane);
    if (out === CLEAR) {
      pane.history = [];
    } else if (Array.isArray(out)) {
      for (const line of out) pane.history.push(line);
    }
  }
  if (pane.history.length > 300) pane.history = pane.history.slice(-300);
  render();
}

function historyUp(pane) {
  if (!pane.cmdHistory.length) return;
  if (pane.cmdHistoryIdx > 0) pane.cmdHistoryIdx--;
  pane.input = pane.cmdHistory[pane.cmdHistoryIdx] || "";
  render();
}
function historyDown(pane) {
  if (!pane.cmdHistory.length) return;
  if (pane.cmdHistoryIdx < pane.cmdHistory.length - 1) {
    pane.cmdHistoryIdx++;
    pane.input = pane.cmdHistory[pane.cmdHistoryIdx];
  } else {
    pane.cmdHistoryIdx = pane.cmdHistory.length;
    pane.input = "";
  }
  render();
}

// --- Keyboard interception ----------------------------------------------

let prefixTimer = null;

function setPrefixHint(on) {
  const el = document.getElementById("prefixHint");
  if (el) el.classList.toggle("armed", on);
}

function armPrefix() {
  model.prefixArmed = true;
  setPrefixHint(true);
  clearTimeout(prefixTimer);
  prefixTimer = setTimeout(() => { model.prefixArmed = false; setPrefixHint(false); }, 1500);
}

function handlePrefixKey(e) {
  clearTimeout(prefixTimer);
  model.prefixArmed = false;
  setPrefixHint(false);
  const k = e.key;
  if (k >= "1" && k <= "9") selectWindow(parseInt(k, 10) - 1);
  else if (k === "n") nextWindow();
  else if (k === "p") prevWindow();
  else if (k === "c") addWindow();
  else if (k === "%") splitWindow("vertical");
  else if (k === '"' || k === "'") splitWindow("horizontal");
  else if (k === "o") cyclePane();
  else if (k === "x") closeActive();
  render();
}

function onKey(e) {
  if (!term) return;
  if (model.prefixArmed) { e.preventDefault(); handlePrefixKey(e); return; }
  const w = activeWin();
  const pane = w.panes[w.activePane];
  const k = e.key;

  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    if (k >= "1" && k <= "9") { selectWindow(parseInt(k, 10) - 1); e.preventDefault(); render(); return; }
    if (k === "h") { prevWindow(); e.preventDefault(); render(); return; }
    if (k === "l") { nextWindow(); e.preventDefault(); render(); return; }
    if (k === "j") { moveWindow(-1); e.preventDefault(); render(); return; }
    if (k === "k") { moveWindow(1); e.preventDefault(); render(); return; }
  }

  if (e.ctrlKey && (k === "b" || k === "B")) { armPrefix(); e.preventDefault(); return; }

  if (k === "Enter") { runCommand(pane); e.preventDefault(); return; }
  if (k === "Backspace") { pane.input = pane.input.slice(0, -1); e.preventDefault(); render(); return; }
  if (k === "ArrowUp") { historyUp(pane); e.preventDefault(); return; }
  if (k === "ArrowDown") { historyDown(pane); e.preventDefault(); return; }
  if (k === "Tab") { pane.input += "    "; e.preventDefault(); render(); return; }
  if (k === "Escape") { pane.input = ""; e.preventDefault(); render(); return; }

  if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    pane.input += k;
    e.preventDefault();
    render();
  }
}

// --- Terminal ------------------------------------------------------------

let term = null;
let fit = null;
let termArea = null;

function render() {
  if (!term) return;
  try {
    term.options.theme = term.options.theme || {};
    term.options.theme.background = state.palette.bg;
    term.options.theme.cursor = state.palette.accent;
  } catch (_) { /* options may be read-only on some builds */ }
  renderScene({ term, model, state, cols: term.cols, rows: term.rows });
}

async function setupTerminal() {
  termArea = document.getElementById("termArea");
  const loader = document.getElementById("termLoader");
  try {
    await init();
  } catch (err) {
    if (loader) loader.innerHTML = "Could not load the terminal engine (ghostty-web / WebAssembly). The config builder below still works.";
    return;
  }
  try {
    term = new Terminal({
      fontSize: 14,
      fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code',ui-monospace,Menlo,Consolas,monospace",
      theme: { background: state.palette.bg, foreground: state.palette.fg, cursor: state.palette.accent },
      cursorBlink: true,
      cursorStyle: "bar",
      disableStdin: false,
      scrollback: 0,
      allowTransparency: false,
      convertEol: true,
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    term.open(termArea);
  } catch (err) {
    console.error("ghostty-web setup failed:", err);
    if (loader) loader.innerHTML = "Could not start the terminal preview in this browser. The config builder below still works.";
    return;
  }
  try { fit.fit(); } catch (_) {}
  try { fit.observeResize(); } catch (_) {}
  term.onResize(() => render());
  window.addEventListener("resize", () => { try { fit.fit(); } catch (_) {} render(); });
  termArea.addEventListener("keydown", onKey, true);
  termArea.addEventListener("click", () => term.focus());
  if (loader) loader.remove();
  try { term.focus(); } catch (_) {}
  render();
}

// --- UI helpers ----------------------------------------------------------

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function samePalette(a, b) {
  for (const r of PALETTE_ROLES) if (a[r.key] !== b[r.key]) return false;
  return true;
}

const FEATURE_DEFS = [
  { key: "vim", label: "VI copy mode", desc: "setw -g mode-keys vi" },
  { key: "mouse", label: "Mouse support", desc: "click, resize, scroll" },
  { key: "windows1", label: "Windows start at 1", desc: "base-index 1, renumber on close" },
  { key: "altnum", label: "Alt+number window switching", desc: "M-1..M-9, like a browser" },
  { key: "altnav", label: "Alt+h/l/j/k navigation", desc: "prev/next and swap window" },
  { key: "passthrough", label: "Passthrough + extended keys", desc: "Claude Code compatibility" },
  { key: "truecolor", label: "True color", desc: "RGB terminal overrides" },
  { key: "wayland", label: "Wayland env", desc: "clipboard and battery hooks" },
  { key: "copy", label: "wl-copy binding", desc: "y copies to Wayland clipboard" },
  { key: "bell", label: "Bell and activity", desc: "monitor-bell, bell-action" },
  { key: "autorename", label: "Auto-rename claude windows", desc: "pane-title-changed hook" },
];

function buildColorGrid() {
  const grid = document.getElementById("colorGrid");
  grid.innerHTML = PALETTE_ROLES.map((r) => `
    <div class="color-row" data-role="${r.key}">
      <label class="swatch" title="${esc(r.hint)}">
        <input type="color" data-role="${r.key}" value="${state.palette[r.key]}">
      </label>
      <div class="color-meta">
        <div class="color-label">${esc(r.label)}</div>
        <div class="color-hint">${esc(r.hint)}</div>
      </div>
      <code class="color-hex" data-role="${r.key}">${state.palette[r.key]}</code>
    </div>`).join("");
  grid.querySelectorAll('input[type="color"]').forEach((inp) => {
    inp.addEventListener("input", () => {
      state.palette[inp.dataset.role] = inp.value;
      refreshUI();
    });
  });
}

function buildFeatureList() {
  const list = document.getElementById("featureList");
  list.innerHTML = FEATURE_DEFS.map((f) => `
    <label class="feature">
      <input type="checkbox" data-feature="${f.key}" ${state.features[f.key] ? "checked" : ""}>
      <span class="feature-text">
        <span class="feature-label">${esc(f.label)}</span>
        <span class="feature-desc">${esc(f.desc)}</span>
      </span>
    </label>`).join("");
  list.querySelectorAll('input[type="checkbox"]').forEach((inp) => {
    inp.addEventListener("change", () => {
      state.features[inp.dataset.feature] = inp.checked;
      refreshUI();
    });
  });
}

function buildTermSelect() {
  const sel = document.getElementById("termSelect");
  sel.innerHTML = TERM_OPTIONS.map((o) => `<option value="${o.value}" ${o.value === state.term ? "selected" : ""}>${esc(o.label)}</option>`).join("");
  sel.addEventListener("change", () => { state.term = sel.value; refreshUI(); });
}

function buildPresetGrid() {
  const grid = document.getElementById("presetGrid");
  grid.innerHTML = PRESETS.map((p) => {
    const bar = presetBarTokens(p.palette)
      .map((t) => `<span class="mtok" style="color:${t.fg};background:${t.bg};${t.bold ? "font-weight:700" : ""}">${esc(t.text)}</span>`)
      .join("");
    return `
      <button class="preset-card" data-id="${p.id}">
        <div class="mini" style="background:${p.palette.bg}"><div class="mini-bar">${bar}</div></div>
        <div class="preset-name">${esc(p.name)}</div>
        <div class="preset-blurb">${esc(p.blurb)}</div>
      </button>`;
  }).join("");
  grid.querySelectorAll(".preset-card").forEach((card) => {
    card.addEventListener("click", () => {
      const p = PRESETS.find((x) => x.id === card.dataset.id);
      loadPreset(p);
      document.getElementById("presetDropdown").classList.remove("open");
    });
  });
}

function loadPreset(preset) {
  state.palette = { ...preset.palette };
  refreshUI();
}

function updatePresetActive() {
  document.querySelectorAll(".preset-card").forEach((c) => {
    c.classList.toggle("active", c.dataset.id === state.presetId);
  });
}

function applyThemeChrome() {
  const root = document.documentElement;
  for (const r of PALETTE_ROLES) root.style.setProperty("--" + r.key, state.palette[r.key]);
}

function updateConfig() {
  const matched = PRESETS.find((p) => samePalette(p.palette, state.palette));
  state.presetId = matched ? matched.id : null;
  state.themeName = matched ? matched.name : "Custom";
  currentConfig = generateConfig(state);
  document.getElementById("cfgOut").textContent = currentConfig;
  document.getElementById("themeName").textContent = state.themeName;
  applyThemeChrome();
  updatePresetActive();
}

function refreshUI() {
  // color inputs + hex
  document.querySelectorAll('input[type="color"][data-role]').forEach((inp) => {
    inp.value = state.palette[inp.dataset.role];
  });
  document.querySelectorAll(".color-hex[data-role]").forEach((el) => {
    el.textContent = state.palette[el.dataset.role];
  });
  // features
  document.querySelectorAll('input[data-feature]').forEach((inp) => {
    inp.checked = !!state.features[inp.dataset.feature];
  });
  // term select
  document.getElementById("termSelect").value = state.term;
  // clock
  document.getElementById("clockToggle").checked = state.clock24;
  // position
  document.getElementById("posTop").classList.toggle("on", state.statusPosition === "top");
  document.getElementById("posBottom").classList.toggle("on", state.statusPosition === "bottom");
  // segments
  document.getElementById("segSession").checked = state.left.session;
  document.getElementById("segUserhost").checked = state.left.userhost;
  document.getElementById("segGit").checked = state.right.git;
  document.getElementById("segBattery").checked = state.right.battery;
  document.getElementById("segDate").checked = state.right.date;
  document.getElementById("segClock").checked = state.right.clock;

  updateConfig();
  render();
}

// --- Wiring --------------------------------------------------------------

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 1800);
}

function download(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function wireControls() {
  document.getElementById("btnBrowse").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("presetDropdown").classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    const dd = document.getElementById("presetDropdown");
    if (dd.classList.contains("open") && !dd.contains(e.target) && e.target.id !== "btnBrowse") {
      dd.classList.remove("open");
    }
  });

  document.getElementById("posTop").addEventListener("click", () => { state.statusPosition = "top"; refreshUI(); });
  document.getElementById("posBottom").addEventListener("click", () => { state.statusPosition = "bottom"; refreshUI(); });

  const segMap = {
    segSession: ["left", "session"], segUserhost: ["left", "userhost"],
    segGit: ["right", "git"], segBattery: ["right", "battery"],
    segDate: ["right", "date"], segClock: ["right", "clock"],
  };
  Object.entries(segMap).forEach(([id, [group, key]]) => {
    document.getElementById(id).addEventListener("change", (e) => {
      state[group][key] = e.target.checked;
      refreshUI();
    });
  });

  document.getElementById("clockToggle").addEventListener("change", (e) => {
    state.clock24 = e.target.checked;
    refreshUI();
  });

  document.getElementById("btnReset").addEventListener("click", () => {
    state = defaultState();
    refreshUI();
    toast("Reset to samux default");
  });

  const doCopy = async () => {
    try { await navigator.clipboard.writeText(currentConfig); toast("Copied tmux.conf"); }
    catch (_) { toast("Copy failed, select the text manually"); }
  };
  const doDownload = () => download(".tmux.conf", currentConfig);
  document.getElementById("btnCopy").addEventListener("click", doCopy);
  document.getElementById("btnDownload").addEventListener("click", doDownload);
  document.getElementById("btnCopyCfg").addEventListener("click", doCopy);
  document.getElementById("btnDownloadCfg").addEventListener("click", () => download("tmux.conf", currentConfig));
}

// --- Boot ----------------------------------------------------------------

function boot() {
  buildColorGrid();
  buildFeatureList();
  buildTermSelect();
  buildPresetGrid();
  wireControls();
  refreshUI();
  setupTerminal();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
