// render.js
// Paints the pretend tmux session into a ghostty-web Terminal.
// Same glyph map as the generated config, so the preview shows the real icons.
import { NF } from "./config.js";

// We build a grid of cells, each with a char and truecolor fg/bg, then
// serialize it to ANSI and write it. No PTY, no backend: the scene model
// lives in app.js and we just visualize it here.

const ESC = "\x1b";

function hexToRgb(hex) {
  const h = String(hex).replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function fgSgr(hex) {
  const [r, g, b] = hexToRgb(hex);
  return `${ESC}[38;2;${r};${g};${b}m`;
}
function bgSgr(hex) {
  const [r, g, b] = hexToRgb(hex);
  return `${ESC}[48;2;${r};${g};${b}m`;
}

// Build a grid filled with the background color.
function buildGrid(cols, rows, bg) {
  const g = new Array(rows);
  for (let r = 0; r < rows; r++) {
    const row = new Array(cols);
    for (let c = 0; c < cols; c++) row[c] = { ch: " ", fg: "#ffffff", bg, bold: false };
    g[r] = row;
  }
  return g;
}

function put(g, cols, rows, r, c, ch, fg, bg, bold = false) {
  if (r < 0 || r >= rows || c < 0 || c >= cols) return;
  g[r][c] = { ch, fg, bg, bold };
}
function hline(g, cols, rows, r, c1, c2, ch, fg, bg) {
  for (let c = c1; c <= c2; c++) put(g, cols, rows, r, c, ch, fg, bg);
}
function vline(g, cols, rows, c, r1, r2, ch, fg, bg) {
  for (let r = r1; r <= r2; r++) put(g, cols, rows, r, c, ch, fg, bg);
}

// Box drawing characters.
const B = {
  TL: "┌", TR: "┐", BL: "└", BR: "┘",
  H: "─", V: "│",
  TD: "┬", TU: "┴", TL2: "├", TR2: "┤",
};

function drawBox(g, cols, rows, r1, c1, r2, c2, color, bg) {
  put(g, cols, rows, r1, c1, B.TL, color, bg);
  put(g, cols, rows, r1, c2, B.TR, color, bg);
  put(g, cols, rows, r2, c1, B.BL, color, bg);
  put(g, cols, rows, r2, c2, B.BR, color, bg);
  hline(g, cols, rows, r1, c1 + 1, c2 - 1, B.H, color, bg);
  hline(g, cols, rows, r2, c1 + 1, c2 - 1, B.H, color, bg);
  vline(g, cols, rows, c1, r1 + 1, r2 - 1, B.V, color, bg);
  vline(g, cols, rows, c2, r1 + 1, r2 - 1, B.V, color, bg);
}

// --- Status bar -----------------------------------------------------------

function segWidth(t) {
  return [...String(t)].length;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dateStr() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  return `${DAYS[d.getDay()]} ${dd} ${MONTHS[d.getMonth()]}`;
}
function timeStr(clock24) {
  const d = new Date();
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  if (clock24) return `${String(h).padStart(2, "0")}:${m}`;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m}${ampm}`;
}
function batteryColor(pct, P) {
  if (pct > 50) return P.green;
  if (pct > 20) return P.yellow;
  return P.red;
}

function writeToken(g, cols, rows, r, c, token) {
  let col = c;
  for (const ch of String(token.text)) {
    put(g, cols, rows, r, col, ch, token.fg, token.bg, !!token.bold);
    col++;
  }
}

function drawStatusBar(g, cols, rows, model, state, P) {
  const barRow = state.statusPosition === "top" ? 0 : rows - 1;

  const left = [];
  if (state.left.session) {
    left.push({ text: ` ${model.session} `, fg: P.bg, bg: P.accent, bold: true });
    left.push({ text: " ", fg: P.accent, bg: P.bg });
  }
  if (state.left.userhost) {
    left.push({ text: " you@samux ", fg: P.comment, bg: P.bg });
  }

  const wins = model.windows.map((w, i) => {
    const active = i === model.activeWindow;
    return {
      text: ` ${i + 1}:${w.name} `,
      fg: active ? P.fg : P.comment,
      bg: active ? P.cur : P.bg,
      bold: active,
    };
  });

  const right = [];
  if (state.right.git) {
    const gitBody = state.nerdfont ? `${NF.branch} main` : "git:main";
    right.push({ text: ` ${gitBody} `, fg: P.pink, bg: P.bg });
  }
  if (state.right.battery) {
    // Static 75% snapshot. With Nerd Font on, prefix the charge-level glyph
    // the config would emit at this level (>= 75 -> full), matching what the
    // real status bar renders once a Nerd Font is installed.
    const pct = 75;
    const body = state.nerdfont ? `${NF.full} ${pct}%` : `${pct}%`;
    right.push({ text: ` ${body} `, fg: batteryColor(pct, P), bg: P.bg });
  }
  if (state.right.date) right.push({ text: ` ${dateStr()} `, fg: P.comment, bg: P.bg });
  if (state.right.clock) right.push({ text: ` ${timeStr(state.clock24)} `, fg: P.bg, bg: P.accent, bold: true });

  const leftW = [...left, ...wins].reduce((a, t) => a + segWidth(t.text), 0);
  let rightW = right.reduce((a, t) => a + segWidth(t.text), 0);

  // If everything does not fit, drop right segments (git first) then date.
  let rightVisible = right;
  while (rightVisible.length && leftW + rightW > cols - 1) {
    rightVisible = rightVisible.slice(1);
    rightW = rightVisible.reduce((a, t) => a + segWidth(t.text), 0);
  }

  let col = 0;
  for (const t of [...left, ...wins]) {
    writeToken(g, cols, rows, barRow, col, t);
    col += segWidth(t.text);
  }
  let rcol = cols - rightW;
  for (const t of rightVisible) {
    writeToken(g, cols, rows, barRow, rcol, t);
    rcol += segWidth(t.text);
  }
}

// --- Panes ----------------------------------------------------------------

function promptSegments(pane, P) {
  return [
    { t: "❯ ", c: pane.promptColor, bold: true },
    { t: `${pane.cwd} `, c: P.accent },
    { t: "git:(main) ", c: P.pink },
  ];
}

function renderLine(g, cols, rows, r, c1, c2, line, bg, P) {
  let col = c1;
  for (const seg of line) {
    const color = P[seg.c] || seg.c || "#ffffff";
    for (const ch of String(seg.t)) {
      if (col > c2) return;
      put(g, cols, rows, r, col, ch, color, bg, !!seg.bold);
      col++;
    }
  }
}

function drawPaneContent(g, cols, rows, pane, r1, c1, r2, c2, P, isActive, cursor) {
  const width = c2 - c1 + 1;
  const height = r2 - r1 + 1;
  if (width <= 0 || height <= 0) return;

  const inputLine = [...promptSegments(pane, P), { t: pane.input, c: P.fg }];
  const all = [...pane.history, inputLine];
  const shown = all.slice(-height);
  const startR = Math.max(r1, r2 - shown.length + 1);

  shown.forEach((line, i) => renderLine(g, cols, rows, startR + i, c1, c2, line, P.bg, P));

  if (isActive && cursor) {
    const promptW = promptSegments(pane, P).reduce((a, s) => a + segWidth(s.t), 0);
    cursor.r = r2;
    cursor.c = c1 + promptW + segWidth(pane.input);
    cursor.show = true;
  }
}

function drawPanes(g, cols, rows, model, state, P, cursor) {
  const top = state.statusPosition === "top";
  const r1 = top ? 1 : 0;
  const r2 = top ? rows - 1 : rows - 2;
  const c1 = 0;
  const c2 = cols - 1;
  if (r2 < r1) return;

  const win = model.windows[model.activeWindow];
  const panes = win.panes;
  const active = win.activePane;

  if (panes.length === 1) {
    drawBox(g, cols, rows, r1, c1, r2, c2, P.accent, P.bg);
    drawPaneContent(g, cols, rows, panes[0], r1 + 1, c1 + 1, r2 - 1, c2 - 1, P, active === 0, cursor);
    return;
  }

  if (win.split === "horizontal") {
    const mr = Math.floor((r1 + r2) / 2);
    const topColor = active === 0 ? P.accent : P.comment;
    const botColor = active === 1 ? P.accent : P.comment;
    const div = P.accent;
    put(g, cols, rows, r1, c1, B.TL, topColor, P.bg);
    vline(g, cols, rows, c1, r1 + 1, mr - 1, B.V, topColor, P.bg);
    put(g, cols, rows, mr, c1, B.TL2, div, P.bg);
    vline(g, cols, rows, c1, mr + 1, r2 - 1, B.V, botColor, P.bg);
    put(g, cols, rows, r2, c1, B.BL, botColor, P.bg);
    put(g, cols, rows, r1, c2, B.TR, topColor, P.bg);
    vline(g, cols, rows, c2, r1 + 1, mr - 1, B.V, topColor, P.bg);
    put(g, cols, rows, mr, c2, B.TR2, div, P.bg);
    vline(g, cols, rows, c2, mr + 1, r2 - 1, B.V, botColor, P.bg);
    put(g, cols, rows, r2, c2, B.BR, botColor, P.bg);
    hline(g, cols, rows, r1, c1 + 1, c2 - 1, B.H, topColor, P.bg);
    hline(g, cols, rows, r2, c1 + 1, c2 - 1, B.H, botColor, P.bg);
    hline(g, cols, rows, mr, c1 + 1, c2 - 1, B.H, div, P.bg);
    drawPaneContent(g, cols, rows, panes[0], r1 + 1, c1 + 1, mr - 1, c2 - 1, P, active === 0, cursor);
    drawPaneContent(g, cols, rows, panes[1], mr + 1, c1 + 1, r2 - 1, c2 - 1, P, active === 1, null);
    return;
  }

  // vertical split (default for 2 panes)
  const mc = Math.floor(cols / 2);
  const leftColor = active === 0 ? P.accent : P.comment;
  const rightColor = active === 1 ? P.accent : P.comment;
  const div = P.accent;
  put(g, cols, rows, r1, c1, B.TL, leftColor, P.bg);
  hline(g, cols, rows, r1, c1 + 1, mc - 1, B.H, leftColor, P.bg);
  put(g, cols, rows, r1, mc, B.TD, div, P.bg);
  hline(g, cols, rows, r1, mc + 1, c2 - 1, B.H, rightColor, P.bg);
  put(g, cols, rows, r1, c2, B.TR, rightColor, P.bg);
  put(g, cols, rows, r2, c1, B.BL, leftColor, P.bg);
  hline(g, cols, rows, r2, c1 + 1, mc - 1, B.H, leftColor, P.bg);
  put(g, cols, rows, r2, mc, B.TU, div, P.bg);
  hline(g, cols, rows, r2, mc + 1, c2 - 1, B.H, rightColor, P.bg);
  put(g, cols, rows, r2, c2, B.BR, rightColor, P.bg);
  vline(g, cols, rows, c1, r1 + 1, r2 - 1, B.V, leftColor, P.bg);
  vline(g, cols, rows, c2, r1 + 1, r2 - 1, B.V, rightColor, P.bg);
  vline(g, cols, rows, mc, r1 + 1, r2 - 1, B.V, div, P.bg);
  drawPaneContent(g, cols, rows, panes[0], r1 + 1, c1 + 1, r2 - 1, mc - 1, P, active === 0, cursor);
  drawPaneContent(g, cols, rows, panes[1], r1 + 1, mc + 1, r2 - 1, c2 - 1, P, active === 1, null);
}

// --- Serialize + entry point ---------------------------------------------

function serialize(g, rows, cols) {
  let out = "";
  let fg = null, bg = null, bold = null;
  for (let r = 0; r < rows; r++) {
    out += `${ESC}[${r + 1};1H`;
    const row = g[r];
    for (let c = 0; c < cols; c++) {
      const cell = row[c];
      if (cell.fg !== fg) { out += fgSgr(cell.fg); fg = cell.fg; }
      if (cell.bg !== bg) { out += bgSgr(cell.bg); bg = cell.bg; }
      const cb = !!cell.bold;
      if (cb !== bold) { out += cb ? `${ESC}[1m` : `${ESC}[22m`; bold = cb; }
      out += cell.ch;
    }
  }
  return out;
}

// ctx = { term, model, state, cols, rows }
export function renderScene(ctx) {
  const { term, model, state, cols, rows } = ctx;
  const P = state.palette;
  const grid = buildGrid(cols, rows, P.bg);
  drawStatusBar(grid, cols, rows, model, state, P);

  const cursor = { r: 0, c: 0, show: false };
  drawPanes(grid, cols, rows, model, state, P, cursor);

  let ansi = `${ESC}[?25l` + serialize(grid, rows, cols);
  term.write(ansi);

  if (cursor.show) {
    term.write(`${ESC}[?25h${ESC}[${cursor.r + 1};${cursor.c + 1}H`);
  }
}

// Mini status bar preview for the preset grid (pure data, rendered in HTML).
// Returns an array of {text, fg, bg, bold} tokens for a compact bar.
export function presetBarTokens(palette) {
  return [
    { text: " dev ", fg: palette.bg, bg: palette.accent, bold: true },
    { text: " ", fg: palette.accent, bg: palette.bg },
    { text: " 1:zsh ", fg: palette.fg, bg: palette.cur, bold: true },
    { text: " ", fg: palette.bg, bg: palette.bg },
    { text: " 14:32 ", fg: palette.bg, bg: palette.accent, bold: true },
  ];
}
