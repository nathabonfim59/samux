// themes.js
// Palette roles and the ready-made theme presets for samux.
// Every palette has the same 11 roles so the renderer and the config
// generator can stay simple.

// Canonical color roles. Order here drives the order of the color pickers.
// label: short name shown next to the swatch.
// hint: one line describing where the color is used.
export const PALETTE_ROLES = [
  { key: "accent",  label: "Accent",        hint: "Active pane border, session badge, clock" },
  { key: "bg",      label: "Background",    hint: "Status bar and terminal background" },
  { key: "cur",     label: "Current line",  hint: "Active window tab, prompt background" },
  { key: "fg",      label: "Foreground",    hint: "Default text color" },
  { key: "comment", label: "Comment",       hint: "Inactive windows and dividers" },
  { key: "cyan",    label: "Cyan",          hint: "Used in ls output and segments" },
  { key: "green",   label: "Green",         hint: "Prompt arrow, success, battery" },
  { key: "orange",  label: "Orange",        hint: "Warnings, numbers" },
  { key: "pink",    label: "Pink",          hint: "Git branch, highlights" },
  { key: "red",     label: "Red",           hint: "Errors, low battery" },
  { key: "yellow",  label: "Yellow",        hint: "Strings, medium battery" },
];

// The samux default is Dracula Pro, matching the reference ~/.tmux.conf.
export const PRESETS = [
  {
    id: "dracula-pro",
    name: "Dracula Pro",
    blurb: "The samux default. Warm pro palette.",
    palette: {
      accent: "#E57F6C", bg: "#22212C", cur: "#44475A", fg: "#F8F8F2",
      comment: "#7970A9", cyan: "#80FFEA", green: "#8AFF80", orange: "#FFCA80",
      pink: "#FF80BF", red: "#FF9580", yellow: "#FFFF80",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    blurb: "The classic dark purple.",
    palette: {
      accent: "#BD93F9", bg: "#282A36", cur: "#44475A", fg: "#F8F8F2",
      comment: "#6272A4", cyan: "#8BE9FD", green: "#50FA7B", orange: "#FFB86C",
      pink: "#FF79C6", red: "#FF5555", yellow: "#F1FA8C",
    },
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    blurb: "Deep blue Tokyo nights.",
    palette: {
      accent: "#7AA2F7", bg: "#1A1B26", cur: "#24283B", fg: "#C0CAF5",
      comment: "#565F89", cyan: "#7DCFFF", green: "#9ECE6A", orange: "#FF9E64",
      pink: "#BB9AF7", red: "#F7768E", yellow: "#E0AF68",
    },
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    blurb: "Soft, warm, pastel dark.",
    palette: {
      accent: "#CBA6F7", bg: "#1E1E2E", cur: "#313244", fg: "#CDD6F4",
      comment: "#6C7086", cyan: "#94E2D5", green: "#A6E3A1", orange: "#FAB387",
      pink: "#F5C2E7", red: "#F38BA8", yellow: "#F9E2AF",
    },
  },
  {
    id: "catppuccin-macchiato",
    name: "Catppuccin Macchiato",
    blurb: "Catppuccin, a touch darker.",
    palette: {
      accent: "#C6A0F6", bg: "#24273A", cur: "#363A4F", fg: "#CAD3F5",
      comment: "#6E738D", cyan: "#8BD5CA", green: "#A6DA95", orange: "#F5A97F",
      pink: "#F4B8E4", red: "#ED8796", yellow: "#EED49F",
    },
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    blurb: "Retro, earthy, high contrast.",
    palette: {
      accent: "#FE8019", bg: "#282828", cur: "#3C3836", fg: "#EBDBB2",
      comment: "#928374", cyan: "#8EC07C", green: "#B8BB26", orange: "#D65D0E",
      pink: "#D3869B", red: "#FB4934", yellow: "#FABD2F",
    },
  },
  {
    id: "nord",
    name: "Nord",
    blurb: "Arctic, north-bluish, calm.",
    palette: {
      accent: "#88C0D0", bg: "#2E3440", cur: "#3B4252", fg: "#E5E9F0",
      comment: "#616E88", cyan: "#8FBCBB", green: "#A3BE8C", orange: "#D08770",
      pink: "#B48EAD", red: "#BF616A", yellow: "#EBCB8B",
    },
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    blurb: "Ethan Schoonover's precision palette.",
    palette: {
      accent: "#268BD2", bg: "#002B36", cur: "#073642", fg: "#93A1A1",
      comment: "#586E75", cyan: "#2AA198", green: "#859900", orange: "#CB4B16",
      pink: "#D33682", red: "#DC322F", yellow: "#B58900",
    },
  },
  {
    id: "one-dark",
    name: "One Dark",
    blurb: "Atom's familiar dark theme.",
    palette: {
      accent: "#61AFEF", bg: "#282C34", cur: "#3E4451", fg: "#ABB2BF",
      comment: "#5C6370", cyan: "#56B6C2", green: "#98C379", orange: "#D19A66",
      pink: "#C678DD", red: "#E06C75", yellow: "#E5C07B",
    },
  },
  {
    id: "rose-pine",
    name: "Rose Pine",
    blurb: "Soothing, rose-tinted dark.",
    palette: {
      accent: "#EBBCBA", bg: "#191724", cur: "#1F1D2E", fg: "#E0DEF4",
      comment: "#6E6A86", cyan: "#9CCFD8", green: "#31748F", orange: "#F6C177",
      pink: "#C4A7E7", red: "#EB6F92", yellow: "#ECE0AD",
    },
  },
  {
    id: "everforest",
    name: "Everforest",
    blurb: "Green-based, comfortable dark.",
    palette: {
      accent: "#A7C080", bg: "#2D353B", cur: "#343F44", fg: "#D3C6AA",
      comment: "#7A8478", cyan: "#83C092", green: "#A7C080", orange: "#E69875",
      pink: "#D699B6", red: "#E67E80", yellow: "#DBBC7F",
    },
  },
  {
    id: "void",
    name: "Void",
    blurb: "Minimal greyscale with one accent.",
    palette: {
      accent: "#6CB6FF", bg: "#0D0D0F", cur: "#18181B", fg: "#E4E4E7",
      comment: "#71717A", cyan: "#8AB4C9", green: "#9CB89C", orange: "#C9A98A",
      pink: "#B89CB0", red: "#C99A9A", yellow: "#C9C18A",
    },
  },
];

export const PRESET_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));
export const SAMUX_DEFAULT = PRESET_BY_ID["dracula-pro"];

// Terminal type options for the truecolor block.
export const TERM_OPTIONS = [
  { value: "tmux-256color", label: "tmux-256color (portable, recommended)" },
  { value: "xterm-ghostty", label: "xterm-ghostty (Ghostty)" },
  { value: "xterm-256color", label: "xterm-256color" },
  { value: "screen-256color", label: "screen-256color" },
];
