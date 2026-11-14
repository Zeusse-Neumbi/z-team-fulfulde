import { z } from "zod";

export const roleSchema = z.enum([
  "heading",
  "text",
  "label",
  "button",
  "link",
  "input",
  "select",
  "checkbox",
  "alert",
  "table",
  "listitem",
  "status",
]);

export const placeholderKindSchema = z.enum([
  "amount",
  "fee",
  "person",
  "phone",
  "account",
  "reference",
  "date",
  "user_input",
  "other",
]);

export const protectedReasonSchema = z.enum([
  "value",
  "name",
  "phone",
  "account",
  "reference",
  "date",
  "user_input",
  "code",
]);

/** ISO 639-3. Deliberately not a z.enum: adding a language must not need code. */
export const languageCodeSchema = z.string().regex(/^[a-z]{3}$/);

/** Source languages the phrasebank ships today (ISO 639-1). */
export const sourceLanguageCodeSchema = z.string().regex(/^[a-z]{2,3}$/);

export const languageStatusSchema = z.enum(["validated", "draft", "text-only"]);

export const languageTargetOriginSchema = z.enum(["human", "mt", "seed"]);

export const languageTargetSchema = z.object({
  text: z.string(),
  origin: languageTargetOriginSchema,
  validatedBy: z.array(z.string()).default([]),
  backTranslationFr: z.string().default(""),
});

export const numbersLexiconSchema = z.object({
  version: z.string(),
  units: z.array(z.string()),
  tens: z.record(z.string(), z.string()),
  hundred: z.string(),
  thousand: z.string(),
  million: z.string(),
  billion: z.string(),
  and: z.string(),
  plus: z.string(),
  minus: z.string(),
  currency: z.string(),
});

/** One `languages/<code>.yaml` row. Adding a language is one file, no code. */
export const languageRegistryEntrySchema = z.object({
  code: languageCodeSchema,
  endonym: z.string().min(1),
  names: z.record(sourceLanguageCodeSchema, z.string()),
  script: z.string().min(1),
  direction: z.enum(["ltr", "rtl"]),
  orthography: z.string().min(1),
  status: languageStatusSchema,
  letters: z.string(),
  mt: z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    pivot: z.string().min(1),
  }),
  speech: z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    tone: z.enum(["none", "partial", "full"]),
    substitutions: z.record(z.string(), z.string()).default({}),
  }),
  numbers: z.string().min(1),
  pack: z.string().min(1),
});

export const textUnitSchema = z.object({
  nodeId: z.string(),
  text: z.string(),
  normalized: z.string(),
  lang: z.union([z.enum(["fr", "en", "unknown"]), languageCodeSchema]),
  classification: z.enum(["translatable", "protected", "ignore"]),
  protectedReason: protectedReasonSchema.optional(),
  parentRole: roleSchema.optional(),
  appliedTranslation: z.string().optional(),
  translationSource: z.enum(["tm", "mt", "none"]).optional(),
});

export const placeholderSchema = z.object({
  token: z.string(),
  kind: placeholderKindSchema,
  currency: z.enum(["XAF", "EUR", "USD"]).optional(),
  display: z.string(),
  normalized: z.string().optional(),
  doNotTranslate: z.boolean(),
  sourceNodeId: z.string(),
});

export const actionDescriptorSchema = z.object({
  id: z.string(),
  role: z.enum(["button", "link", "input", "select", "checkbox"]),
  name: z.string(),
  intent: z.enum([
    "CHECK_BALANCE",
    "SEE_FEES",
    "START_TRANSFER",
    "NEXT",
    "BACK",
    "CONFIRM",
    "CANCEL",
    "EDIT",
    "RETRY",
    "REPEAT",
    "SLOWER",
    "TOGGLE_LANGUAGE",
    "UNKNOWN",
  ]),
  risk: z.enum(["low", "medium", "high"]),
  enabled: z.boolean(),
  requiredConfirmation: z.boolean().optional(),
  expectedEffect: z.enum(["navigate", "submit", "toggle", "fill", "unknown"]).optional(),
  fingerprint: z.string(),
  snapshotId: z.string(),
});

export const pageSnapshotSchema = z.object({
  url: z.string(),
  title: z.string(),
  langHint: z.string(),
  units: z.array(textUnitSchema),
  placeholders: z.array(placeholderSchema),
  actions: z.array(actionDescriptorSchema),
  signature: z.string(),
  valueSignature: z.string(),
  scannedAt: z.number(),
  schemaVersion: z.string(),
});

export const translationUnitSchema = z.object({
  id: z.string(),
  source: z.object({ fr: z.string(), en: z.string() }),
  target: z.record(languageCodeSchema, languageTargetSchema),
  /** Candidate-pack only: the MT run preserved every placeholder. */
  mtPlaceholdersOk: z.boolean().optional(),
  /** Candidate-pack only: a reviewer marked the target unsafe to apply. */
  mtWithheld: z.boolean().optional(),
  mtWithheldReason: z.string().optional(),
  placeholders: z.array(z.string()).optional(),
  risk: z.enum(["low", "medium", "high"]),
  protected: z.boolean().optional(),
  version: z.string(),
});

export const phraseEntrySchema = z.object({
  id: z.string(),
  version: z.string(),
  category: z.string(),
  risk: z.enum(["low", "medium", "high"]),
  fr: z.string(),
  en: z.string(),
  target: z.record(languageCodeSchema, languageTargetSchema),
  /** Candidate-pack only: the MT run preserved every placeholder. */
  mtPlaceholdersOk: z.boolean().optional(),
  /** Candidate-pack only: a reviewer marked the target unsafe to apply. */
  mtWithheld: z.boolean().optional(),
  mtWithheldReason: z.string().optional(),
  segments: z.array(z.union([z.object({ audio: z.string() }), z.object({ slot: z.string() })])),
  slots: z.record(
    z.string(),
    z.object({
      type: z.string(),
      currency: z.string().optional(),
      doNotTranslate: z.boolean().optional(),
    }),
  ),
});

export const mtModeSchema = z.enum(["off", "fallback", "primary"]);

export const mtStatusSchema = z.object({
  mode: mtModeSchema,
  state: z.enum(["off", "ready", "running", "offline", "error"]),
  provider: z.string().optional(),
  model: z.string().optional(),
  done: z.number().int().min(0),
  total: z.number().int().min(0),
  error: z.string().optional(),
});

export const sentenceViewSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string().nullable(),
  status: z.enum(["applied", "missed"]),
  risk: z.enum(["low", "medium", "high", "unknown"]),
  protectedReason: protectedReasonSchema.optional(),
  holdReason: z.enum(["label_collision"]).optional(),
  origin: z.enum(["tm", "mt", "fixture"]).optional(),
  provider: z.string().optional(),
});

export const protectedValueViewSchema = z.object({
  value: z.string(),
  kind: placeholderKindSchema,
  reason: protectedReasonSchema.optional(),
});

export const actionViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  spokenName: z.string().optional(),
  role: z.enum(["button", "link", "input", "select", "checkbox"]),
  risk: z.enum(["low", "medium", "high"]),
  enabled: z.boolean(),
  locked: z.boolean(),
});

export const pageKindSchema = z.enum([
  "balance",
  "fees",
  "beneficiary",
  "summary",
  "receipt",
  "error",
  "unknown",
]);

export const pageBriefSchema = z.object({
  kind: pageKindSchema,
  title: z.string().optional(),
  purpose: z.string().optional(),
  sections: z.array(z.object({ heading: z.string(), text: z.string() })),
  warnings: z.array(z.string()),
  actions: z.array(z.string()),
});

export const pageCoverageSchema = z.object({
  tracked: z.number().int().min(0),
  changed: z.number().int().min(0),
  percent: z.number().min(0).max(100),
  protectedOnly: z.number().int().min(0),
  safeCeiling: z.number().min(0).max(100),
});

export const translationStatusSchema = z.object({
  active: z.boolean(),
  url: z.string(),
  title: z.string(),
  step: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal("unknown"),
  ]),
  language: z.enum(["fr", "en", "unknown"]),
  coverage: z.number().min(0).max(1),
  applied: z.number().int().min(0),
  tmApplied: z.number().int().min(0),
  mtApplied: z.number().int().min(0),
  protectedCount: z.number().int().min(0),
  missed: z.number().int().min(0),
  translations: z.number().int().min(0),
  mt: mtStatusSchema,
  pageBrief: pageBriefSchema.optional(),
  pageCoverage: pageCoverageSchema.optional(),
  sentences: z.array(sentenceViewSchema),
  protectedValues: z.array(protectedValueViewSchema),
  actions: z.array(actionViewSchema),
  actionSnapshotId: z.string(),
  pendingPageAction: actionViewSchema.optional(),
  aborted: z.boolean(),
  abortReason: z.string().optional(),
  lastError: z.string().optional(),
});

export const readbackSchema = z.object({
  amount: z.string().optional(),
  fee: z.string().optional(),
  total: z.string().optional(),
  beneficiary: z.string().optional(),
  phone: z.string().optional(),
  reference: z.string().optional(),
  operation: z.string().optional(),
});

export const panelSettingsSchema = z.object({
  uiLang: z.enum(["fr", "en", "ff"]),
  /** Target language for page translation. Independent of `uiLang`. */
  targetLang: languageCodeSchema.default("fub"),
  speed: z.number().min(0.5).max(2),
  /** Speak exact page values through the local TTS (never a cloud voice). */
  speakValues: z.boolean().default(false),
  apiTranslation: mtModeSchema.default("fallback"),
  mtProvider: z.string().min(1).max(40).nullable().default(null),
});

export const analysisSchema = z.object({
  requestId: z.string(),
  schemaVersion: z.string(),
  phrasebankVersion: z.string(),
  pageType: z.string(),
  confidence: z.number().min(0).max(1),
  say: z.array(z.object({ key: z.string(), slots: z.record(z.string(), z.string()).optional() })),
  actions: z.array(
    z.object({
      id: z.string(),
      intent: actionDescriptorSchema.shape.intent,
      risk: z.enum(["low", "medium", "high"]),
    }),
  ),
  translation: z.object({
    applied: z.number(),
    protected: z.number(),
    missed: z.number(),
    coverage: z.number(),
  }),
  meta: z.object({
    analyzer: z.string(),
    latencyMs: z.number(),
    cached: z.boolean(),
  }),
});
