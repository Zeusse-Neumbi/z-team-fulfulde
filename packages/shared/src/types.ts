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
  lang: "fr" | "en" | "ff" | "unknown";
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
  target: { ff: string };
  placeholders?: string[];
  risk: "low" | "medium" | "high";
  protected?: boolean;
  validatedBy: string[];
  backTranslationFr: string;
  version: string;
}

export interface PhraseEntry {
  id: string;
  version: string;
  category: string;
  risk: "low" | "medium" | "high";
  fr: string;
  en: string;
  ff: string;
  segments: Array<{ audio: string } | { slot: string }>;
  slots: Record<string, { type: string; currency?: string; doNotTranslate?: boolean }>;
  validatedBy: string[];
  backTranslationFr: string;
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
  | { type: "START_TRANSLATION"; force?: boolean }
  | { type: "STOP_TRANSLATION" }
  | { type: "RESCAN" }
  | { type: "GET_STATUS" }
  | { type: "GET_READBACK" }
  | { type: "HIGHLIGHT_ACTION"; actionId: string; snapshotId: string };

export type PanelStep = 1 | 2 | 3 | 4 | 5 | "unknown";
export type PageLanguage = "fr" | "en" | "unknown";
export type UiLanguage = "fr" | "en";

export interface SentenceView {
  id: string;
  source: string;
  target: string | null;
  status: "applied" | "missed";
  risk: "low" | "medium" | "high" | "unknown";
  protectedReason?: ProtectedReason;
}

export interface ProtectedValueView {
  value: string;
  kind: PlaceholderKind;
  reason?: ProtectedReason;
}

export interface ActionView {
  id: string;
  name: string;
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
  protectedCount: number;
  missed: number;
  translations: number;
  sentences: SentenceView[];
  protectedValues: ProtectedValueView[];
  actions: ActionView[];
  actionSnapshotId: string;
  aborted: boolean;
  abortReason?: string;
  lastError?: string;
}

export interface PanelSettings {
  uiLang: UiLanguage;
  speed: number;
}
