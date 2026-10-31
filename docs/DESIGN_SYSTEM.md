# SettleGraph UI design system — v0.5.3

## Product identity
SettleGraph is an independent merchant-finance operations workspace. It is visually inspired by the supplied Paytm palette and density, but it is not Paytm, does not use Paytm marks, and must not imply official affiliation. Hackathon team/track identifiers belong in pitch materials, not merchant-facing application chrome.

## Tokens

| Token | Value | Use |
|---|---|---|
| Primary | `#00baf2` | Primary actions, active navigation, key data highlights |
| Primary dark | `#009acb` | Hover/pressed state |
| Background | `#f5f7f9` | Workspace canvas |
| Surface | `#ffffff` | Cards, tables, navigation, headers |
| Text | `#17191c` | Primary body text |
| Heading | `#505050` | Headings |
| Muted | `#68737d` | Secondary copy |
| Border | `rgba(15, 15, 15, 0.13)` | Dividers and cards |
| Positive | `#16864b` | Confirmed/pass states |
| Warning | `#976300` | Needs review / not tested |
| Negative | `#c73737` | Failed/conflict states |

## Typography
- Font: `Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`.
- Weights: 400 body, 500/600 labels, 700 headings and controls, 800 prominent metric figures.
- Small dashboard labels may be 8–10px; body copy 9–12px in dense workbench sections; key page headings 15–20px. Do not shrink important warnings below readable sizes.

## Geometry and spacing
- Default card/button radius: `8px`; pills: `18px`.
- Spacing rhythm: `8 / 10 / 12 / 14 / 16 / 20 / 24 / 35px`.
- Cards use a 1px neutral border and minimal shadow, not glassmorphism or dark gradient panels.
- Keep financial metrics prominent and tables dense but readable.

## Interaction states
- Primary action: blue fill and white text.
- Secondary action: white or pale-blue surface with blue border/text.
- Positive/warning/negative statuses use both labels and colour; colour alone is insufficient.
- All interactive controls need visible focus, disabled and loading states.
- Layout must adapt at 1180px, 900px and 680px. On mobile, navigation becomes a horizontally scrollable strip.

## Data presentation rules
- INR amounts come from backend integer-paise values; never recalculate financial values with floating-point arithmetic in the browser.
- Unknown, missing, synthetic, staged, mocked and unverified values must be labelled explicitly.
- Do not show a green “connected” state just because an API key exists. Show each integration's actual last test result.
- No fabricated charts or decorative fake metrics. Every visual value must be bound to a real API response or explicitly labelled sample.
