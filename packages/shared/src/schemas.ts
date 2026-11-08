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

export const textUnitSchema = z.object({
  nodeId: z.string(),
  text: z.string(),
  normalized: z.string(),
  lang: z.enum(["fr", "en", "ff", "unknown"]),
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
  target: z.object({ ff: z.string() }),
  placeholders: z.array(z.string()).optional(),
  risk: z.enum(["low", "medium", "high"]),
  protected: z.boolean().optional(),
  validatedBy: z.array(z.string()),
  backTranslationFr: z.string(),
  version: z.string(),
});

export const phraseEntrySchema = z.object({
  id: z.string(),
  version: z.string(),
  category: z.string(),
  risk: z.enum(["low", "medium", "high"]),
  fr: z.string(),
  en: z.string(),
  ff: z.string(),
  segments: z.array(z.union([z.object({ audio: z.string() }), z.object({ slot: z.string() })])),
  slots: z.record(
    z.string(),
    z.object({
      type: z.string(),
      currency: z.string().optional(),
      doNotTranslate: z.boolean().optional(),
    }),
  ),
  validatedBy: z.array(z.string()),
  backTranslationFr: z.string(),
});

export const sentenceViewSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string().nullable(),
  status: z.enum(["applied", "missed"]),
  risk: z.enum(["low", "medium", "high", "unknown"]),
  protectedReason: protectedReasonSchema.optional(),
});

export const protectedValueViewSchema = z.object({
  value: z.string(),
  kind: placeholderKindSchema,
  reason: protectedReasonSchema.optional(),
});

export const actionViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(["button", "link", "input", "select", "checkbox"]),
  risk: z.enum(["low", "medium", "high"]),
  enabled: z.boolean(),
  locked: z.boolean(),
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
  protectedCount: z.number().int().min(0),
  missed: z.number().int().min(0),
  translations: z.number().int().min(0),
  sentences: z.array(sentenceViewSchema),
  protectedValues: z.array(protectedValueViewSchema),
  actions: z.array(actionViewSchema),
  actionSnapshotId: z.string(),
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
  uiLang: z.enum(["fr", "en"]),
  speed: z.number().min(0.5).max(2),
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
