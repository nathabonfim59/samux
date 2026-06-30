# samux

> sane tmux configuration

`samux` is a sensible, batteries-included [tmux](https://github.com/tmux/tmux)
configuration, plus an **interactive web builder** that lets you preview it live
in a real terminal, pick colors, toggle features, and download your own
`tmux.conf`.

**Live site:** <https://nathabonfim59.github.io/samux/>

The preview runs in [ghostty-web](https://github.com/coder/ghostty-web), the same
VT100 parser that powers the native Ghostty terminal. There is no backend: the
tmux session you see is a simulated model, but the keybindings are live.

## What is in the default config

The samux default is opinionated but portable:

- `escape-time 0` for instant key response (no lag in editors and shells)
- VI copy mode, mouse support
- Windows start at `1` and renumber on close
- Alt+1..9 to switch windows, Alt+h/l for previous/next, Alt+j/k to swap
- Extended keys and passthrough for Claude Code compatibility
- True color support
- Wayland environment propagation for clipboard
- A truecolor status bar with session name, window tabs, git branch, battery,
  date, and clock
- A bell and activity indicator
- Auto-rename for windows running `claude`

## Use the web builder

Open the site and:

1. **Pick a theme** from the "Ready-made themes" dropdown, or tune individual
   colors with the color pickers. Dracula Pro is the default.
2. **Choose the status bar layout** at the top right of the preview: bar at the
   top or bottom, and which segments to show (session, user@host, git, battery,
   date, clock).
3. **Toggle features** in the sidebar. The generated `tmux.conf` updates live.
4. **Play in the terminal**: click it and type. Try `help`, `neofetch`,
   `theme tokyo-night`, `split`. The shortcuts are live:
   - `Alt+1..9` switch window
   - `Alt+h` / `Alt+l` previous / next window
   - `Alt+j` / `Alt+k` swap window position
   - `Ctrl-b` is the tmux prefix, then `c` (new window), `%` / `"` (split),
     `o` (cycle pane), `x` (close pane)
5. **Download** your `.tmux.conf` with one click, or copy it to the clipboard.

The whole page re-themes to match the palette you pick.

## Install the default config

```sh
curl -fsSL https://raw.githubusercontent.com/nathabonfim59/samux/main/tmux.conf \
  -o ~/.tmux.conf
tmux source-file ~/.tmux.conf   # or start a fresh server
```

The battery segment is inlined in the config (it reads `/sys/class/power_supply`
directly), so there is no extra script to install. If you do not want it,
uncheck "battery" in the builder.

For the full look, including Nerd Font battery icons and the Starship prompt,
see the "Make yours look like this" card on the site, or the next section.

## Nerd Font and Starship

The builder has a "Nerd Font icons" toggle in Advanced. When on, the battery
segment uses Nerd Font glyphs for the charge level and the charging state. You
need a Nerd Font installed in your terminal, or the icons show as empty boxes.
The web preview keeps a plain percentage because it cannot render those glyphs.

The shell prompt shown in the preview is [Starship](https://starship.rs).
Install it and add the init line to your shell rc file:

```sh
curl -sS https://starship.rs/install.sh | sh
eval "$(starship init zsh)"   # zsh; use `starship init bash` or fish
```

## Keybindings (from the default config)

| Key            | Action                         |
| -------------- | ------------------------------ |
| `Alt+1..9`     | switch to window 1..9          |
| `Alt+h`        | previous window                |
| `Alt+l`        | next window                    |
| `Alt+j`        | swap window toward the start   |
| `Alt+k`        | swap window toward the end     |
| `Ctrl-b c`     | new window                     |
| `Ctrl-b %`     | split pane vertically          |
| `Ctrl-b "`     | split pane horizontally        |
| `Ctrl-b o`     | cycle pane                     |
| `Ctrl-b x`     | close pane                     |

## Repository layout

```
docs/                 the GitHub Pages site (no build step)
  index.html          page shell and controls
  css/styles.css      theme-aware styles (driven by CSS variables)
  js/themes.js        palette roles and the ready-made presets
  js/config.js        turns editor state into a tmux.conf string
  js/render.js        paints the simulated tmux scene with ANSI
  js/app.js           state, keyboard handling, the fake shell, UI
  vendor/ghostty-web.js  the terminal renderer (vendored, WASM inlined)
tmux.conf             the samux default config (matches the site default)
deploy-workflow.example.yml   optional GitHub Actions workflow for Pages
```

## Deployment

The live site is served by GitHub Pages directly from the `docs/` folder on the
`main` branch (no build step, no extra permissions needed).

To use GitHub Actions instead, copy `deploy-workflow.example.yml` to
`.github/workflows/deploy.yml` and set the Pages source to "GitHub Actions" in
the repo settings. That path needs the `workflow` token scope to push.

## Run the site locally

The site is static, but it uses ES modules so it needs to be served over HTTP
(not opened as a `file://` URL):

```sh
cd docs
python3 -m http.server 8080
# open http://localhost:8080
```

## Notes on the simulated terminal

A real `tmux` cannot run in the browser on a static site: it needs Unix PTYs,
`fork`, and `exec`, none of which the browser provides. Even the ghostty-web
demo uses a remote VM. Instead, samux simulates a subset of tmux in JavaScript
and renders it through the real ghostty-web terminal, so colors, box drawing,
and graphemes all look correct, and the keybindings actually work.

Colors are inlined as `#RRGGBB` in the generated config. tmux does not expand
shell-style `$VAR` references inside format strings, so inlining is the only
reliable way to get true color in every version.

## Credits

- Terminal rendering: [ghostty-web](https://github.com/coder/ghostty-web) by Coder,
  built on Mitchell Hashimoto's [Ghostty](https://ghostty.org).
- Theme palettes inspired by Dracula, Tokyo Night, Catppuccin, Gruvbox, Nord,
  Solarized, One Dark, Rose Pine, and Everforest.

## License

MIT
