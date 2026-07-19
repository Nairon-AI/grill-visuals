/*
 * Grill Visuals UI tokens, component anatomy, and motion values.
 */
export function visualSystemStyles() {
  return `<style>
    @font-face {
      font-family: "Inter Variable";
      src: url("./InterVariable.woff2") format("woff2");
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
    }
    @font-face {
      font-family: "Inter Variable";
      src: url("./InterVariable-Italic.woff2") format("woff2");
      font-style: italic;
      font-weight: 100 900;
      font-display: swap;
    }
    :root {
      color-scheme: dark;
      --background: oklch(0.17 0 0);
      --foreground: oklch(0.985 0 0);
      --card: oklch(0.205 0 0);
      --card-foreground: oklch(0.985 0 0);
      --muted-surface: oklch(0.269 0 0);
      --muted-foreground: oklch(0.708 0 0);
      --border: oklch(1 0 0 / 10%);
      --ring: oklch(0.556 0 0);
      --brand: #f97316;
      --focus: var(--ring);
      --custom-shadow: inset 0 1px 0 0 rgba(255,255,255,.03), inset 0 0 0 1px rgba(255,255,255,.03), 0 0 0 1px rgba(0,0,0,.1), 0 2px 2px 0 rgba(0,0,0,.1), 0 4px 4px 0 rgba(0,0,0,.1), 0 8px 8px 0 rgba(0,0,0,.1);
      --custom-outline-shadow: inset 0 1px 0 0 rgba(255,255,255,.05), inset 0 0 0 1px rgba(255,255,255,.045), 0 0 0 1px rgba(0,0,0,.14), 0 1px 2px -1px rgba(0,0,0,.14), 0 2px 4px 0 rgba(0,0,0,.08);
      --ink: var(--foreground);
      --canvas: var(--background);
      --card-soft: color-mix(in oklab, var(--card) 70%, transparent);
      --line: var(--border);
      --line-strong: oklch(1 0 0 / 15%);
      --route: color-mix(in oklab, var(--background) 70%, var(--muted-foreground) 30%);
      --route-focus: var(--route);
      --shadow: var(--custom-shadow);
      --body: "Inter Variable", Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --mono: "SFMono-Regular", Consolas, monospace;
    }
    :root[data-theme="light"] {
      color-scheme: light;
      --background: oklch(0.995 0 0);
      --foreground: oklch(0.145 0 0);
      --card: oklch(1 0 0);
      --card-foreground: oklch(0.145 0 0);
      --muted-surface: oklch(0.97 0 0);
      --muted-foreground: oklch(0.556 0 0);
      --border: oklch(0.922 0 0);
      --ring: oklch(0.708 0 0);
      --custom-shadow: 0 0 0 1px rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.06), 0 2px 4px 0 rgba(0,0,0,.04);
      --custom-outline-shadow: 0 0 0 1px rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.06), 0 2px 4px 0 rgba(0,0,0,.04);
      --line-strong: oklch(0.86 0 0);
    }

    button:focus-visible, summary:focus-visible, svg:focus-visible { outline: none; box-shadow: 0 0 0 1.5px color-mix(in oklab, var(--ring) 50%, transparent); }
    .app-shell { background: var(--background); }
    :root[data-theme="light"] .app-shell { background: oklch(0.97 0 0); }
    .graph-stage {
      background: linear-gradient(color-mix(in oklab,var(--border) 10%,transparent) 1px,transparent 1px), linear-gradient(90deg,color-mix(in oklab,var(--border) 10%,transparent) 1px,transparent 1px), var(--background);
      background-position: center;
      background-size: 56px 56px;
    }
    :root[data-theme="light"] .graph-stage {
      background: linear-gradient(color-mix(in oklab,var(--border) 45%,transparent) 1px,transparent 1px), linear-gradient(90deg,color-mix(in oklab,var(--border) 45%,transparent) 1px,transparent 1px), var(--background);
      background-position: center;
      background-size: 56px 56px;
    }

    .brand-pill, .question-rail, .node-popover, .family-popover {
      border: 0;
      color: var(--card-foreground);
      background: var(--card);
      box-shadow: var(--custom-shadow);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
    .floating-dock { width: auto; gap: 16px; }
    .brand-pill { gap: 8px; padding: 10px 16px; transition: opacity .15s; }
    .brand-pill:hover { opacity: .8; }
    .brand-pill .powered-label { color: var(--muted-foreground); font-size: 12px; }
    .brand-pill .brand-lockup { display: flex; align-items: center; gap: 6px; color: var(--foreground); font-size: 14px; }
    .brand-mark { display: block; width: 20px; height: 10px; border-radius: 0; background: none; }
    .brand-pill strong { font-size: 14px; font-weight: 600; letter-spacing: -.02em; }
    .question-rail {
      position: fixed;
      top: 24px;
      left: 50%;
      right: auto;
      z-index: 24;
      width: min(620px, calc(100vw - 720px));
      max-width: calc(100vw - 48px);
      max-height: 76px;
      margin: 0;
      padding: 0;
      overflow: hidden;
      border-radius: 28px;
      corner-shape: squircle;
      transform: translateX(-50%);
      transition: max-height .24s cubic-bezier(.22,1,.36,1), box-shadow .2s ease;
    }
    .rail-head { min-height: 56px; padding: 9px 16px; font-size: 12px; }
    .rail-title { font-size: 15px; font-weight: 500; letter-spacing: -.015em; }
    .session-tabs {
      flex: 1;
      max-height: 0;
      gap: 4px;
      padding: 0 12px;
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
      mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 18px), transparent 100%);
      transition: max-height .22s cubic-bezier(.22,1,.36,1), padding .22s cubic-bezier(.22,1,.36,1), opacity .14s ease, visibility .14s ease;
    }
    .question-rail[data-expanded="true"] {
      max-height: min(76dvh, 680px);
    }
    .question-rail[data-expanded="true"] .rail-chevron { transform: rotate(180deg); }
    .question-rail[data-expanded="true"] .session-tabs {
      max-height: min(54dvh, 460px);
      padding-bottom: 12px;
      visibility: visible;
      opacity: 1;
      pointer-events: auto;
    }
    .question-rail[data-expanded="true"] .rail-context {
      max-height: 190px;
      padding-top: 12px;
      padding-bottom: 18px;
      visibility: visible;
      opacity: 1;
      border-top-color: var(--border);
    }
    .session-tab { grid-template-columns: 24px minmax(0,1fr) auto auto; gap: 8px; min-height: 40px; padding: 8px; border-radius: 16px; transition: all .15s; }
    .session-tab:hover { color: var(--foreground); background: var(--muted-surface); }
    .session-tab[aria-selected="true"] { color: var(--foreground); background: var(--muted-surface); }
    .session-tab:active { transform: scale(.97); }
    .tab-copy { font-size: 14px; font-weight: 500; }

    .floating-actions { position: fixed; top: 24px; right: 24px; z-index: 20; display: flex; gap: 8px; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; backdrop-filter: none; }
    .floating-actions button, .viewer-button {
      display: inline-flex;
      min-width: 32px;
      height: 32px;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 0 12px;
      border: 0;
      border-radius: 999px;
      color: var(--foreground);
      background: var(--background);
      box-shadow: var(--custom-outline-shadow);
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      transition: all .2s;
    }
    .floating-actions button:hover, .viewer-button:hover { background: var(--muted-surface); transition-duration: .15s; }
    .floating-actions button:active, .viewer-button:active { transform: scale(.97); }
    .floating-actions button.icon-button { width: 32px; padding: 0; }
    .floating-actions svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .icon-swap { position: relative; display: inline-flex; width: 14px; height: 14px; }
    .icon-swap > svg { position: absolute; inset: 0; }
    .icon-swap.is-swapping > svg { animation: grill-icon-swap .3s cubic-bezier(.22,1,.36,1); }

    .group-wrap { overflow: visible; }
    .group-card { position: relative; width: 100%; height: 100%; border-radius: 32px; corner-shape: squircle; color: var(--card-foreground); background: color-mix(in oklab, var(--card) 50%, transparent); box-shadow: var(--custom-shadow); }
    :root[data-theme="light"] .group-card { background: var(--card); outline: 1px solid rgba(0,0,0,.1); outline-offset: -1px; }
    .group-label { position: absolute; top: 16px; left: 16px; color: var(--muted-foreground); font-size: 10px; font-weight: 500; letter-spacing: .025em; text-transform: uppercase; }

    .edge-wrap { transition: opacity .3s; }
    .edge-wrap.is-dimmed { opacity: .15; }
    .edge-line, .edge-arrow { fill: none; stroke: var(--route); stroke-width: 1.4; stroke-linecap: round; }
    .edge-line { stroke-dasharray: 1; stroke-dashoffset: 1; }
    .edge-arrow { stroke-linejoin: round; }
    .edge-comet { opacity: 0; pointer-events: none; transition: opacity .25s ease; }
    .edge-comet line { stroke-width: 3; stroke-linecap: round; filter: drop-shadow(0 0 5px currentColor); }
    .edge-label { transition: opacity .3s; }
    .edge-label.is-kind-only { display: none; }
    .edge-label.is-kind-only.is-visible { display: block; opacity: 1; }
    .edge-label rect { fill: var(--background); }
    .edge-label text { fill: color-mix(in oklab, var(--muted-foreground) 80%, transparent); font: 12px/1 var(--body); }

    .family-map foreignObject, .node-object { overflow: visible; }
    .node-object { transform-box: fill-box; transform-origin: center; }
    [data-motion-enter="node"] { opacity: 0; filter: blur(6px); transform: scale(.85); transform-box: fill-box; transform-origin: center; }
    [data-motion-enter="group"], [data-motion-enter="fade"], [data-motion-enter="edge"] { opacity: 0; }
    [data-motion-enter="edge"] { stroke-dasharray: 1; stroke-dashoffset: 1; }
    .node-frame { padding: 0; }
    .node-card, .sequence-participant, .state-card, .mind-card, .timeline-card {
      border: 0;
      border-radius: 24px;
      corner-shape: squircle;
      color: var(--card-foreground);
      background: var(--card);
      box-shadow: var(--custom-shadow);
      transition: opacity .3s;
    }
    :root[data-theme="light"] .node-card, :root[data-theme="light"] .sequence-participant, :root[data-theme="light"] .state-card, :root[data-theme="light"] .mind-card, :root[data-theme="light"] .timeline-card { outline: 1px solid var(--border); outline-offset: -1px; }
    .node-card.is-dimmed, .sequence-participant.is-dimmed, .state-card.is-dimmed, .mind-object.is-dimmed .mind-card, .timeline-event.is-dimmed .timeline-card { opacity: .25; }
    .diagram-panel.has-kind-focus .node-card, .diagram-panel.has-kind-focus .edge-wrap, .diagram-panel.has-kind-focus .group-wrap { opacity: 1 !important; }
    .diagram-panel.has-kind-focus .node-card.is-dimmed { opacity: .15 !important; }
    .diagram-panel.has-kind-focus .edge-wrap.is-dimmed, .diagram-panel.has-kind-focus .group-wrap.is-dimmed { opacity: .1 !important; }
    .node-head { min-height: 68px; gap: 12px; padding: 14px 18px; }
    .node-glyph { width: 28px; height: 28px; border-radius: 16px; }
    .node-glyph svg { width: 16px; height: 16px; }
    .node-copy { gap: 4px; padding-block: 1px; }
    .node-copy strong { font-size: 14px; font-weight: 500; line-height: 1.375; }
    .node-copy > span { color: var(--muted-foreground); font-size: 12px; line-height: 1.5; }
    .node-rows { gap: 10px; margin: 0 18px; padding: 14px 0 16px; border-color: var(--muted-surface); }
    .node-row { gap: 7px; color: var(--foreground); font-size: 12px; font-weight: 500; line-height: 1.5; }
    .beam-hit-ring { position: absolute; inset: 0; border: 1px solid transparent; border-radius: inherit; opacity: 0; pointer-events: none; transition: opacity .5s, border-color .5s; }
    .agent-border-beam { display: none; }
    .node-card[data-kind="agent"] .agent-border-beam { position: absolute; inset: -1px; z-index: 2; display: block; overflow: hidden; border-radius: 24px; corner-shape: squircle; opacity: 0; pointer-events: none; padding: 1px; -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; }
    .node-card[data-kind="agent"] .agent-border-beam::before { position: absolute; inset: -75%; content: ""; background: conic-gradient(from 0deg, transparent 0 75%, #3b82f6 82%, #8b5cf6 88%, #f97316 94%, transparent 100%); animation: grill-border-beam 6s linear infinite; }

    .legend, .quadrant-legend, .answer-options { border: 0; color: var(--card-foreground); background: color-mix(in oklab, var(--card) 70%, transparent); box-shadow: var(--custom-shadow); backdrop-filter: blur(12px); }
    .legend { gap: 16px; padding: 10px 20px; }
    .legend button, .quadrant-legend button { gap: 6px; padding: 0; color: color-mix(in oklab, var(--muted-foreground) 70%, transparent); background: transparent !important; font-size: 10px; font-weight: 500; letter-spacing: .05em; transition: all .2s; }
    .legend button:hover, .legend button.is-active, .quadrant-legend button:hover, .quadrant-legend button[aria-pressed="true"] { color: var(--foreground); }
    .legend i, .quadrant-legend i { display: inline-flex; width: 12px; height: 12px; flex: none; align-items: center; justify-content: center; border-radius: 0; background: transparent; transition: transform .2s; }
    .legend i svg, .quadrant-legend i svg { width: 12px; height: 12px; }
    .legend button.is-active i { transform: scale(1.1); }
    .legend button.is-dimmed { opacity: .4; }

    .node-popover, .family-popover { width: 240px; padding: 16px; border-radius: 12px; animation: grill-popover-in .2s ease-out; }
    .family-popover { right: auto; }
    .popover-kind, .family-popover-kind { display: flex; align-items: center; gap: 4px; color: var(--muted-foreground); font-size: 11px; font-weight: 500; letter-spacing: .025em; text-transform: none; }
    .popover-kind-icon, .popover-kind-icon svg { display: inline-flex; width: 12px; height: 12px; }
    .node-popover h2, .family-popover h2 { margin: 4px 0 0; font-size: 14px; font-weight: 500; }
    .node-popover p, .family-popover p { margin: 4px 0 0; color: var(--muted-foreground); font-size: 12px; line-height: 1.625; }
    .node-popover .popover-detail, .family-popover .family-popover-detail { color: var(--muted-foreground); }
    .node-popover code { margin-top: 6px; color: color-mix(in oklab, var(--muted-foreground) 80%, transparent); font-size: 10px; }

    .sequence-message.is-dimmed, .state-transition.is-dimmed, .mind-edge.is-dimmed, .timeline-event.is-dimmed, .quadrant-point.is-dimmed { opacity: .15; }
    .comparison-board { border: 0; border-radius: 24px; background: var(--card); box-shadow: var(--custom-shadow); backdrop-filter: none; }
    .answer-options { gap: 8px; padding: 10px; }
    .answer-options-label { padding: 0 6px; color: var(--muted-foreground); font-size: 14px; font-weight: 500; letter-spacing: 0; text-transform: none; }
    .answer-option { min-height: 32px; gap: 5px; padding: 0 12px; color: var(--muted-foreground); background: var(--background); box-shadow: var(--custom-outline-shadow); font-size: 14px; font-weight: 500; transition: color .2s, background-color .2s, transform .2s; }
    .answer-option:hover, .answer-option:focus-visible, .answer-option[aria-pressed="true"] { color: var(--foreground); background: var(--muted-surface); }
    .answer-option:active { transform: scale(.97); }
    .answer-option em { padding: 3px 6px; font-size: 9px; font-weight: 600; letter-spacing: 0; text-transform: none; }
    .option-explanation { width: 286px; padding: 16px; border: 0; border-radius: 12px; color: var(--muted-foreground); background: var(--card); box-shadow: var(--custom-shadow); font-size: 12px; line-height: 1.625; transition: opacity .2s, transform .2s, visibility .2s; }
    .option-explanation strong { color: var(--brand); font-size: 10px; font-weight: 500; }

    @keyframes grill-popover-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    @keyframes grill-icon-swap { from { opacity: 0; transform: scale(.25); filter: blur(4px); } to { opacity: 1; transform: scale(1); filter: blur(0); } }
    @keyframes grill-border-beam { to { transform: rotate(1turn); } }

    @media (min-width: 781px) and (max-width: 1279px) {
      .question-rail { top: 76px; width: min(620px, calc(100vw - 48px)); }
    }
    @media (max-width: 780px) {
      .floating-dock { width: auto; }
      .question-rail { top: 64px; width: calc(100vw - 24px); max-width: calc(100vw - 24px); max-height: 92px; border-radius: 24px; }
      .rail-head { min-height: 52px; grid-template-columns: auto minmax(0, 1fr) auto; padding: 8px 12px; }
      .rail-position { display: none; }
      .question-rail[data-expanded="true"] { max-height: min(72dvh, 620px); }
      .question-rail[data-expanded="true"] .session-tabs { max-height: min(47dvh, 400px); }
      .session-tabs { mask-image: none; }
      .answer-options { display: grid; width: calc(100vw - 24px); max-width: calc(100vw - 24px); grid-template-columns: minmax(0, 1fr); overflow: visible; }
      .answer-options-label { display: none; }
      .answer-option { width: 100%; min-width: 0; min-height: 38px; height: auto; justify-content: flex-start; padding-block: 7px; white-space: normal; text-align: left; }
      .answer-option > span:not(.option-explanation) { min-width: 0; overflow-wrap: normal; }
      .answer-option em { flex: none; margin-left: auto; }
      .floating-actions { top: 12px; right: 12px; }
      .floating-actions [data-zoom="out"], .floating-actions [data-zoom="in"] { display: none; }
    }
    @media (max-width: 480px) {
      .context-status { display: none; }
      .rail-head { grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
      .rail-title { font-size: 14px; }
    }
    .question-rail[data-selection-collapsed="true"] { max-height: 76px; }
    .question-rail[data-selection-collapsed="true"] .rail-chevron { transform: none; }
    .question-rail[data-selection-collapsed="true"] .session-tabs {
      max-height: 0;
      padding-bottom: 0;
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
    }
    .question-rail[data-selection-collapsed="true"] .rail-context {
      max-height: 0;
      padding-top: 0;
      padding-bottom: 0;
      visibility: hidden;
      opacity: 0;
      border-top-color: transparent;
    }
    @media (prefers-reduced-motion: reduce) {
      .node-card[data-kind="agent"] .agent-border-beam { opacity: .4; }
      .node-card[data-kind="agent"] .agent-border-beam::before { animation: none; transform: rotate(45deg); }
      .edge-comet { display: none; }
    }
  </style>`;
}
