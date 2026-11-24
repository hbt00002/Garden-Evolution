# Garden Evolution — design direction

One page for anyone adding a screen. The test for every change: does the
player feel the game working in harmony, as one whole? Nothing on screen
should feel foreign to its theme.

## Tone

A calm Japanese countryside garden, drawn in pixels. Quiet, warm, hand-made.
Not a web app: no cards floating on soft shadows, no glossy gradient buttons,
no sparkles.

## Surfaces

- **The menu and the board** are the game's own pixel art: chipped corners,
  two-tone wood, a pixel title. They set the language everything else follows.
- **Every ordinary window is a garden scroll** (`scroll.css`): cream paper
  (`#f4ead0`, a faint horizontal fibre) between two wooden rollers
  (`#7b5a3a` / `#5a3f28`, 12 px, reaching 12 px past the paper on each side,
  a 3 px dark shadow `#2f2116` under them). The paper has square corners and
  no frame. In the moon garden the paper is dimmer (`#e4dbc0`) so it does not
  glare against the night.
  Windows: leaderboard, achievements, settings (full and in-game), the
  new-game prompt, the lower-score prompt, the connection error, the
  no-moves card.
- **Reward moments keep their own look**: the 2048 milestone and the 8192
  victory cards (dark wood, glow). They are meant to feel different.

## Ink

The paper is the same in every world; the ink is the world's. Each world sets
three colours, used for accents only (the selected tab's underline, the
flower ornament, the main button, rank badges, group strips, checkboxes):

| World | `--ink-accent` | `--ink-badge` | `--ink-badge-text` |
| --- | --- | --- | --- |
| 1 Winter Beginning | `#205b9c` | `#d3e6f6` | `#173f6b` |
| 2 Snowmelt Valley | `#3a7236` | `#d9ecc8` | `#254b27` |
| 3 Spring Bloom | `#43702d` | `#f2c9d8` | `#6a2440` |
| 4 Alpine Sakura | `#1f6f99` | `#d3eef8` | `#1b5c83` |
| 5 Moonlit Garden | `#735619` | `#efe2b4` | `#4a3a12` |

Text on paper is `#3e3325`, secondary text `#6f5a3e`. Every pair must reach
4.5:1.

## Inside a scroll

- **Title:** Pixelify Sans, with the pixel flower between two dashed lines above it.
- **Rows:** no boxes. A 2 px dashed rule (`#d2bf98`) between rows, none after the last.
- **Rank numbers and small badges:** a little square with 4 px chipped corners,
  `--ink-badge` behind `--ink-badge-text`.
- **Tabs:** plain text; the selected one is underlined 3 px in ink.
- **Buttons:** flat, 4 px chipped corners, at least 44 px tall. The main
  action is filled with ink and written in paper colour; a secondary action
  is paper with a 2 px ink outline. No gradients, no glow.
- **Settings:** grouped (Sound, Display, General) under small strips of the
  world's badge colour with the group's pixel icon; every row starts with a
  16 px pixel icon in ink; switches are 22 px pixel checkboxes.
- **Close:** a frameless "×" in the corner with a 44 px touch area.

## Type

- Pixelify Sans: titles and group headings.
- Oxanium: numbers (scores, ranks, percentages) and the menu buttons.
- Quicksand: everything else.
- Small labels are written normally: no capitals-plus-wide-spacing. Only the
  menu buttons use capitals.
- Nothing under 11 px (`.6875rem`), except the numbers printed on tiles.

## Icons

Pixel icons only (`src/pixel-icons.js`): drawn on a grid, `currentColor`,
crisp edges. Plants are shown with their own tile pictures. No emoji, no
generic icon sets.

## Glow and motion

Glow is kept for rewards: golden tiles, the 2048 and 8192 moments, the moon
world's own light. Badges and windows are flat. Motion is small and pixel-like
(a step, a hop), and switched off when the player asks for reduced motion.

## Access

Contrast 4.5:1, touch targets 44 px, a visible focus ring on every control,
switches keep `role="switch"` and `aria-checked`. High contrast mode turns the
dashed rules solid and the ink to its darkest.
