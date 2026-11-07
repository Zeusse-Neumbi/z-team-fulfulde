import type { TranslationStatus } from "@zteam/shared";
import { useCallback, useEffect, useState } from "react";
import { getActiveTab, originOf, sendToTab } from "../../lib/messages";
import {
  hasOriginPermission,
  injectContentScript,
  requestOriginPermission,
} from "../../lib/permissions";

const API = "http://127.0.0.1:8000";

function percent(value: number): string {
  return `${Math.round(value * 100)} %`;
}

export default function App() {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [status, setStatus] = useState<TranslationStatus | null>(null);
  const [permitted, setPermitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [audioError, setAudioError] = useState<string>("");

  const refresh = useCallback(async () => {
    const activeTab = await getActiveTab();
    setTab(activeTab);
    const origin = originOf(activeTab?.url);
    setPermitted(origin ? await hasOriginPermission(origin) : false);

    if (activeTab?.id) {
      try {
        const current = await sendToTab<TranslationStatus>(activeTab.id, {
          type: "GET_STATUS",
        });
        setStatus(current);
      } catch {
        setStatus(null);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function withTab<T>(fn: (tab: chrome.tabs.Tab) => Promise<T>): Promise<T | null> {
    const activeTab = tab ?? (await getActiveTab());
    if (!activeTab?.id) {
      setMessage("Aucun onglet actif.");
      return null;
    }
    setTab(activeTab);
    setBusy(true);
    setMessage("");
    try {
      return await fn(activeTab);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function enableOnSite() {
    await withTab(async (activeTab) => {
      const origin = originOf(activeTab.url);
      if (!origin) throw new Error("Origine de la page introuvable.");
      const granted = await requestOriginPermission(origin);
      if (!granted) throw new Error("Permission refusée.");
      setPermitted(true);
      try {
        await injectContentScript(activeTab.id as number);
      } catch {
        // The manifest content script may already be present on demo origins.
      }
      const next = await sendToTab<TranslationStatus>(activeTab.id as number, {
        type: "START_TRANSLATION",
      });
      setStatus(next);
    });
  }

  async function translate() {
    await withTab(async (activeTab) => {
      const next = await sendToTab<TranslationStatus>(activeTab.id as number, {
        type: "START_TRANSLATION",
      });
      setStatus(next);
    });
  }

  async function rescan() {
    await withTab(async (activeTab) => {
      const next = await sendToTab<TranslationStatus>(activeTab.id as number, {
        type: "RESCAN",
      });
      setStatus(next);
    });
  }

  async function stop() {
    await withTab(async (activeTab) => {
      const next = await sendToTab<TranslationStatus>(activeTab.id as number, {
        type: "STOP_TRANSLATION",
      });
      setStatus(next);
    });
  }

  async function testAudio() {
    setBusy(true);
    setAudioError("");
    try {
      const response = await fetch(`${API}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Bonjour", voice: "demo", speed: 1 }),
      });
      if (!response.ok) throw new Error(`Backend ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
      await audio.play();
      setMessage("Audio de test joué (stub local).");
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function testMicrophone() {
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      setMessage("Microphone accessible. Le classificateur d'intentions n'est pas encore branché.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Z-Team</p>
          <h1>Fulfulde assistant</h1>
        </div>
        <span className={`badge ${status?.active ? "on" : "off"}`}>
          {status?.active ? "Actif" : "Inactif"}
        </span>
      </header>

      <section className="card">
        <p className="label">Page</p>
        <p className="page-title">{status?.title ?? tab?.title ?? "Aucune page"}</p>
        <p className="url">{status?.url ?? tab?.url ?? ""}</p>
      </section>

      <section className="card stats">
        <div>
          <span className="stat-value">{status ? percent(status.coverage) : "—"}</span>
          <span className="stat-label">Couverture</span>
        </div>
        <div>
          <span className="stat-value">{status?.applied ?? "—"}</span>
          <span className="stat-label">Traduits</span>
        </div>
        <div>
          <span className="stat-value">{status?.protectedCount ?? "—"}</span>
          <span className="stat-label">Protégés</span>
        </div>
        <div>
          <span className="stat-value">{status?.missed ?? "—"}</span>
          <span className="stat-label">Manquants</span>
        </div>
      </section>

      <section className="actions">
        <button type="button" className="primary" onClick={enableOnSite} disabled={busy}>
          {permitted ? "Démarrer sur cette page" : "Activer sur ce site"}
        </button>
        <button type="button" onClick={translate} disabled={busy}>
          Traduire la page
        </button>
        <button type="button" onClick={rescan} disabled={busy}>
          Rescanner
        </button>
        <button type="button" className="danger" onClick={stop} disabled={busy}>
          Arrêter / restaurer
        </button>
      </section>

      <section className="actions audio">
        <button type="button" onClick={testAudio} disabled={busy}>
          🔊 Tester l'audio
        </button>
        <button type="button" onClick={testMicrophone} disabled={busy}>
          🎤 Tester le micro
        </button>
      </section>

      <section className="card privacy">
        <p className="label">Ce qui quitte cette page</p>
        <p className="privacy-value">Rien — traitement local</p>
        <p className="hint">
          La traduction, la mémoire de traduction et les valeurs financières restent dans le
          navigateur. Aucun appel cloud n'est effectué.
        </p>
      </section>

      {message ? <p className="notice">{message}</p> : null}
      {audioError ? <p className="error">Audio : {audioError}</p> : null}

      <footer className="footer">
        <span>v0.1.0</span>
        <span>Local-first · Adamawa Fulfulde (fub)</span>
      </footer>
    </main>
  );
}
