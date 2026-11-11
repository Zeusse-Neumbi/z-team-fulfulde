import type {
  ActionView,
  ExtensionMessage,
  MtMode,
  PanelSettings,
  Readback,
  TranslationStatus,
  UiLanguage,
} from "@zteam/shared";
import { panelSettingsSchema } from "@zteam/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getTargetTab,
  isRestrictedTab,
  isWebTab,
  originOf,
  sendToTab,
} from "../../lib/messages";
import {
  hasOriginPermission,
  injectContentScript,
  requestOriginPermission,
} from "../../lib/permissions";
import {
  DEFAULT_API_BASE_URL,
  discoverApiBaseUrl,
  failureCopyKey,
  parseBackendFailure,
  voiceStateFromHealth,
  type HealthResponse,
  type VoiceState,
} from "../../lib/backend";
import { buildSpeechPlan, shouldSpeakPageAction } from "../../lib/speech";
import { copy, type PanelCopy } from "./copy";

const SETTINGS_KEY = "zteam.panel.settings.v1";
const DEFAULT_SETTINGS: PanelSettings = {
  uiLang: "fr",
  speed: 1,
  speakValues: false,
  apiTranslation: "fallback",
  mtProvider: null,
};

type AudioState = "idle" | "loading" | "playing" | "paused";

function percent(value: number): string {
  return `${Math.round(value * 100)} %`;
}

function abortMessage(reason: string | undefined, t: PanelCopy): string {
  if (reason === "protected_changed") return t.abortProtected;
  if (reason === "mixed_value_missing") return t.abortMixed;
  if (reason === "target_value_mismatch") return t.abortTarget;
  return t.abortUnknown;
}

function humanizeError(message: string, t: PanelCopy): string {
  if (/could not establish connection|receiving end does not exist/i.test(message)) {
    return t.noContent;
  }
  if (/cannot access|missing host permission|extensions gallery|chrome:\/\//i.test(message)) {
    return t.unsupported;
  }
  return message;
}

export default function App() {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [status, setStatus] = useState<TranslationStatus | null>(null);
  const [permitted, setPermitted] = useState(false);
  const [settings, setSettings] = useState<PanelSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [audio, setAudio] = useState<AudioState>("idle");
  const [audioError, setAudioError] = useState("");
  const [voice, setVoice] = useState<VoiceState>("unknown");
  const [voiceLocal, setVoiceLocal] = useState(true);
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [apiDiscovered, setApiDiscovered] = useState(false);
  const [readback, setReadback] = useState<Readback | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionView | null>(null);
  const [openSentences, setOpenSentences] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const spokenPendingRef = useRef<string | null>(null);
  const actionAnnounceRef = useRef<(name: string) => void>(() => undefined);
  const abortRef = useRef<AbortController | null>(null);
  const urlsRef = useRef<string[]>([]);
  const t = copy[settings.uiLang];
  const plan = useMemo(
    () =>
      status
        ? buildSpeechPlan(status, {
            step: t.step,
            stepLabels: t.stepLabels,
            valuesNote: t.valuesNotSpoken,
            amountLabel: t.amount,
            feeLabel: t.fee,
            actionsNote: t.actionsPlanNote,
            noContent: t.noContentPlan,
          }, { allowValues: settings.speakValues && voiceLocal })
        : null,
    [status, t, settings.speakValues, voiceLocal],
  );

  const cleanupAudio = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];
  }, []);

  const stopAudio = useCallback(() => {
    cleanupAudio();
    setAudio("idle");
    setAudioError("");
  }, [cleanupAudio]);

  const refresh = useCallback(async () => {
    const target = await getTargetTab();
    setTab(target);
    const origin = originOf(target?.url);
    setPermitted(origin ? await hasOriginPermission(origin) : false);

    if (!target?.id || isRestrictedTab(target.url)) {
      setStatus(null);
      return;
    }
    try {
      const next = await sendToTab<TranslationStatus>(target.id, { type: "GET_STATUS" });
      setStatus(next);
    } catch {
      setStatus(null);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    const target = await getTargetTab();
    if (!target?.id) return;
    try {
      const next = await sendToTab<TranslationStatus>(target.id, { type: "GET_STATUS" });
      setStatus(next);
    } catch {
      setStatus(null);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) throw new Error(`health ${response.status}`);
      const data = (await response.json()) as HealthResponse;
      setVoice(voiceStateFromHealth(data));
      setVoiceLocal(data.tts?.local ?? true);
    } catch {
      setVoice("offline");
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    let alive = true;
    void chrome.storage.local.get(SETTINGS_KEY).then((stored) => {
      if (!alive) return;
      const parsed = panelSettingsSchema.safeParse(stored[SETTINGS_KEY]);
      if (parsed.success) setSettings(parsed.data);
      setSettingsLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    void chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }, [settings, settingsLoaded]);

  useEffect(() => {
    let alive = true;
    void discoverApiBaseUrl().then((url) => {
      if (alive && url) {
        setApiBaseUrl((current) => (current === url ? current : url));
        setApiDiscovered(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    void refresh();
    void checkHealth();

    const onActivated = () => {
      stopAudio();
      setReadback(null);
      void refresh();
    };
    const onUpdated = (_tabId: number, info: { status?: string; url?: string }) => {
      if (info.status === "complete" || info.url) {
        setReadback(null);
        void refresh();
      }
    };

    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);

    let polling = false;
    const poll = window.setInterval(() => {
      if (polling || document.visibilityState !== "visible") return;
      polling = true;
      void refreshStatus().finally(() => {
        polling = false;
      });
    }, 750);

    // Keep the voice state in sync when the local API is restarted with a
    // different provider (stub -> mms -> camb) during a model comparison.
    const healthPoll = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkHealth();
    }, 5000);

    const health = window.setInterval(() => {
      void checkHealth();
    }, 15_000);

    return () => {
      window.clearInterval(poll);
      window.clearInterval(healthPoll);
      window.clearInterval(health);
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      cleanupAudio();
    };
  }, [cleanupAudio, checkHealth, refresh, refreshStatus, stopAudio]);

  async function withTab<T>(fn: (activeTab: chrome.tabs.Tab) => Promise<T>): Promise<T | null> {
    const target = tab && isWebTab(tab.url) ? tab : await getTargetTab();
    if (!target?.id || isRestrictedTab(target.url)) {
      setMessage(t.unsupported);
      return null;
    }

    setTab(target);
    setBusy(true);
    setMessage("");
    try {
      return await fn(target);
    } catch (error) {
      setMessage(humanizeError(error instanceof Error ? error.message : String(error), t));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function ensureReady(target: chrome.tabs.Tab): Promise<boolean> {
    if (!target.id) return false;
    const origin = originOf(target.url);
    if (!origin) {
      setMessage(t.unsupported);
      return false;
    }

    if (!(await hasOriginPermission(origin))) {
      const granted = await requestOriginPermission(origin);
      if (!granted) {
        setMessage(t.permissionDenied);
        return false;
      }
      setPermitted(true);
    }

    try {
      await sendToTab(target.id, { type: "PING" });
      return true;
    } catch {
      try {
        await injectContentScript(target.id);
        await sendToTab(target.id, { type: "PING" });
        return true;
      } catch {
        setMessage(t.noContent);
        return false;
      }
    }
  }

  async function start() {
    setAudioError("");
    await withTab(async (target) => {
      if (!(await ensureReady(target))) return;
      const next = await sendToTab<TranslationStatus>(target.id as number, {
        type: "START_TRANSLATION",
        api: {
          mode: settings.apiTranslation,
          provider: settings.mtProvider,
          baseUrl: apiDiscovered ? apiBaseUrl : undefined,
        },
      });
      setStatus(next);
      setReadback(null);
      if (next.aborted) setMessage(abortMessage(next.abortReason, t));
      else if (next.translations === 0 && next.mtApplied === 0 && next.mt.state !== "running") {
        setMessage(t.packMissing);
      }
    });
  }

  async function rescan() {
    await withTab(async (target) => {
      if (!(await ensureReady(target))) return;
      const next = await sendToTab<TranslationStatus>(target.id as number, {
        type: "RESCAN",
        api: {
          mode: settings.apiTranslation,
          provider: settings.mtProvider,
          baseUrl: apiDiscovered ? apiBaseUrl : undefined,
        },
      });
      setStatus(next);
      if (next.aborted) setMessage(abortMessage(next.abortReason, t));
      else if (next.translations === 0 && next.mtApplied === 0 && next.mt.state !== "running") {
        setMessage(t.packMissing);
      }
    });
  }

  async function stop() {
    stopAudio();
    await withTab(async (target) => {
      const next = await sendToTab<TranslationStatus>(target.id as number, {
        type: "STOP_TRANSLATION",
      });
      setStatus(next);
      setReadback(null);
    });
  }

  async function readSummary() {
    await withTab(async (target) => {
      if (!(await ensureReady(target))) return;
      const next = await sendToTab<Readback>(target.id as number, { type: "GET_READBACK" });
      setReadback(next);
    });
  }

  async function confirmPageClick() {
    if (!status?.pendingPageAction || !tab?.id) return;
    setBusy(true);
    try {
      const result = await sendToTab<{ ok: boolean; error?: string }>(tab.id, {
        type: "CONFIRM_PAGE_ACTION",
        actionId: status.pendingPageAction.id,
        snapshotId: status.actionSnapshotId,
      });
      setMessage(result.ok ? t.pageClickArmed : t.staleAction);
      await refreshStatus();
    } catch (error) {
      setMessage(humanizeError(error instanceof Error ? error.message : String(error), t));
    } finally {
      setBusy(false);
    }
  }

  async function cancelPageClick() {
    if (!tab?.id) return;
    await sendToTab(tab.id, { type: "CANCEL_PAGE_ACTION" }).catch(() => undefined);
    setMessage("");
    await refreshStatus();
  }

  useEffect(() => {
    const pending = status?.pendingPageAction;
    if (!pending) {
      spokenPendingRef.current = null;
      return;
    }
    if (spokenPendingRef.current === pending.id) return;
    spokenPendingRef.current = pending.id;
    if (voice !== "ready") return;
    if (!shouldSpeakPageAction(pending, status?.protectedValues ?? [])) return;
    void playTexts([pending.spokenName ?? pending.name]);
    // playTexts is intentionally read through the render closure; the id guard
    // prevents a second announcement while the status keeps polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, voice]);

  async function verifyAction(action: ActionView) {
    setPendingAction(action);
    setMessage(t.actionSpoken);
    if (voice === "ready") await playTexts([action.spokenName ?? action.name]);
  }

  function confirmAction() {
    const action = pendingAction;
    setPendingAction(null);
    if (action) void highlight(action);
  }

  async function highlight(action: ActionView) {
    if (!status || !tab?.id) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await sendToTab<{ ok: boolean; error?: string }>(tab.id, {
        type: "HIGHLIGHT_ACTION",
        actionId: action.id,
        snapshotId: status.actionSnapshotId,
      });
      if (result.ok) setMessage(t.highlighted);
      else if (result.error === "stale_action") setMessage(t.staleAction);
      else setMessage(t.unsupported);
    } catch (error) {
      setMessage(humanizeError(error instanceof Error ? error.message : String(error), t));
    } finally {
      setBusy(false);
    }
  }

  async function playAudio() {
    if (!plan) return;
    await playTexts(plan.spoken);
  }

  async function playTexts(texts: string[]) {
    if (voice !== "ready") {
      setMessage(t.audioUnavailable);
      return;
    }
    if (!texts.length) {
      setMessage(t.noSpeech);
      return;
    }

    cleanupAudio();
    setAudio("loading");
    setAudioError("");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for (const text of texts) {
        const response = await fetch(`${apiBaseUrl}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.slice(0, 500), voice: "demo", speed: settings.speed }),
          signal: controller.signal,
        });
        if (!response.ok) {
          let body: unknown = null;
          try {
            body = await response.json();
          } catch {
            body = null;
          }
          const failure = parseBackendFailure(response.status, body);
          setAudio("idle");
          setAudioError(t[failureCopyKey(failure)]);
          return;
        }

        if (response.headers.get("X-ZTeam-Stub") === "1") {
          setVoice("stub");
          setAudio("idle");
          setAudioError(t.audioStub);
          return;
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        urlsRef.current.push(url);
        const element = new Audio(url);
        element.playbackRate = settings.speed;
        audioRef.current = element;
        setAudio("playing");
        await element.play();
        await new Promise<void>((resolve, reject) => {
          element.addEventListener("ended", () => resolve(), { once: true });
          element.addEventListener("error", () => reject(new Error("audio")), { once: true });
        });
        URL.revokeObjectURL(url);
        urlsRef.current = urlsRef.current.filter((item) => item !== url);
        audioRef.current = null;
      }
      setAudio("idle");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setAudio("idle");
      setAudioError(t.audioError);
    } finally {
      abortRef.current = null;
    }
  }

  actionAnnounceRef.current = (name: string) => {
    const display = t.actionClicked.replace("{name}", name);
    const audioText = copy.ff.actionClicked.replace("{name}", name);
    setMessage(display);
    if (voice === "ready") void playTexts([audioText]);
  };

  useEffect(() => {
    const onMessage = (message: ExtensionMessage) => {
      if (message.type === "PAGE_ACTION_CLICKED") {
        actionAnnounceRef.current(message.name);
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  function pauseAudio() {
    const element = audioRef.current;
    if (!element) return;
    if (element.paused) {
      void element.play();
      setAudio("playing");
    } else {
      element.pause();
      setAudio("paused");
    }
  }

  function toggleSpeed() {
    const next = settings.speed === 1 ? 0.8 : 1;
    setSettings((current) => ({ ...current, speed: next }));
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  useEffect(() => {
    setReadback(null);
  }, [status?.step]);

  const pageTitle = status?.title ?? tab?.title ?? t.noPage;
  const pageUrl = status?.url ?? tab?.url ?? "";
  const isActive = Boolean(status?.active);
  const stepLabel =
    status && status.step !== "unknown"
      ? `${t.step} ${status.step}/5 · ${t.stepLabels[status.step]}`
      : t.stepUnknown;
  const badge = busy
    ? { label: t.translating, className: "busy" }
    : status?.aborted
      ? { label: t.error, className: "error" }
      : isActive
        ? { label: t.active, className: "on" }
        : { label: t.inactive, className: "off" };

  const actionable = useMemo(
    () => status?.actions.filter((action) => !action.locked) ?? [],
    [status?.actions],
  );
  const locked = useMemo(
    () => status?.actions.filter((action) => action.locked) ?? [],
    [status?.actions],
  );

  const mtRunning = status?.mt.state === "running";
  const mtUsed = (status?.mtApplied ?? 0) > 0;
  const noTm = (status?.translations ?? 0) === 0;
  const mtStateLabel = mtRunning
    ? `${t.mtProgress} ${status?.mt.done ?? 0}/${status?.mt.total ?? 0}`
    : status?.mt.state === "offline" || status?.mt.state === "error"
      ? t.error
      : status?.mt.state === "ready"
        ? `${t.mtLocal} · ${t.mtUnvalidated}`
        : !status?.active && settings.apiTranslation !== "off"
          ? t.mtReady
          : t.apiModeOff;

  return (
    <main className="shell" aria-busy={busy}>
      <header className="topbar">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
        </div>
        <div className="topbar-actions">
          <span className={`badge ${badge.className}`} role="status" aria-live="polite">
            {badge.label}
          </span>
          <label className="lang-switch">
            <span className="sr-only">{t.language}</span>
            <select
              value={settings.uiLang}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  uiLang: event.target.value as UiLanguage,
                }))
              }
              aria-label={t.language}
            >
              <option value="fr">FR</option>
              <option value="en">EN</option>
              <option value="ff">FF</option>
            </select>
          </label>
        </div>
      </header>

      {settings.uiLang === "ff" ? <p className="notice ff-draft">{t.ffDraftNote}</p> : null}

      {isActive ? (
        <button type="button" className="stop-wide" onClick={stop}>
          ⏹ {t.stop}
        </button>
      ) : null}

      <section className="card" aria-labelledby="page-heading">
        <p className="label" id="page-heading">
          {t.page}
        </p>
        <p className="page-title">{pageTitle}</p>
        <p className="url">{pageUrl}</p>
        <div className="page-meta">
          <span className="chip">{stepLabel}</span>
          {status?.language && status.language !== "unknown" ? (
            <span className="chip">
              {t.pageLanguage} : {status.language.toUpperCase()}
            </span>
          ) : null}
        </div>
      </section>

      <section className="card stats" aria-label={t.coverage}>
        <div className="meter-head coverage-meter-head">
          <span>{t.coverage}</span>
          <strong>{status ? percent(status.coverage) : "—"}</strong>
        </div>
        <div
          className="meter"
          role="progressbar"
          aria-label={t.coverage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={status ? Math.round(status.coverage * 100) : 0}
        >
          <span style={{ width: `${status ? Math.round(status.coverage * 100) : 0}%` }} />
        </div>
        {status?.pageCoverage ? (
          <div className="page-coverage">
            <div className="meter-head">
              <span>{t.pageCoverage}</span>
              <strong>{status.pageCoverage.percent} %</strong>
            </div>
            <div
              className="meter page-meter"
              role="progressbar"
              aria-label={t.pageCoverage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={status.pageCoverage.percent}
            >
              <span style={{ width: `${status.pageCoverage.percent}%` }} />
            </div>
            <p className="hint">
              {t.pageCoverageHint} {t.pageCoverageCeiling} :{" "}
              {status.pageCoverage.safeCeiling} % · {status.pageCoverage.protectedOnly}{" "}
              {t.pageCoverageProtected}
            </p>
          </div>
        ) : null}
        <dl className="stat-grid">
          <div>
            <dt>{t.translated}</dt>
            <dd>{status?.applied ?? "—"}</dd>
          </div>
          <div>
            <dt>{t.protected}</dt>
            <dd>{status?.protectedCount ?? "—"}</dd>
          </div>
          <div>
            <dt>{t.missed}</dt>
            <dd>{status?.missed ?? "—"}</dd>
          </div>
          <div>
            <dt>{t.pageLanguage}</dt>
            <dd>{status?.language ? status.language.toUpperCase() : "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="card mt-card" aria-labelledby="mt-heading">
        <div className="mt-head">
          <h2 id="mt-heading">{t.translationSource}</h2>
          <span className={`mt-state ${status?.mt.state ?? "off"}${mtUsed ? " mt-used" : ""}`}>
            {mtStateLabel}
          </span>
        </div>
        <label className="mt-setting">
          {t.apiMode}
          <select
            value={settings.apiTranslation}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                apiTranslation: event.target.value as MtMode,
              }))
            }
            disabled={busy}
          >
            <option value="off">{t.apiModeOff}</option>
            <option value="fallback">{t.apiModeFallback}</option>
            <option value="primary">{t.apiModePrimary}</option>
          </select>
        </label>
        <label className="mt-setting">
          {t.apiProvider}
          <select
            value={settings.mtProvider ?? "auto"}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                mtProvider: event.target.value === "auto" ? null : event.target.value,
              }))
            }
            disabled={busy || settings.apiTranslation === "off"}
          >
            <option value="auto">{t.apiAuto}</option>
            <option value="nllb">{t.apiNllb}</option>
            <option value="ollama">{t.apiOllama}</option>
          </select>
        </label>
        <div className="mt-counts">
          <span>
            <strong>{status?.tmApplied ?? 0}</strong> {t.tmApplied}
          </span>
          <span>
            <strong>{status?.mtApplied ?? 0}</strong> {t.mtApplied}
          </span>
        </div>
        <p className="hint">{t.apiHint}</p>
      </section>

      {mtRunning ? (
        <p className="notice mt-running" role="status" aria-live="polite">
          {t.mtProgress} : {status?.mt.done ?? 0}/{status?.mt.total ?? 0}
        </p>
      ) : null}
      {status?.mt.state === "offline" && !mtUsed ? (
        <p className="notice">{t.mtOffline}</p>
      ) : null}
      {status?.mt.state === "error" ? <p className="notice">{t.mtError}</p> : null}
      {mtUsed ? <p className="notice mt-warning">{t.mtWarning}</p> : null}
      {status &&
      noTm &&
      !mtUsed &&
      !mtRunning &&
      status.mt.state !== "offline" &&
      status.mt.state !== "error" ? (
        <p className="notice">{t.packMissing}</p>
      ) : null}

      <section className="actions">
        <button
          type="button"
          className="primary"
          onClick={start}
          disabled={busy || !tab || isRestrictedTab(tab.url)}
        >
          {!permitted ? t.enable : isActive ? t.translate : t.start}
        </button>
        <button
          type="button"
          onClick={rescan}
          disabled={busy || !isActive}
          aria-label={t.rescan}
        >
          ↻ {t.rescan}
        </button>
      </section>

      {status?.aborted ? (
        <section className="error-card" role="alert">
          <h2>{t.integrityTitle}</h2>
          <p>{abortMessage(status.abortReason, t)}</p>
          <button type="button" onClick={rescan} disabled={busy}>
            ↻ {t.rescan}
          </button>
        </section>
      ) : null}

      {status?.pendingPageAction ? (
        <section className="card page-guard" role="alertdialog" aria-live="assertive">
          <p className="label">{t.pageClickTitle}</p>
          <p className="guard-name">
            {status.pendingPageAction.spokenName ?? status.pendingPageAction.name}
          </p>
          <span className={`risk ${status.pendingPageAction.risk}`}>{t.highRisk}</span>
          <p className="hint">{t.pageClickHint}</p>
          <div className="confirm-row">
            <button type="button" onClick={confirmPageClick} disabled={busy}>
              {t.pageClickConfirm}
            </button>
            <button type="button" onClick={cancelPageClick} disabled={busy}>
              {t.pageClickCancel}
            </button>
          </div>
        </section>
      ) : null}

      {status && plan ? (
        <section className="card summary">
          <div className="readback-head">
            <h2>{t.summary}</h2>
            <button
              type="button"
              onClick={playAudio}
              disabled={voice !== "ready" || audio === "loading"}
            >
              ▶ {t.speakSummary}
            </button>
          </div>
          <ol className="plan-list">
            {plan.items.map((item) => (
              <li key={item.id} className={`plan-item ${item.kind}`}>
                <span className="kind">{item.kind}</span>
                <span>{item.text}</span>
                {!item.speakable ? <span className="count">🔇</span> : null}
              </li>
            ))}
          </ol>
          <p className="hint">{t.summaryHint}</p>
        </section>
      ) : null}

      <details
        className="card details"
        open={openSentences}
        onToggle={(event) => setOpenSentences(event.currentTarget.open)}
      >
        <summary>
          {t.sentences}
          <span className="count">{status?.sentences.length ?? 0}</span>
        </summary>
        {status?.sentences.length ? (
          <ul className="sentence-list">
            {status.sentences.map((sentence) => (
              <li key={sentence.id} className={`sentence ${sentence.status}`}>
                <div className="sentence-source">
                  <span className="sentence-label">{t.original}</span>
                  <span>{sentence.source}</span>
                </div>
                <div className="sentence-target">
                  <span className="sentence-label">
                    {t.target}
                    {sentence.origin ? (
                      <span className={`origin ${sentence.origin}`}>
                        {sentence.origin === "mt"
                          ? t.mtBadge
                          : sentence.origin === "fixture"
                            ? t.fixtureBadge
                            : t.tmBadge}
                      </span>
                    ) : null}
                  </span>
                  {sentence.target ? (
                    <span lang="fub">{sentence.target}</span>
                  ) : (
                    <span className="missed">{t.missedBadge}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">{t.noSentences}</p>
        )}
      </details>

      <details className="card details">
        <summary>
          {t.protectedValues}
          <span className="count">{status?.protectedValues.length ?? 0}</span>
        </summary>
        {status?.protectedValues.length ? (
          <ul className="value-list">
            {status.protectedValues.map((value) => (
              <li key={`${value.kind}:${value.value}`}>
                <code>{value.value}</code>
                <span className="kind">{value.kind}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">{t.noProtected}</p>
        )}
      </details>

      {status?.actions.length ? (
        <details className="card details">
          <summary>
            {t.actions}
            <span className="count">{status.actions.length}</span>
          </summary>
          <ul className="action-list">
            {actionable.map((action) => (
              <li key={action.id}>
                <div>
                  <span className={`risk ${action.risk}`}>
                    {action.risk === "high"
                      ? t.highRisk
                      : action.risk === "medium"
                        ? t.mediumRisk
                        : t.lowRisk}
                  </span>
                  <span className="action-name">{action.spokenName ?? action.name}</span>
                </div>
                {pendingAction?.id === action.id ? (
                  <div className="confirm-row">
                    <button type="button" onClick={confirmAction} disabled={busy}>
                      {t.confirmAction}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingAction(null);
                        setMessage("");
                      }}
                      disabled={busy}
                    >
                      {t.cancelAction}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => void verifyAction(action)} disabled={busy}>
                    {t.verify}
                  </button>
                )}
              </li>
            ))}
            {locked.map((action) => (
              <li key={action.id} className="locked">
                <div>
                  <span className="risk high">{t.highRisk}</span>
                  <span className="action-name">{action.spokenName ?? action.name}</span>
                </div>
                <span className="locked-note">{t.lockedCheckbox}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {status && (status.step === 4 || status.step === 5) ? (
        <section className="card readback">
          <div className="readback-head">
            <h2>{t.readback}</h2>
            <button type="button" onClick={readSummary} disabled={busy}>
              {t.readbackButton}
            </button>
          </div>
          {readback ? (
            <dl className="readback-grid">
              <div>
                <dt>{t.amount}</dt>
                <dd>{readback.amount ?? t.notFound}</dd>
              </div>
              <div>
                <dt>{t.fee}</dt>
                <dd>{readback.fee ?? t.notFound}</dd>
              </div>
              <div>
                <dt>{t.total}</dt>
                <dd>{readback.total ?? t.notFound}</dd>
              </div>
              <div>
                <dt>{t.beneficiary}</dt>
                <dd>{readback.beneficiary ?? t.notFound}</dd>
              </div>
              <div>
                <dt>{t.phone}</dt>
                <dd>{readback.phone ?? t.notFound}</dd>
              </div>
              <div>
                <dt>{t.reference}</dt>
                <dd>{readback.reference ?? t.notFound}</dd>
              </div>
              <div>
                <dt>{t.operation}</dt>
                <dd>{readback.operation ?? t.notFound}</dd>
              </div>
            </dl>
          ) : null}
          <p className="hint">{t.readbackHint}</p>
        </section>
      ) : null}

      <section className="card audio">
        <div className="audio-head">
          <h2>{t.audio}</h2>
          <span className={`voice ${voice}`}>
            {voice === "stub"
              ? t.audioStub
              : voice === "unavailable"
                ? t.voiceUnavailable
                : voice === "offline" || voice === "unknown"
                  ? t.audioUnavailable
                  : `${t.audio} : ${voice}`}
          </span>
        </div>
        <div className="actions audio-actions">
          <button
            type="button"
            onClick={playAudio}
            disabled={busy || voice !== "ready" || audio === "loading" || !status?.applied}
          >
            ▶ {t.play}
          </button>
          <button type="button" onClick={pauseAudio} disabled={audio !== "playing" && audio !== "paused"}>
            {audio === "paused" ? "▶" : "⏸"} {t.pause}
          </button>
          <button type="button" onClick={toggleSpeed} aria-pressed={settings.speed < 1}>
            🐢 {t.slower} ({settings.speed < 1 ? "0.8×" : "1×"})
          </button>
          <button type="button" onClick={stopAudio} disabled={audio === "idle"}>
            ⏹ {t.stopAudio}
          </button>
        </div>
        {audioError ? <p className="error">{audioError}</p> : null}
      </section>

      {message ? (
        <p className="notice" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}

      <section className="card privacy">
        <p className="label">{t.privacyTitle}</p>
        <p className="privacy-value">{t.privacyValue}</p>
        <p className="hint">{t.privacyHint}</p>
      </section>

      <footer className="footer">
        <span>v0.1.0</span>
        <label className="footer-setting">
          {t.language}
          <select
            value={settings.uiLang}
            onChange={(event) =>
              setSettings((current) => ({ ...current, uiLang: event.target.value as UiLanguage }))
            }
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="ff">Fulfulde (MT)</option>
          </select>
        </label>
        {settings.uiLang === "ff" ? <p className="hint">{t.ffDraftNote}</p> : null}
        <label className="footer-setting" title={t.speakValuesHint}>
          <input
            type="checkbox"
            checked={settings.speakValues}
            onChange={(event) =>
              setSettings((current) => ({ ...current, speakValues: event.target.checked }))
            }
          />
          {t.speakValues}
        </label>
        <span>{t.footer}</span>
      </footer>
    </main>
  );
}
