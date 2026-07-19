/* Browser runtime bundled to dist/browser/viewer.js. */
import type { ArchitectureEdge, ArchitectureNode, FamilyId, TabStatus } from "../types.js";

interface ViewerDocument {
  id: string;
  family: FamilyId;
  title: string;
  summary: string;
  status: TabStatus;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}

interface ViewerSession {
  version: 1;
  session: string;
  logos: Record<string, string>;
  documents: ViewerDocument[];
}

interface CanvasState {
  x: number;
  y: number;
  k: number;
}

interface CanvasController {
  fit: () => void;
  zoomAt: (multiplier: number, clientX?: number, clientY?: number) => void;
  clear: () => void;
}

interface MotionApi {
  animate: (element: Element, keyframes: unknown, options: unknown) => unknown;
}

interface ShareQuestion {
  id: string;
  title: string;
  position: number;
}

interface ShareFinding {
  rule: string;
  question: string;
}

interface ShareChange {
  id: string;
  title: string;
}

interface PublicShareSummary {
  project: string;
  accountId: string | null;
}

interface CloudflareCapability {
  authenticated: boolean;
  error?: string;
  recoveryCommand?: string;
  email?: string | null;
  accounts: Array<{ id: string; name: string }>;
  selectedAccountId: string | null;
  accountLocked?: boolean;
  usage?: { totalProjects: number; limit: number; nearLimit: boolean } | null;
  activeShare?: PublicShareSummary | null;
}

interface ShareCapability {
  canPublish: true;
  csrfToken: string;
  session: string;
  questions: ShareQuestion[];
  privacy: { blocked: ShareFinding[]; warnings: ShareFinding[] };
  changes: { added: ShareChange[]; changed: ShareChange[]; removed: ShareChange[] } | null;
  siteTooLarge: boolean;
  cloudflare: CloudflareCapability;
}

interface ShareResult {
  stableUrl?: string | null;
  immutableUrl?: string | null;
  state?: string;
  error?: string;
}

interface DragState {
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
}

interface CanvasRuntime {
  fit: () => void;
  zoomAt: (multiplier: number, clientX?: number, clientY?: number) => void;
  setClear: (handler: () => void) => void;
  onPaint: (handler: (state: CanvasState) => void) => void;
}

declare global {
  interface Window {
    Motion?: MotionApi;
    __REACT_GRAB_DISABLED__: boolean;
  }

  interface HTMLElement {
    _flashTimer?: number;
  }
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required viewer element: ${selector}`);
  return element;
}

function all<T extends Element>(root: ParentNode, selector: string): T[] {
  return [...root.querySelectorAll<T>(selector)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

(() => {
  "use strict";
  const session = JSON.parse(required<HTMLScriptElement>(document, "#grill-visuals-data").textContent ?? "") as ViewerSession;
  all<HTMLImageElement>(document, "[data-node-logo]").forEach((image) => {
    const logoKey = image.dataset.logoKey;
    const source = logoKey ? session.logos[logoKey] : undefined;
    if (!source) return image.remove();
    image.addEventListener("load", () => image.parentElement?.classList.add("has-logo"), { once: true });
    image.addEventListener("error", () => image.remove(), { once: true });
    image.src = source;
  });
  const documentById = new Map<string, ViewerDocument>(session.documents.map((item) => [item.id, item]));
  const tabs = all<HTMLButtonElement>(document, "[role=tab]");
  const panels = all<HTMLElement>(document, "[role=tabpanel]");
  const controllers = new Map<string, CanvasController>();
  const enteredPanels = new WeakSet<HTMLElement>();
  const actions = required<HTMLElement>(document, ".floating-actions");
  const questionRail = required<HTMLElement>(document, ".question-rail");
  const railHead = required<HTMLButtonElement>(questionRail, ".rail-head");
  let railExpandedBeforePress = false;
  let railPressPointer = "";
  let railCollapsedAt = 0;
  let railSelectionPointer: { x: number; y: number } | null = null;

  function setRailExpanded(expanded: boolean): void {
    questionRail.dataset.expanded = String(expanded);
    railHead.setAttribute("aria-expanded", String(expanded));
  }

  function clearSelectionCollapse(): void {
    delete questionRail.dataset.selectionCollapsed;
    railCollapsedAt = 0;
    railSelectionPointer = null;
  }

  function collapseRailAfterSelection(tab: HTMLButtonElement, keyboard: boolean, event: MouseEvent): void {
    questionRail.dataset.selectionCollapsed = "true";
    railCollapsedAt = performance.now();
    railSelectionPointer = keyboard ? null : { x: event.clientX, y: event.clientY };
    setRailExpanded(false);
    if (keyboard) railHead.focus();
    else tab.blur();
  }

  railHead.addEventListener("pointerdown", (event) => {
    clearSelectionCollapse();
    railExpandedBeforePress = questionRail.dataset.expanded === "true";
    railPressPointer = event.pointerType;
  });
  railHead.addEventListener("click", (event) => {
    clearSelectionCollapse();
    if (event.detail === 0 || (railPressPointer === "mouse" && matchMedia("(hover: hover)").matches)) {
      setRailExpanded(true);
      return;
    }
    const expanded = !railExpandedBeforePress;
    setRailExpanded(expanded);
    if (!expanded) railHead.blur();
  });
  questionRail.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "mouse" || !matchMedia("(hover: hover)").matches) return;
    if (questionRail.dataset.selectionCollapsed === "true") {
      const duringCollapse = performance.now() - railCollapsedAt < 320;
      const samePointer = railSelectionPointer
        ? Math.hypot(event.clientX - railSelectionPointer.x, event.clientY - railSelectionPointer.y) < 16
        : false;
      if (duringCollapse || samePointer) return;
    }
    clearSelectionCollapse();
    setRailExpanded(true);
  });
  questionRail.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    if (!questionRail.matches(":focus-within")) setRailExpanded(false);
  });
  questionRail.addEventListener("focusin", () => {
    if (questionRail.dataset.selectionCollapsed !== "true") setRailExpanded(true);
  });
  questionRail.addEventListener("focusout", () => requestAnimationFrame(() => {
    if (!questionRail.matches(":focus-within") && !questionRail.matches(":hover")) setRailExpanded(false);
  }));
  document.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Node) || !questionRail.contains(event.target)) {
      if (!matchMedia("(hover: hover)").matches) setRailExpanded(false);
    }
  });

  function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)); }
  function currentPanel(): HTMLElement {
    const panel = panels.find((item) => !item.hidden);
    if (!panel) throw new Error("No active diagram panel");
    return panel;
  }

  function finishEntrance(element: HTMLElement | SVGElement, role?: string): void {
    element.style.opacity = "1";
    if (role === "node") {
      element.style.transform = "scale(1)";
      element.style.filter = "blur(0px)";
    }
    if (role === "edge") element.style.strokeDashoffset = "0";
  }

  function playEntrance(panel: HTMLElement): void {
    if (enteredPanels.has(panel)) return;
    enteredPanels.add(panel);
    const elements = all<HTMLElement | SVGElement>(panel, "[data-motion-enter]");
    const motion = window.Motion;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !motion?.animate) {
      elements.forEach((element) => finishEntrance(element, element.dataset.motionEnter));
      if (!reduce && panel.dataset.family === "architecture") {
        initAgentBeams(panel);
        initEdgeComets(panel);
      }
      return;
    }
    elements.forEach((element) => {
      const role = element.dataset.motionEnter;
      const delay = (Number(element.dataset.motionDelay) || 0) / 1000;
      element.dataset.motionStarted = "true";
      let controls;
      if (role === "node") {
        controls = motion.animate(
          element,
          { opacity: [0, 1], scale: [.85, 1], filter: ["blur(6px)", "blur(0px)"] },
          { type: "spring", duration: .55, bounce: .25, delay },
        );
      } else if (role === "group") {
        controls = motion.animate(element, { opacity: [0, 1] }, { duration: .5, delay });
      } else if (role === "edge") {
        controls = motion.animate(
          element,
          { pathLength: [0, 1], opacity: [0, 1] },
          { duration: .6, delay, ease: "easeOut" },
        );
      } else {
        controls = motion.animate(element, { opacity: [0, 1] }, { duration: .3, delay });
      }
      Promise.resolve(controls).then(() => finishEntrance(element, role));
    });
    if (panel.dataset.family === "architecture") {
      initAgentBeams(panel);
      initEdgeComets(panel);
    }
  }

  function activateTab(id: string, moveFocus: boolean): void {
    for (const tab of tabs) {
      const active = tab.dataset.documentId === id;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active) {
        tab.scrollIntoView({ block: "nearest", inline: innerWidth <= 780 ? "center" : "nearest" });
        if (moveFocus) tab.focus();
      }
    }
    for (const panel of panels) panel.hidden = panel.dataset.documentId !== id;
    const activePanel = panels.find((panel) => panel.dataset.documentId === id);
    if (!activePanel) throw new Error(`Missing panel for ${id}`);
    initializePanel(activePanel);
    const activeIndex = tabs.findIndex((tab) => tab.dataset.documentId === id);
    const activeDocument = documentById.get(id);
    required<HTMLElement>(questionRail, "[data-rail-position]").textContent = (activeIndex + 1) + "/" + tabs.length;
    required<HTMLElement>(questionRail, "[data-rail-title]").textContent = activeDocument?.title ?? id;
    required<HTMLElement>(questionRail, "[data-rail-summary]").textContent = activeDocument?.summary ?? "";
    const railStatus = required<HTMLElement>(questionRail, "[data-rail-status]");
    railStatus.dataset.status = activeDocument?.status ?? "current";
    required<HTMLElement>(railStatus, "[data-rail-status-label]").textContent = activeDocument?.status ?? "current";
    actions.classList.toggle("is-static", activePanel.dataset.canvas !== "true");
    if (history.replaceState) history.replaceState(null, "", "#" + id);
    requestAnimationFrame(() => {
      controllers.get(id)?.fit();
      playEntrance(activePanel);
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", (event) => {
      const documentId = tab.dataset.documentId;
      collapseRailAfterSelection(tab, event.detail === 0, event);
      if (documentId) activateTab(documentId, false);
    });
    tab.addEventListener("keydown", (event) => {
      const previous = event.key === "ArrowLeft" || event.key === "ArrowUp";
      const next = event.key === "ArrowRight" || event.key === "ArrowDown";
      if (!previous && !next && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      let target = index;
      if (previous) target = (index - 1 + tabs.length) % tabs.length;
      if (next) target = (index + 1) % tabs.length;
      if (event.key === "Home") target = 0;
      if (event.key === "End") target = tabs.length - 1;
      const targetTab = tabs[target];
      if (targetTab?.dataset.documentId) activateTab(targetTab.dataset.documentId, true);
    });
  });
  window.addEventListener("resize", () => {
    const activeTab = tabs.find((tab) => tab.getAttribute("aria-selected") === "true");
    activeTab?.scrollIntoView({ block: "nearest", inline: innerWidth <= 780 ? "center" : "nearest" });
  });

  const root = document.documentElement;
  const themeButton = required<HTMLButtonElement>(document, "[data-theme-toggle]");
  const themeSwap = required<HTMLElement>(themeButton, ".icon-swap");
  const themeGlyph = required<HTMLElement>(themeButton, ".theme-glyph");
  function replayIconSwap(element: HTMLElement): void {
    element.classList.remove("is-swapping");
    void element.offsetWidth;
    element.classList.add("is-swapping");
  }
  function setTheme(theme: string): void {
    root.dataset.theme = theme;
    themeButton.setAttribute("aria-label", theme === "dark" ? "Use light theme" : "Use dark theme");
    themeGlyph.innerHTML = theme === "dark"
      ? '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path>'
      : '<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"></path>';
    replayIconSwap(themeSwap);
    try { localStorage.setItem("grill-visuals-theme", theme); } catch {}
  }
  let storedTheme = null;
  try { storedTheme = localStorage.getItem("grill-visuals-theme"); } catch {}
  setTheme(storedTheme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  themeButton.addEventListener("click", () => setTheme(root.dataset.theme === "dark" ? "light" : "dark"));

  async function copyText(value: string): Promise<void> {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }

  const shareButton = required<HTMLButtonElement>(document, "[data-share]");
  const shareDialog = required<HTMLDialogElement>(document, "[data-share-dialog]");
  const shareConfirm = required<HTMLButtonElement>(shareDialog, "[data-share-confirm]");
  const shareCancel = required<HTMLButtonElement>(shareDialog, "[data-share-cancel]");
  const shareIntro = required<HTMLElement>(shareDialog, "[data-share-intro]");
  const shareResult = required<HTMLElement>(shareDialog, "[data-share-result]");
  const shareStatus = required<HTMLElement>(shareDialog, "[data-share-status]");
  const shareCommand = required<HTMLElement>(shareDialog, "[data-share-command]");
  const shareCommandWrap = required<HTMLElement>(shareDialog, "[data-share-command-wrap]");
  const localShare = required<HTMLElement>(shareDialog, "[data-local-share]");
  const accountSelect = required<HTMLSelectElement>(shareDialog, "[data-share-account]");
  const warningReview = required<HTMLInputElement>(shareDialog, "[data-share-reviewed]");
  const verifyButton = required<HTMLButtonElement>(shareDialog, "[data-share-verify]");
  const resultUnshare = required<HTMLButtonElement>(shareDialog, "[data-share-result-unshare]");
  const manageUnshare = required<HTMLButtonElement>(shareDialog, "[data-share-unshare]");
  const isPublicPage = location.protocol === "https:" && location.hostname.endsWith(".pages.dev");
  const shareButtonLabel = required<HTMLElement>(shareButton, "[data-share-label]");
  if (isPublicPage) {
    shareButtonLabel.textContent = "Share";
    shareButton.setAttribute("aria-label", "Share");
    shareButton.title = "Share this public session";
  }
  let shareCapability: ShareCapability | null = null;
  let shareBusy = false;
  let unshareArmed = false;

  async function loadShareCapability(): Promise<ShareCapability | null> {
    if (!/^https?:$/.test(location.protocol) || isPublicPage) return null;
    try {
      const response = await fetch("/__grill-visuals/capabilities", { cache: "no-store" });
      const capability: unknown = await response.json();
      return response.ok
        && isRecord(capability)
        && capability.canPublish === true
        && capability.session === session.session
        ? capability as unknown as ShareCapability
        : null;
    } catch {}
    return null;
  }

  function currentDocument(): ViewerDocument {
    const model = documentById.get(currentPanel().dataset.documentId ?? "");
    if (!model) throw new Error("No active diagram document");
    return model;
  }

  function fallbackOpenCommand(): string {
    return "grill-visuals open --session " + session.session;
  }

  function setShareStatus(message: string, error = false): void {
    shareStatus.textContent = message;
    shareStatus.style.color = error ? "#e86b61" : "var(--muted-foreground)";
    shareStatus.hidden = !message;
  }

  function replaceList(element: HTMLElement, values: string[]): void {
    element.replaceChildren(...values.map((value) => {
      const item = document.createElement("li");
      item.textContent = value;
      return item;
    }));
  }

  function syncPublishEnabled(): void {
    if (shareConfirm.dataset.mode !== "publish") return;
    if (!shareCapability) return;
    const report = shareCapability.privacy;
    shareConfirm.disabled = shareBusy
      || report.blocked.length > 0
      || shareCapability.siteTooLarge
      || !accountSelect.value
      || (report.warnings.length > 0 && !warningReview.checked);
  }

  function resetShareDialog(model: ViewerDocument): void {
    unshareArmed = false;
    shareIntro.hidden = false;
    shareResult.hidden = true;
    setShareStatus("");
    shareConfirm.hidden = false;
    shareConfirm.disabled = false;
    shareCancel.textContent = "Cancel";
    verifyButton.hidden = true;
    resultUnshare.hidden = true;
    manageUnshare.textContent = "Unshare…";

    if (isPublicPage) {
      localShare.hidden = true;
      shareCommandWrap.hidden = true;
      required<HTMLElement>(shareDialog, "[data-share-title]").textContent = "Share this public link?";
      required<HTMLElement>(shareDialog, "[data-share-description]").textContent = "Share the exact question currently open.";
      shareConfirm.dataset.mode = "public";
      shareConfirm.textContent = "Share link";
      return;
    }

    if (!shareCapability) {
      localShare.hidden = true;
      shareCommandWrap.hidden = false;
      shareCommand.textContent = fallbackOpenCommand();
      required<HTMLElement>(shareDialog, "[data-share-title]").textContent = "Publishing is unavailable in this preview";
      required<HTMLElement>(shareDialog, "[data-share-description]").textContent = "This is a static preview. Open the same session with Grill Visuals, then Publish will confirm and create or update its public Cloudflare Pages link.";
      shareConfirm.dataset.mode = "serve";
      shareConfirm.textContent = "Copy open command";
      return;
    }

    const cloudflare = shareCapability.cloudflare;
    localShare.hidden = false;
    const questions = shareCapability.questions;
    const activeIndex = questions.findIndex((question) => question.id === model.id);
    required<HTMLElement>(shareDialog, "[data-share-scope]").textContent = "All " + questions.length + " questions";
    required<HTMLElement>(shareDialog, "[data-share-question]").textContent = (activeIndex + 1) + "/" + questions.length + " · " + model.title;
    required<HTMLElement>(shareDialog, "[data-share-review-label]").textContent = "Review all " + questions.length + " questions";
    replaceList(required<HTMLElement>(shareDialog, "[data-share-question-list]"), questions.map((question) => question.position + ". " + question.title));

    const activeShare = cloudflare.activeShare;
    const changes = shareCapability.changes;
    const changeCount = changes ? changes.added.length + changes.changed.length + changes.removed.length : 0;
    const changesBlock = required<HTMLElement>(shareDialog, "[data-share-changes]");
    changesBlock.hidden = !activeShare;
    if (activeShare) {
      required<HTMLElement>(shareDialog, "[data-share-change-label]").textContent = changes
        ? changes.added.length + " added · " + changes.changed.length + " changed · " + changes.removed.length + " removed"
        : "Earlier upload predates change tracking";
      replaceList(required<HTMLElement>(shareDialog, "[data-share-change-list]"), changes ? [
          ...changes.added.map((item) => "Added — " + item.title),
          ...changes.changed.map((item) => "Changed — " + item.title),
          ...changes.removed.map((item) => "Removed — " + item.title),
          ...(changeCount === 0 ? ["No question content changed since the last upload."] : []),
        ] : ["The next confirmed upload becomes the baseline for later change summaries."]);
    }

    accountSelect.replaceChildren();
    if (cloudflare.accounts.length > 1 && !cloudflare.selectedAccountId) {
      const prompt = document.createElement("option");
      prompt.value = "";
      prompt.textContent = "Choose an account…";
      accountSelect.append(prompt);
    }
    cloudflare.accounts.forEach((account) => {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = account.name;
      option.selected = account.id === cloudflare.selectedAccountId;
      accountSelect.append(option);
    });
    accountSelect.disabled = Boolean(cloudflare.accountLocked);
    const usage = cloudflare.usage;
    required<HTMLElement>(shareDialog, "[data-share-account-usage]").textContent = usage
      ? usage.totalProjects + "/" + usage.limit + " Pages projects" + (usage.nearLimit ? " · cleanup recommended" : "")
      : cloudflare.email ?? "";

    const blocked = shareCapability.privacy.blocked;
    const warnings = shareCapability.privacy.warnings;
    const blockedBox = required<HTMLElement>(shareDialog, "[data-share-blocked]");
    const warningsBox = required<HTMLElement>(shareDialog, "[data-share-warnings]");
    blockedBox.hidden = blocked.length === 0 && !shareCapability.siteTooLarge;
    required<HTMLElement>(shareDialog, "[data-share-blocked-copy]").textContent = shareCapability.siteTooLarge
      ? "This page is larger than Cloudflare's 25 MiB asset limit. Reduce the session before publishing."
      : blocked.map((item) => item.rule + " in " + item.question).join("; ");
    warningsBox.hidden = warnings.length === 0;
    required<HTMLElement>(shareDialog, "[data-share-warning-copy]").textContent = warnings.map((item) => item.rule + " in " + item.question).join("; ");
    required<HTMLElement>(shareDialog, "[data-share-warning-check]").hidden = warnings.length === 0;
    warningReview.checked = false;

    const manage = required<HTMLElement>(shareDialog, "[data-share-manage]");
    manage.hidden = !activeShare;
    if (activeShare) required<HTMLElement>(shareDialog, "[data-share-manage-copy]").textContent = "Public project: " + activeShare.project;

    if (!cloudflare.authenticated) {
      shareCommandWrap.hidden = false;
      shareCommand.textContent = cloudflare.recoveryCommand || "npx wrangler login";
      required<HTMLElement>(shareDialog, "[data-share-title]").textContent = "Cloudflare login needed";
      required<HTMLElement>(shareDialog, "[data-share-description]").textContent = cloudflare.error ?? "Cloudflare login required";
      shareConfirm.dataset.mode = "login";
      shareConfirm.textContent = "Copy login command";
      return;
    }

    shareCommandWrap.hidden = true;
    required<HTMLElement>(shareDialog, "[data-share-title]").textContent = activeShare ? "Update this public session?" : "Make this session public?";
    required<HTMLElement>(shareDialog, "[data-share-description]").textContent = activeShare
      ? "Only this confirmed upload changes the stable public page."
      : "This creates one isolated Cloudflare Pages project for the whole session.";
    shareConfirm.dataset.mode = "publish";
    shareConfirm.textContent = activeShare ? "Update public page" : "Publish publicly";
    syncPublishEnabled();
  }

  function showShareResult(result: ShareResult, title = result.state === "unverified" ? "May already be public" : "Published"): void {
    shareIntro.hidden = true;
    shareResult.hidden = false;
    shareConfirm.hidden = true;
    shareCancel.textContent = "Done";
    required<HTMLElement>(shareDialog, "[data-share-title]").textContent = title;
    required<HTMLElement>(shareDialog, "[data-share-result-copy]").textContent = result.state === "unverified"
      ? "Cloudflare accepted the upload, but both links are not verified yet. Treat it as public until reconciled."
      : "The stable link follows future confirmed updates. The exact-version link never changes.";
    const stable = required<HTMLAnchorElement>(shareDialog, "[data-share-stable]");
    const immutable = required<HTMLAnchorElement>(shareDialog, "[data-share-immutable]");
    stable.hidden = !result.stableUrl;
    stable.href = result.stableUrl || "";
    required<HTMLElement>(stable, "strong").textContent = result.stableUrl || "";
    immutable.hidden = !result.immutableUrl;
    if (result.immutableUrl) {
      immutable.href = result.immutableUrl;
      required<HTMLElement>(immutable, "strong").textContent = result.immutableUrl;
    }
    verifyButton.hidden = result.state !== "unverified";
    resultUnshare.hidden = !shareCapability;
  }

  shareButton.addEventListener("click", async () => {
    const model = currentDocument();
    shareCapability = null;
    resetShareDialog(model);
    if (!isPublicPage) {
      required<HTMLElement>(shareDialog, "[data-share-title]").textContent = "Checking share details…";
      required<HTMLElement>(shareDialog, "[data-share-description]").textContent = "Checking Cloudflare account, public scope, and privacy findings.";
      localShare.hidden = true;
      shareCommandWrap.hidden = true;
      shareConfirm.hidden = true;
    }
    shareDialog.showModal();
    if (!isPublicPage) {
      shareCapability = await loadShareCapability();
      resetShareDialog(model);
    }
  });
  all<HTMLButtonElement>(shareDialog, "[data-share-close]").forEach((button) => button.addEventListener("click", () => { if (!shareBusy) shareDialog.close(); }));
  shareDialog.addEventListener("click", (event) => { if (event.target === shareDialog && !shareBusy) shareDialog.close(); });
  accountSelect.addEventListener("change", syncPublishEnabled);
  warningReview.addEventListener("change", syncPublishEnabled);

  async function postLocal(path: string, body: Record<string, unknown> = {}): Promise<ShareResult> {
    if (!shareCapability) throw new Error("Publishing capability is unavailable");
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Grill-Visuals-Token": shareCapability.csrfToken },
      body: JSON.stringify(body),
    });
    const result: unknown = await response.json();
    if (!isRecord(result)) throw new Error("Public-share operation returned invalid data");
    if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Public-share operation failed");
    return result as ShareResult;
  }

  function setShareBusy(busy: boolean, label?: string): void {
    shareBusy = busy;
    shareConfirm.disabled = busy;
    all<HTMLButtonElement>(shareDialog, "[data-share-close]").forEach((button) => { button.disabled = busy; });
    if (busy && label) shareConfirm.textContent = label;
  }

  shareConfirm.addEventListener("click", async () => {
    const model = currentDocument();
    if (shareConfirm.dataset.mode === "public") {
      try {
        if (navigator.share) await navigator.share({ title: model.title, url: location.href });
        else await copyText(location.href);
        showShareResult({ stableUrl: location.href }, "Link ready");
      } catch (error) {
        if (!(isRecord(error) && error.name === "AbortError")) {
          shareStatus.textContent = "Could not share this link. Copy it from the address bar instead.";
          shareStatus.hidden = false;
        }
      }
      return;
    }
    if (shareConfirm.dataset.mode === "serve" || shareConfirm.dataset.mode === "login") {
      await copyText(shareCommand.textContent ?? "");
      setShareStatus(shareConfirm.dataset.mode === "serve"
        ? "Open command copied. Run it in this project, then use the new local URL."
        : "Login command copied. Run it, then close and reopen Share.");
      shareConfirm.textContent = "Copied";
      return;
    }
    if (shareConfirm.dataset.mode !== "publish") return;
    setShareBusy(true, "Publishing…");
    setShareStatus("");
    try {
      const result = await postLocal("/__grill-visuals/share", {
        question: model.id,
        accountId: accountSelect.value,
        reviewedWarnings: warningReview.checked,
      });
      showShareResult(result);
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : "Public share failed", true);
      shareConfirm.textContent = "Try again";
    } finally {
      setShareBusy(false);
      syncPublishEnabled();
    }
  });
  required<HTMLButtonElement>(shareDialog, "[data-share-copy-result]").addEventListener("click", async () => {
    const link = required<HTMLAnchorElement>(shareDialog, "[data-share-stable]").href;
    await copyText(link);
    required<HTMLButtonElement>(shareDialog, "[data-share-copy-result]").textContent = "Copied";
  });

  async function verifyPublicShare(): Promise<void> {
    setShareStatus("Checking both public links…");
    try {
      const result = await postLocal("/__grill-visuals/verify");
      showShareResult(result);
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : "Verification failed", true);
    }
  }
  verifyButton.addEventListener("click", verifyPublicShare);

  async function requestUnshare(button: HTMLButtonElement): Promise<void> {
    if (!unshareArmed) {
      unshareArmed = true;
      button.textContent = "Confirm unshare";
      setShareStatus("This permanently removes the exact public Pages project. Click Confirm unshare to continue.", true);
      return;
    }
    button.disabled = true;
    setShareStatus("Removing and verifying the public page…");
    try {
      await postLocal("/__grill-visuals/unshare");
      shareIntro.hidden = true;
      shareResult.hidden = true;
      shareConfirm.hidden = true;
      shareCancel.textContent = "Done";
      required<HTMLElement>(shareDialog, "[data-share-title]").textContent = "Public page removed";
      setShareStatus("Cloudflare no longer serves this Grill Visuals session.");
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : "Unshare failed", true);
      button.disabled = false;
      button.textContent = "Try unshare again";
    }
  }
  manageUnshare.addEventListener("click", () => requestUnshare(manageUnshare));
  resultUnshare.addEventListener("click", () => requestUnshare(resultUnshare));

  function createCanvas(panel: HTMLElement): CanvasRuntime {
    const stage = panel.querySelector<HTMLElement>("[data-stage]");
    const svg = panel.querySelector<HTMLElement | SVGElement>("[data-graph]");
    const viewport = panel.querySelector<HTMLElement | SVGElement>("[data-viewport]");
    if (!stage || !svg || !viewport) {
      return { fit() {}, zoomAt() {}, setClear(_handler) {}, onPaint(_handler) {} };
    }
    const canvasStage = stage;
    const graph = svg;
    const graphViewport = viewport;
    const state: CanvasState & { drag: DragState | null } = { x: 0, y: 0, k: 1, drag: null };
    let clearHandler = () => {};
    const paintHandlers = new Set<(state: CanvasState) => void>();
    let idleTimer: number | null = null;

    function paintTransform(): void {
      graphViewport.style.willChange = "transform";
      graphViewport.style.transform = "translate(" + state.x + "px," + state.y + "px) scale(" + state.k + ")";
      paintHandlers.forEach((handler) => handler(state));
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { graphViewport.style.willChange = "auto"; }, 150);
    }

    function fit() {
      const width = canvasStage.clientWidth;
      const height = canvasStage.clientHeight;
      if (!width || !height) return;
      const graphWidth = Number(graph.dataset.width) || graphViewport.scrollWidth || (graphViewport instanceof HTMLElement ? graphViewport.offsetWidth : 0);
      const graphHeight = Number(graph.dataset.height) || graphViewport.scrollHeight || (graphViewport instanceof HTMLElement ? graphViewport.offsetHeight : 0);
      if (!graphWidth || !graphHeight) return;
      const compact = width <= 780;
      const selectorHead = questionRail.querySelector(".rail-head");
      const bottomOverlays = [
        panel.querySelector(".answer-options"),
        panel.querySelector(".legend"),
        panel.querySelector(".quadrant-legend"),
      ].filter((element): element is Element => Boolean(element?.getClientRects().length));
      const selectorHeadBox = selectorHead?.getBoundingClientRect();
      const bottomStart = bottomOverlays.length
        ? Math.min(...bottomOverlays.map((element) => element.getBoundingClientRect().top))
        : height;
      const padLeft = compact ? 24 : 48;
      const padRight = compact ? 24 : 48;
      const padTop = Math.max(compact ? 24 : 56, selectorHeadBox?.bottom ?? 0) + 16;
      const padBottom = Math.max(compact ? 20 : 56, height - bottomStart + 12);
      const availableWidth = Math.max(96, width - padLeft - padRight);
      const availableHeight = Math.max(96, height - padTop - padBottom);
      const fitScale = Math.min(availableWidth / graphWidth, availableHeight / graphHeight);
      const preserveWholeDiagram = panel.dataset.family === "quadrant";
      if (fitScale >= .45 || preserveWholeDiagram) {
        state.k = clamp(fitScale, preserveWholeDiagram ? .2 : .3, 1);
        state.x = padLeft + (availableWidth - graphWidth * state.k) / 2;
        state.y = padTop + (availableHeight - graphHeight * state.k) / 2;
      } else {
        // Open long flows at a useful scale; Fit still reveals full topology.
        state.k = clamp((availableHeight / graphHeight) * .9, .5, .8);
        state.x = padLeft + 16;
        state.y = padTop + (availableHeight - graphHeight * state.k) / 2;
      }
      paintTransform();
    }

    function zoomAt(multiplier: number, clientX = canvasStage.clientWidth / 2, clientY = canvasStage.clientHeight / 2): void {
      const next = clamp(state.k * multiplier, .08, 3);
      const ratio = next / state.k;
      state.x = clientX - (clientX - state.x) * ratio;
      state.y = clientY - (clientY - state.y) * ratio;
      state.k = next;
      paintTransform();
    }

    canvasStage.addEventListener("wheel", (event) => {
      event.preventDefault();
      if (event.ctrlKey) {
        const rect = canvasStage.getBoundingClientRect();
        zoomAt(Math.exp(-event.deltaY * .012), event.clientX - rect.left, event.clientY - rect.top);
      } else {
        state.x -= event.deltaX;
        state.y -= event.deltaY;
        paintTransform();
      }
    }, { passive: false });

    canvasStage.addEventListener("pointerdown", (event) => {
      if (event.target instanceof Element && event.target.closest("button")) return;
      canvasStage.setPointerCapture?.(event.pointerId);
      state.drag = { startX: event.clientX, startY: event.clientY, x: state.x, y: state.y, moved: false };
      canvasStage.classList.add("is-dragging");
    });
    canvasStage.addEventListener("pointermove", (event) => {
      if (!state.drag) return;
      if (Math.hypot(event.clientX - state.drag.startX, event.clientY - state.drag.startY) > 4) state.drag.moved = true;
      state.x = state.drag.x + event.clientX - state.drag.startX;
      state.y = state.drag.y + event.clientY - state.drag.startY;
      paintTransform();
    });
    function endDrag(): void {
      if (state.drag && !state.drag.moved) clearHandler();
      state.drag = null;
      canvasStage.classList.remove("is-dragging");
    }
    canvasStage.addEventListener("pointerup", endDrag);
    canvasStage.addEventListener("pointercancel", endDrag);

    window.addEventListener("resize", () => { if (!panel.hidden) fit(); });
    return {
      fit,
      zoomAt,
      setClear(handler: () => void) { clearHandler = handler; },
      onPaint(handler: (state: CanvasState) => void) { paintHandlers.add(handler); },
    };
  }

  function showFamilyInspector(panel: HTMLElement, source: HTMLElement | SVGElement | null): void {
    const popover = panel.querySelector<HTMLElement>(".family-popover");
    if (!popover || !source) return;
    popover.hidden = false;
    required<HTMLElement>(popover, ".family-popover-kind").textContent = source.dataset.inspectKind || "Detail";
    required<HTMLElement>(popover, "h2").textContent = source.dataset.inspectTitle || "";
    required<HTMLElement>(popover, ".family-popover-description").textContent = source.dataset.inspectDescription || "";
    const detail = required<HTMLElement>(popover, ".family-popover-detail");
    detail.textContent = source.dataset.inspectDetail || "";
    detail.hidden = !source.dataset.inspectDetail;
    const box = source.getBoundingClientRect();
    popover.style.left = clamp(box.left, 12, innerWidth - 252) + "px";
    popover.style.top = clamp(box.bottom + 10, 12, innerHeight - popover.offsetHeight - 12) + "px";
  }

  function closeFamilyInspector(panel: HTMLElement): void {
    const popover = panel.querySelector<HTMLElement>(".family-popover");
    if (popover) popover.hidden = true;
  }

  function initAgentBeams(panel: HTMLElement): void {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    all<HTMLElement>(panel, ".agent-border-beam").forEach((beam) => {
      const node = beam.closest<HTMLElement>(".node-object");
      if (!node) return;
      const entranceDelay = Number(node.dataset.motionDelay) || 0;
      setTimeout(() => {
        let strength = 0;
        const interval = setInterval(() => {
          strength = Math.min(.4, Number((strength + .02).toFixed(3)));
          beam.style.opacity = String(strength);
          if (strength >= .4) clearInterval(interval);
        }, 16);
      }, entranceDelay + 700 + Math.random() * 4000);
    });
  }

  function initEdgeComets(panel: HTMLElement): void {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    all<SVGGraphicsElement>(panel, ".edge-comet").forEach((comet) => {
      const path = comet.parentElement?.querySelector<SVGPathElement>(".edge-line");
      if (!path) return;
      const edgePath = path;
      const length = Number(comet.dataset.edgeLength);
      const travel = clamp(length / .25, 1600, 5000);
      const ease = (value: number): number => -(Math.cos(Math.PI * value) - 1) / 2;
      function flashTarget(): void {
        const id = CSS.escape(comet.dataset.targetId ?? "");
        const target = panel.querySelector<HTMLElement>('[data-node-id="' + id + '"] .beam-hit-ring, [data-group-id="' + id + '"] .beam-hit-ring');
        if (!target) return;
        target.style.borderColor = comet.dataset.beamColor ?? "";
        target.style.opacity = ".55";
        clearTimeout(target._flashTimer);
        target._flashTimer = setTimeout(() => { target.style.opacity = "0"; }, 600);
      }
      function run(): void {
        const started = performance.now();
        const pathLength = edgePath.getTotalLength();
        comet.style.opacity = "1";
        function frame(now: number): void {
          const progress = Math.min(1, (now - started) / travel);
          const distance = ease(progress) * pathLength;
          const point = edgePath.getPointAtLength(distance);
          const next = edgePath.getPointAtLength(Math.min(pathLength, distance + 1));
          const angle = Math.atan2(next.y - point.y, next.x - point.x) * 180 / Math.PI;
          comet.setAttribute("transform", "translate(" + point.x + " " + point.y + ") rotate(" + angle + ")");
          if (progress < 1) requestAnimationFrame(frame);
          else {
            comet.style.opacity = "0";
            flashTarget();
            setTimeout(run, 30000 + Math.random() * 25000);
          }
        }
        requestAnimationFrame(frame);
      }
      setTimeout(run, 1200 + Math.random() * 30000);
    });
  }

  function clearClasses(items: readonly Element[], ...classes: string[]): void {
    items.forEach((item) => item.classList.remove(...classes));
  }

  function initOptions(panel: HTMLElement): void {
    const buttons = all<HTMLButtonElement>(panel, "[data-answer-option]");
    const targets = all<HTMLElement | SVGElement>(panel, "[data-highlight-id], [data-highlight-links]");
    let selected = buttons.find((button) => button.dataset.recommended === "true") ?? null;

    function apply(button: HTMLButtonElement | null): void {
      const ids = new Set(button ? (button.dataset.highlights ?? "").split(" ").filter(Boolean) : []);
      targets.forEach((target) => {
        const own = target.dataset.highlightId;
        const links = (target.dataset.highlightLinks || "").split(" ").filter(Boolean);
        const active = ids.size === 0 || (own ? ids.has(own) : links.length > 0 && links.every((id) => ids.has(id)));
        target.classList.toggle("option-active", ids.size > 0 && active);
        target.classList.toggle("option-dimmed", ids.size > 0 && !active);
      });
      buttons.forEach((item) => item.setAttribute("aria-pressed", String(item === selected)));
    }

    buttons.forEach((button) => {
      button.addEventListener("pointerenter", () => apply(button));
      button.addEventListener("pointerleave", () => apply(selected));
      button.addEventListener("focus", () => apply(button));
      button.addEventListener("blur", () => apply(selected));
      button.addEventListener("click", () => {
        selected = selected === button ? null : button;
        apply(selected);
      });
    });
    apply(selected);
  }

  function initArchitecture(panel: HTMLElement, model: ViewerDocument, canvas: CanvasRuntime): () => void {
    const popover = required<HTMLElement>(panel, ".node-popover");
    const nodeButtons = all<HTMLButtonElement>(panel, "[data-node-id]");
    const edgeGroups = all<SVGGraphicsElement>(panel, "[data-edge-index]");
    const groupWraps = all<SVGElement>(panel, "[data-group-id]");
    const nodeById = new Map<string, ArchitectureNode>(model.nodes.map((node) => [node.id, node]));
    let traceRoot: string | null = null;
    let kindFocus: Set<string> | null = null;

    function downstream(rootId: string): { nodes: Set<string>; edges: Set<number> } {
      const nodes = new Set<string>([rootId]);
      const edges = new Set<number>();
      const queue: string[] = [rootId];
      while (queue.length) {
        const current = queue.shift();
        model.edges.forEach((edge, index) => {
          if (edge.source !== current) return;
          edges.add(index);
          if (!nodes.has(edge.target)) { nodes.add(edge.target); queue.push(edge.target); }
        });
      }
      return { nodes, edges };
    }

    function applyFocus(): void {
      const trace = traceRoot ? downstream(traceRoot) : null;
      const kinds = kindFocus;
      panel.classList.toggle("has-kind-focus", Boolean(kinds));
      nodeButtons.forEach((button) => {
        const traceActive = !trace || trace.nodes.has(button.dataset.nodeId ?? "");
        const kindActive = !kinds || kinds.has(button.dataset.kind ?? "");
        const active = traceActive && kindActive;
        button.classList.toggle("is-dimmed", !active);
        button.classList.toggle("is-active", button.dataset.nodeId === traceRoot);
        button.setAttribute("aria-pressed", String(button.dataset.nodeId === traceRoot));
      });
      edgeGroups.forEach((edge) => {
        const indices = (edge.dataset.originalIndices ?? "").split(" ").map(Number);
        const traceActive = !trace || indices.some((index) => trace.edges.has(index));
        const kindActive = !kinds || indices.some((index) => {
          const original = model.edges[index];
          if (!original) return false;
          return kinds.has(nodeById.get(original.source)?.kind ?? "") || kinds.has(nodeById.get(original.target)?.kind ?? "");
        });
        edge.classList.toggle("is-dimmed", !(traceActive && kindActive));
        edge.classList.toggle("is-active", Boolean(trace && indices.some((index) => trace.edges.has(index))));
        edge.querySelector(".edge-label.is-kind-only")?.classList.toggle("is-visible", Boolean(trace && indices.some((index) => trace.edges.has(index))));
      });
      groupWraps.forEach((group) => {
        const active = !kinds || model.nodes.some((node) => node.group === group.dataset.groupLabel && kinds.has(node.kind));
        group.classList.toggle("is-dimmed", !active);
      });
    }

    function showPopover(id: string): void {
      const node = nodeById.get(id);
      const button = panel.querySelector<HTMLButtonElement>('[data-node-id="' + CSS.escape(id) + '"]');
      const object = button?.closest("foreignObject");
      if (!node || !button || !object) return;
      popover.hidden = false;
      const sourceIcon = button.querySelector<HTMLElement | SVGElement>(".node-glyph img")
        ?? button.querySelector<SVGElement>(".node-glyph svg");
      if (!sourceIcon) return;
      const icon = sourceIcon.cloneNode(true);
      if (!(icon instanceof HTMLElement || icon instanceof SVGElement)) return;
      if (icon.tagName.toLowerCase() === "svg") {
        icon.style.color = getComputedStyle(button).getPropertyValue("--node-color");
      } else {
        icon.setAttribute("class", "popover-logo");
        icon.removeAttribute("data-node-logo");
        icon.removeAttribute("data-logo-key");
      }
      required<HTMLElement>(popover, ".popover-kind-icon").replaceChildren(icon);
      required<HTMLElement>(popover, ".popover-kind-label").textContent = button.dataset.kindLabel ?? "";
      required<HTMLElement>(popover, "h2").textContent = node.label;
      required<HTMLElement>(popover, ".popover-description").textContent = node.description;
      const detail = required<HTMLElement>(popover, ".popover-detail");
      detail.textContent = node.detail || "";
      detail.hidden = !node.detail;
      const source = required<HTMLElement>(popover, ".popover-source");
      source.textContent = node.sourceRef || "";
      source.hidden = !node.sourceRef;
      const box = button.getBoundingClientRect();
      popover.style.left = clamp(box.left, 12, innerWidth - 252) + "px";
      popover.style.top = clamp(box.bottom + 10, 12, innerHeight - popover.offsetHeight - 12) + "px";
    }

    function traceFrom(id: string): void {
      if (traceRoot === id) { clearTrace(); return; }
      traceRoot = id;
      applyFocus();
      showPopover(id);
    }
    function clearTrace(): void {
      traceRoot = null;
      popover.hidden = true;
      applyFocus();
    }

    nodeButtons.forEach((button) => button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = button.dataset.nodeId;
      if (id) traceFrom(id);
    }));
    const legendButtons = all<HTMLButtonElement>(panel, "[data-legend-kinds]");
    function focusLegend(button: HTMLButtonElement): void {
        kindFocus = new Set((button.dataset.legendKinds ?? "").split(" ").filter(Boolean));
        legendButtons.forEach((item) => {
          item.classList.toggle("is-active", item === button);
          item.classList.toggle("is-dimmed", item !== button);
        });
        applyFocus();
    }
    function clearLegend(): void {
        kindFocus = null;
        legendButtons.forEach((item) => item.classList.remove("is-active", "is-dimmed"));
        applyFocus();
    }
    legendButtons.forEach((button) => {
      button.addEventListener("pointerenter", () => focusLegend(button));
      button.addEventListener("pointerleave", () => { if (!button.matches(":focus-visible")) clearLegend(); });
      button.addEventListener("focus", () => focusLegend(button));
      button.addEventListener("blur", () => { if (!button.matches(":hover")) clearLegend(); });
    });
    canvas.onPaint(() => { if (traceRoot) showPopover(traceRoot); });
    canvas.setClear(clearTrace);
    return clearTrace;
  }

  function initSequence(panel: HTMLElement): () => void {
    const participants = all<HTMLButtonElement>(panel, "[data-sequence-participant]");
    const messages = all<HTMLElement | SVGElement>(panel, "[data-sequence-message]");
    function clear() { clearClasses(participants, "is-active", "is-dimmed"); clearClasses(messages, "is-active", "is-dimmed"); closeFamilyInspector(panel); }
    participants.forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.sequenceParticipant;
      const related = messages.filter((message) => message.dataset.source === id || message.dataset.target === id);
      const participantIds = new Set<string>(id ? [id] : []);
      related.forEach((message) => {
        if (message.dataset.source) participantIds.add(message.dataset.source);
        if (message.dataset.target) participantIds.add(message.dataset.target);
      });
      participants.forEach((item) => { item.classList.toggle("is-active", item === button); item.classList.toggle("is-dimmed", !participantIds.has(item.dataset.sequenceParticipant ?? "")); });
      messages.forEach((message) => { const active = related.includes(message); message.classList.toggle("is-active", active); message.classList.toggle("is-dimmed", !active); });
      showFamilyInspector(panel, button);
    }));
    all<HTMLButtonElement>(panel, "[data-sequence-step]").forEach((button) => button.addEventListener("click", () => {
      const message = button.closest<HTMLElement | SVGElement>("[data-sequence-message]");
      if (!message) return;
      const ids = new Set([message.dataset.source, message.dataset.target].filter((id): id is string => Boolean(id)));
      messages.forEach((item) => { item.classList.toggle("is-active", item === message); item.classList.toggle("is-dimmed", item !== message); });
      participants.forEach((item) => item.classList.toggle("is-dimmed", !ids.has(item.dataset.sequenceParticipant ?? "")));
      showFamilyInspector(panel, button);
    }));
    return clear;
  }

  function initState(panel: HTMLElement): () => void {
    const states = all<HTMLButtonElement>(panel, "[data-state-id]");
    const transitions = all<SVGGraphicsElement>(panel, "[data-state-transition]");
    function clear() { clearClasses(states, "is-active", "is-dimmed"); clearClasses(transitions, "is-active", "is-dimmed"); closeFamilyInspector(panel); }
    states.forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.stateId;
      const related = transitions.filter((edge) => edge.dataset.source === id || edge.dataset.target === id);
      const ids = new Set<string>(id ? [id] : []);
      related.forEach((edge) => {
        if (edge.dataset.source) ids.add(edge.dataset.source);
        if (edge.dataset.target) ids.add(edge.dataset.target);
      });
      states.forEach((item) => { item.classList.toggle("is-active", item === button); item.classList.toggle("is-dimmed", !ids.has(item.dataset.stateId ?? "")); });
      transitions.forEach((edge) => { edge.classList.toggle("is-active", related.includes(edge)); edge.classList.toggle("is-dimmed", !related.includes(edge)); });
      showFamilyInspector(panel, button);
    }));
    transitions.forEach((edge) => edge.querySelector("button")?.addEventListener("click", () => {
      const ids = new Set([edge.dataset.source, edge.dataset.target].filter((id): id is string => Boolean(id)));
      transitions.forEach((item) => { item.classList.toggle("is-active", item === edge); item.classList.toggle("is-dimmed", item !== edge); });
      states.forEach((item) => item.classList.toggle("is-dimmed", !ids.has(item.dataset.stateId ?? "")));
      showFamilyInspector(panel, edge.querySelector<HTMLButtonElement>("button"));
    }));
    return clear;
  }

  function initMindMap(panel: HTMLElement): () => void {
    const objects = all<SVGElement>(panel, "[data-mind-object]");
    const edges = all<SVGElement>(panel, "[data-mind-child]");
    const byId = new Map<string, SVGElement>(objects.flatMap((object) => object.dataset.mindObject ? [[object.dataset.mindObject, object]] : []));
    const collapsed = new Set<string>();
    function descendants(id: string): Set<string> {
      const found = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        objects.forEach((object) => {
          const parentId = object.dataset.parentId ?? "";
          const objectId = object.dataset.mindObject ?? "";
          if (found.has(parentId) && !found.has(objectId)) { found.add(objectId); changed = true; }
        });
      }
      return found;
    }
    function applyCollapse(): void {
      objects.forEach((object) => {
        let parentId = object.dataset.parentId;
        let hidden = false;
        while (parentId) { if (collapsed.has(parentId)) { hidden = true; break; } parentId = byId.get(parentId)?.dataset.parentId || ""; }
        object.classList.toggle("is-collapsed", hidden);
      });
      edges.forEach((edge) => edge.classList.toggle("is-collapsed", byId.get(edge.dataset.mindChild ?? "")?.classList.contains("is-collapsed") ?? false));
    }
    function clear() { clearClasses(objects, "is-dimmed"); clearClasses(edges, "is-dimmed"); objects.forEach((object) => object.querySelector(".mind-card")?.classList.remove("is-active")); closeFamilyInspector(panel); }
    all<HTMLButtonElement>(panel, "[data-mind-id]").forEach((button) => button.addEventListener("click", () => {
      const ids = descendants(button.dataset.mindId ?? "");
      objects.forEach((object) => { object.classList.toggle("is-dimmed", !ids.has(object.dataset.mindObject ?? "")); object.querySelector(".mind-card")?.classList.toggle("is-active", object.dataset.mindObject === button.dataset.mindId); });
      edges.forEach((edge) => edge.classList.toggle("is-dimmed", !ids.has(edge.dataset.mindChild ?? "")));
      showFamilyInspector(panel, button);
    }));
    all<HTMLButtonElement>(panel, "[data-mind-toggle]").forEach((button) => button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = button.dataset.mindToggle ?? "";
      if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
      const expanded = !collapsed.has(id);
      button.setAttribute("aria-expanded", String(expanded));
      const label = byId.get(id)?.querySelector<HTMLElement>(".mind-card strong")?.textContent ?? "branch";
      button.setAttribute("aria-label", (expanded ? "Collapse " : "Expand ") + label + " branch");
      button.textContent = expanded ? "−" : "+";
      applyCollapse();
    }));
    return clear;
  }

  function initTimeline(panel: HTMLElement): () => void {
    const events = all<HTMLButtonElement>(panel, "[data-timeline-event]");
    const groups = all<SVGElement>(panel, "[data-timeline-group]");
    function clear() { clearClasses(events, "is-active"); clearClasses(groups, "is-dimmed"); closeFamilyInspector(panel); }
    events.forEach((button, index) => {
      button.addEventListener("click", () => {
        events.forEach((item) => item.classList.toggle("is-active", item === button));
        groups.forEach((group, groupIndex) => group.classList.toggle("is-dimmed", groupIndex !== index));
        showFamilyInspector(panel, button);
      });
      button.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const next = clamp(index + (event.key === "ArrowRight" ? 1 : -1), 0, events.length - 1);
        events[next]?.focus(); events[next]?.click();
      });
    });
    return clear;
  }

  function initQuadrant(panel: HTMLElement): () => void {
    const points = all<SVGElement>(panel, "[data-quadrant-point]");
    const filters = all<HTMLButtonElement>(panel, "[data-quadrant-filter]");
    let group: string | null = null;
    function apply() { points.forEach((point) => point.classList.toggle("is-dimmed", Boolean(group) && point.dataset.quadrantGroup !== group)); filters.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.quadrantFilter === group))); }
    function clear() { group = null; apply(); clearClasses(points, "is-active"); closeFamilyInspector(panel); }
    points.forEach((point) => point.querySelector("button")?.addEventListener("click", () => { points.forEach((item) => item.classList.toggle("is-active", item === point)); showFamilyInspector(panel, point.querySelector("button")); }));
    filters.forEach((button) => button.addEventListener("click", () => { group = group === button.dataset.quadrantFilter ? null : button.dataset.quadrantFilter ?? null; apply(); }));
    return clear;
  }

  function initComparison(panel: HTMLElement): () => void {
    const options = all<HTMLButtonElement>(panel, "[data-comparison-option]");
    const criteria = all<HTMLButtonElement>(panel, "[data-comparison-criterion]");
    const cells = all<HTMLElement>(panel, "[data-comparison-cell]");
    function clear() { clearClasses(options, "is-active", "is-dimmed"); clearClasses(criteria, "is-active", "is-dimmed"); clearClasses(cells, "is-active", "is-dimmed"); closeFamilyInspector(panel); }
    options.forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.comparisonOption;
      options.forEach((item) => { item.classList.toggle("is-active", item === button); item.classList.toggle("is-dimmed", item !== button); });
      cells.forEach((cell) => cell.classList.toggle("is-dimmed", !(cell.dataset.comparisonCell ?? "").endsWith(":" + id)));
      showFamilyInspector(panel, button);
    }));
    criteria.forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.comparisonCriterion;
      criteria.forEach((item) => { item.classList.toggle("is-active", item === button); item.classList.toggle("is-dimmed", item !== button); });
      cells.forEach((cell) => cell.classList.toggle("is-dimmed", !(cell.dataset.comparisonCell ?? "").startsWith(id + ":")));
      showFamilyInspector(panel, button);
    }));
    cells.forEach((cell) => cell.querySelector("button")?.addEventListener("click", () => {
      cells.forEach((item) => { item.classList.toggle("is-active", item === cell); item.classList.toggle("is-dimmed", item !== cell); });
      showFamilyInspector(panel, cell.querySelector("button"));
    }));
    return clear;
  }

  function initializePanel(panel: HTMLElement): CanvasController {
    const documentId = panel.dataset.documentId;
    if (!documentId) throw new Error("Diagram panel has no document ID");
    const existing = controllers.get(documentId);
    if (existing) return existing;
    const model = documentById.get(documentId);
    if (!model) throw new Error(`Missing model for ${documentId}`);
    const canvas = createCanvas(panel);
    let clear = () => closeFamilyInspector(panel);
    if (model.family === "architecture") clear = initArchitecture(panel, model, canvas);
    if (model.family === "sequence") clear = initSequence(panel);
    if (model.family === "state") clear = initState(panel);
    if (model.family === "mind-map") clear = initMindMap(panel);
    if (model.family === "timeline") clear = initTimeline(panel);
    if (model.family === "quadrant") clear = initQuadrant(panel);
    if (model.family === "comparison") clear = initComparison(panel);
    canvas.setClear(clear);
    panel.querySelector("[data-close-family-popover]")?.addEventListener("click", clear);
    initOptions(panel);
    const controller: CanvasController = { fit: canvas.fit, zoomAt: canvas.zoomAt, clear };
    controllers.set(documentId, controller);
    return controller;
  }

  required<HTMLButtonElement>(document, '[data-zoom="in"]').addEventListener("click", () => controllers.get(currentPanel().dataset.documentId ?? "")?.zoomAt(1.2));
  required<HTMLButtonElement>(document, '[data-zoom="out"]').addEventListener("click", () => controllers.get(currentPanel().dataset.documentId ?? "")?.zoomAt(1 / 1.2));
  required<HTMLButtonElement>(document, '[data-zoom="fit"]').addEventListener("click", () => controllers.get(currentPanel().dataset.documentId ?? "")?.fit());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      controllers.get(currentPanel().dataset.documentId ?? "")?.clear();
      if (document.activeElement instanceof HTMLElement && questionRail.contains(document.activeElement)) document.activeElement.blur();
      setRailExpanded(false);
    }
  });

  const requested = decodeURIComponent(location.hash.slice(1));
  const initialDocument = session.documents[0];
  if (!initialDocument) throw new Error("Viewer session has no diagrams");
  activateTab(documentById.has(requested) ? requested : initialDocument.id, false);
})();


window.__REACT_GRAB_DISABLED__ = !(
  location.protocol === "file:" ||
  ["localhost", "127.0.0.1", "::1"].includes(location.hostname)
);
