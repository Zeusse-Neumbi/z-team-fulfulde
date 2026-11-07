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
