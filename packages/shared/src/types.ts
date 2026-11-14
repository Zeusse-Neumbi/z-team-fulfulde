export type Role =
  | "heading"
  | "text"
  | "label"
  | "button"
  | "link"
  | "input"
  | "select"
  | "checkbox"
  | "alert"
  | "table"
  | "listitem"
  | "status";

export type PlaceholderKind =
  | "amount"
  | "fee"
  | "person"
  | "phone"
  | "account"
  | "reference"
  | "date"
  | "user_input"
  | "other";

export type Classification = "translatable" | "protected" | "ignore";

/** ISO 639-3 target language code. A plain string: adding one needs no code. */
export type LanguageCode = string;

export type LanguageStatus = "validated" | "draft" | "text-only";

export type LanguageTargetOrigin = "human" | "mt" | "seed";

/** One target language for one phrasebank entry. */
export interface LanguageTarget {
  text: string;
  origin: LanguageTargetOrigin;
  validatedBy: string[];
  backTranslationFr: string;
}

export interface LanguageRegistryEntry {
  code: LanguageCode;
  endonym: string;
  names: Record<string, string>;
  script: string;
  direction: "ltr" | "rtl";
  orthography: string;
  status: LanguageStatus;
  letters: string;
  mt: { provider: string; model: string; pivot: string };
  speech: {
    provider: string;
    model: string;
    tone: "none" | "partial" | "full";
    /** Bundled clips, local API only, or no voice for this language. */
    voice: "bundled" | "api" | "none";
    substitutions: Record<string, string>;
  };
  numbers: string;
  pack: string;
}

export interface NumbersLexicon {
  version: string;
  units: string[];
  tens: Record<string, string>;
  hundred: string;
  thousand: string;
  million: string;
  billion: string;
  and: string;
  plus: string;
  minus: string;
  currency: string;
}

export type ProtectedReason =
  | "value"
  | "name"
  | "phone"
  | "account"
  | "reference"
  | "date"
  | "user_input"
  | "code";

export interface TextUnit {
  nodeId: string;
  text: string;
  normalized: string;
  lang: "fr" | "en" | "unknown" | LanguageCode;
  classification: Classification;
  protectedReason?: ProtectedReason;
  parentRole?: Role;
  appliedTranslation?: string;
  translationSource?: "tm" | "mt" | "none";
}

export interface Placeholder {
  token: string;
  kind: PlaceholderKind;
  currency?: "XAF" | "EUR" | "USD";
  display: string;
  normalized?: string;
  doNotTranslate: boolean;
  sourceNodeId: string;
}

export type ActionIntent =
  | "CHECK_BALANCE"
  | "SEE_FEES"
  | "START_TRANSFER"
  | "NEXT"
  | "BACK"
  | "CONFIRM"
  | "CANCEL"
  | "EDIT"
  | "RETRY"
  | "REPEAT"
  | "SLOWER"
  | "TOGGLE_LANGUAGE"
  | "UNKNOWN";

export interface ActionDescriptor {
  id: string;
  role: "button" | "link" | "input" | "select" | "checkbox";
  name: string;
  intent: ActionIntent;
  risk: "low" | "medium" | "high";
  enabled: boolean;
  requiredConfirmation?: boolean;
  expectedEffect?: "navigate" | "submit" | "toggle" | "fill" | "unknown";
  fingerprint: string;
  snapshotId: string;
}

export interface PageSnapshot {
  url: string;
  title: string;
  langHint: string;
  units: TextUnit[];
  placeholders: Placeholder[];
  actions: ActionDescriptor[];
  signature: string;
  valueSignature: string;
  scannedAt: number;
  schemaVersion: string;
}

export interface TranslationUnit {
  id: string;
  source: { fr: string; en: string };
  target: Record<LanguageCode, LanguageTarget>;
  /** Candidate-pack only: the MT run preserved every placeholder. */
  mtPlaceholdersOk?: boolean;
  /** Candidate-pack only: a reviewer marked the target unsafe to apply. */
  mtWithheld?: boolean;
  mtWithheldReason?: string;
  placeholders?: string[];
  risk: "low" | "medium" | "high";
  protected?: boolean;
  version: string;
}

export interface PhraseEntry {
  id: string;
  version: string;
  category: string;
  risk: "low" | "medium" | "high";
  fr: string;
  en: string;
  target: Record<LanguageCode, LanguageTarget>;
  /** Candidate-pack only: the MT run preserved every placeholder. */
  mtPlaceholdersOk?: boolean;
  /** Candidate-pack only: a reviewer marked the target unsafe to apply. */
  mtWithheld?: boolean;
  mtWithheldReason?: string;
  segments: Array<{ audio: string } | { slot: string }>;
  slots: Record<string, { type: string; currency?: string; doNotTranslate?: boolean }>;
}

export interface SayItem {
  key: string;
  slots?: Record<string, string>;
}

export interface Analysis {
  requestId: string;
  schemaVersion: string;
  phrasebankVersion: string;
  pageType: string;
  confidence: number;
  say: SayItem[];
  actions: Array<{ id: string; intent: ActionIntent; risk: "low" | "medium" | "high" }>;
  translation: {
    applied: number;
    protected: number;
    missed: number;
    coverage: number;
  };
  meta: {
    analyzer: string;
    latencyMs: number;
    cached: boolean;
  };
}

export type ExtensionMessage =
  | { type: "PING" }
  | { type: "START_TRANSLATION"; force?: boolean; api?: MtRequestOptions }
  | { type: "STOP_TRANSLATION" }
  | { type: "RESCAN"; api?: MtRequestOptions }
  | { type: "GET_STATUS" }
  | { type: "GET_READBACK" }
  | { type: "HIGHLIGHT_ACTION"; actionId: string; snapshotId: string }
  | { type: "CONFIRM_PAGE_ACTION"; actionId: string; snapshotId: string }
  | { type: "CANCEL_PAGE_ACTION" }
  | { type: "PAGE_ACTION_CLICKED"; actionId: string; name: string; risk: ActionView["risk"] }
  | { type: "MT_TRANSLATE"; texts: string[]; source: "fr" | "en"; provider?: string | null; baseUrl?: string | null; targetLang?: string }
  | { type: "MT_CLEAR_CACHE" }
  | { type: "MT_PROGRESS"; done: number; total: number };

export type PanelStep = 1 | 2 | 3 | 4 | 5 | "unknown";
export type PageLanguage = "fr" | "en" | "unknown";
export type UiLanguage = "fr" | "en" | "ff";

export type PageKind =
  | "balance"
  | "fees"
  | "beneficiary"
  | "summary"
  | "receipt"
  | "error"
  | "unknown";

export interface PageBriefSection {
  heading: string;
  text: string;
}

export interface PageBrief {
  kind: PageKind;
  title?: string;
  purpose?: string;
  sections: PageBriefSection[];
  warnings: string[];
  actions: string[];
}

export interface PageCoverage {
  tracked: number;
  changed: number;
  percent: number;
  protectedOnly: number;
  safeCeiling: number;
}

/** Validated TM first, local API for misses, or the API first. */
export type MtMode = "off" | "fallback" | "primary";
export type MtState = "off" | "ready" | "running" | "offline" | "error";
export type TranslationOrigin = "tm" | "mt" | "fixture";

export interface MtStatus {
  mode: MtMode;
  state: MtState;
  provider?: string;
  model?: string;
  done: number;
  total: number;
  error?: string;
}

export interface MtRequestOptions {
  mode: MtMode;
  provider: string | null;
  baseUrl?: string;
  /** Target language pack; absent means the default (fub). */
  targetLang?: string;
}

export interface MtTranslation {
  source: string;
  target: string;
  provider: string;
  model: string;
}

export interface MtTranslateResponse {
  ok: boolean;
  baseUrl?: string;
  provider?: string;
  model?: string;
  translations?: MtTranslation[];
  error?: string;
}

export interface SentenceView {
  id: string;
  source: string;
  target: string | null;
  status: "applied" | "missed";
  risk: "low" | "medium" | "high" | "unknown";
  protectedReason?: ProtectedReason;
  /**
   * Set when a translation was deliberately kept in the source language.
   * `label_collision`: the draft would have made two different controls read
   * the same, so a user could not tell confirm from cancel.
   */
  holdReason?: "label_collision";
  /** Where the applied target came from. */
  origin?: TranslationOrigin;
  provider?: string;
}

export interface ProtectedValueView {
  value: string;
  kind: PlaceholderKind;
  reason?: ProtectedReason;
}

export interface ActionView {
  id: string;
  /** Original page name, used for risk and snapshots. */
  name: string;
  /** Current accessible name after translation, when it differs. */
  spokenName?: string;
  role: "button" | "link" | "input" | "select" | "checkbox";
  risk: "low" | "medium" | "high";
  enabled: boolean;
  locked: boolean;
}

export interface Readback {
  amount?: string;
  fee?: string;
  total?: string;
  beneficiary?: string;
  phone?: string;
  reference?: string;
  operation?: string;
}

export interface TranslationStatus {
  active: boolean;
  url: string;
  title: string;
  step: PanelStep;
  language: PageLanguage;
  coverage: number;
  applied: number;
  /** Applied strings whose target came from the validated TM. */
  tmApplied: number;
  /** Applied strings whose target came from the local API. */
  mtApplied: number;
  protectedCount: number;
  missed: number;
  /** Number of validated TM units bundled in the build. */
  translations: number;
  mt: MtStatus;
  pageBrief?: PageBrief;
  pageCoverage?: PageCoverage;
  sentences: SentenceView[];
  protectedValues: ProtectedValueView[];
  actions: ActionView[];
  actionSnapshotId: string;
  /** A high-risk page click that was paused for confirmation. */
  pendingPageAction?: ActionView;
  aborted: boolean;
  abortReason?: string;
  lastError?: string;
}

export interface PanelSettings {
  uiLang: UiLanguage;
  /** Target language for page translation, independent of the panel UI. */
  targetLang: LanguageCode;
  speed: number;
  /** Speak exact page values through a local TTS only. */
  speakValues: boolean;
  /** Off, validated TM then local API, or local API first. */
  apiTranslation: MtMode;
  /** API provider override; null uses the API default. */
  mtProvider: string | null;
}
