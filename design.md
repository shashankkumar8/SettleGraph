---
name: "SettleGraph — Merchant Finance Workspace"
description: "Evidence-first merchant finance operations for settlement reconciliation, payment exceptions, dispute evidence and vendor workflows. Independent product; Paytm-inspired visual direction only."
colors:
  primary: "#00baf2"
  primary-hover: "#009acb"
  background: "#f5f7f9"
  surface: "#ffffff"
  text: "#17191c"
  heading: "#505050"
  muted: "#68737d"
  border: "rgba(15, 15, 15, 0.13)"
typography:
  heading-1:
    fontFamily: "Inter"
    fontFamilyStack: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 700
  heading-2:
    fontFamily: "Inter"
    fontFamilyStack: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  heading-3:
    fontFamily: "Inter"
    fontFamilyStack: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 700
  body:
    fontFamily: "Inter"
    fontFamilyStack: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "8px"
  button: "8px"
  card: "8px"
  pill: "18px"
spacing:
  scale: ["8px", "10px", "12px", "14px", "16px", "20px", "24px", "35px"]
components:
  button:
    primary:
      background: "#00baf2"
      hover: "#009acb"
      color: "#ffffff"
      radius: "8px"
      padding: "8px 12px"
      fontSize: "10px"
      fontWeight: 700
  card:
    background: "#ffffff"
    color: "#17191c"
    radius: "8px"
    padding: "15px"
    border: "1px solid rgba(15, 15, 15, 0.13)"
  link:
    color: "#009acb"
    textDecoration: "none"
    fontWeight: 600
  status:
    success: "#16864b"
    warning: "#976300"
    danger: "#c73737"
layout:
  sidebarWidth: "248px"
  contentMaxWidth: "1760px"
  breakpoints: ["1180px", "900px", "680px"]
productRules:
  independentBrand: true
  displayHackathonTeamOrTrackInApplication: false
  displayPaytmLogoOrClaimAffiliation: false
  syntheticDataMustBeLabelled: true
  aiMayNotCalculateOrAuthorizeMoneyMovement: true
---

## Overview

SettleGraph is an independent merchant-finance workspace. It brings settlement records, bank credits, adjustments, payment references, order evidence and vendor exceptions into source-linked operational workflows. The visual language is inspired by the supplied Paytm palette and compact information density, but the product must never imply that it is an official Paytm application or use Paytm's logo or proprietary assets.

## Visual direction

- White application shell and navigation against a very light cool-gray canvas.
- Paytm blue (`#00baf2`) for primary actions, active navigation, links and key highlights.
- Black/dark-neutral body text and `#505050` headings; avoid low-contrast pale gray text for important information.
- Compact, clear Inter typography. Use 20px for the page title, 16px for section headings, 12px for panel headings and around 11px for dense dashboard body copy. Warnings and legal notices must remain comfortably readable.
- Flat white cards with a thin neutral border, 8px radius and very restrained shadow. Avoid dark gradients, glassmorphism, excessive rounded pills or oversized hero sections.
- Present financial amounts and residuals as the strongest visual hierarchy. Tables must expose batch/reference/source information without visual clutter.

## Interaction and accessibility

- Every visible action must be connected to a real UI or API operation. Use explicit loading, disabled, error, success, not-tested, synthetic, imported, staged and mock states.
- A configured key is not proof of a working connection. Show the most recent provider test and timestamp.
- Use text labels in addition to status colours. Provide keyboard focus rings, accessible names, labelled inputs, semantic tables and reduced-motion support.
- At 1180px and below, compact the navigation and columns; at 900px, move to a collapsible/stacked layout; at 680px and below, use a mobile navigation strip and horizontally scrollable tables. Support 320px width without page-level horizontal overflow.

## Financial and AI boundaries

- Monetary calculations are made by the backend using integer paise. The browser formats backend-provided values only.
- Settlement batch membership requires explicit source references or an operator-confirmed mapping; timestamp similarity and amount coincidence are not sufficient.
- Unknown/missing evidence stays unknown. Missing UTR is not a fraud verdict, and payment success is not proof of delivery.
- SHA-256 and Merkle proofs provide integrity relative to captured inputs, not source authenticity or legal truth.
- Sarvam ASR output is untrusted input and must be confirmed against source records. AI tools are allow-listed and read-only. Models cannot calculate financial values, approve a refund or move money.
- Synthetic examples and mock integrations must be visibly labelled. No live provider connection may be claimed until a successful provider test has been recorded.
