import type { UiLanguage } from "@zteam/shared";

export interface PanelCopy {
  eyebrow: string;
  title: string;
  active: string;
  inactive: string;
  error: string;
  translating: string;
  page: string;
  noPage: string;
  step: string;
  stepUnknown: string;
  stepLabels: Record<1 | 2 | 3 | 4 | 5, string>;
  pageLanguage: string;
  coverage: string;
  translated: string;
  protected: string;
  missed: string;
  enable: string;
  start: string;
  translate: string;
  rescan: string;
  stop: string;
  noTab: string;
  unsupported: string;
  noContent: string;
  permissionDenied: string;
  busy: string;
  sentences: string;
  noSentences: string;
  packMissing: string;
  original: string;
  target: string;
  missedBadge: string;
  appliedBadge: string;
  protectedValues: string;
  noProtected: string;
  actions: string;
  showOnPage: string;
  lockedCheckbox: string;
  highRisk: string;
  mediumRisk: string;
  lowRisk: string;
  readback: string;
  readbackButton: string;
  readbackHint: string;
  amount: string;
  fee: string;
  total: string;
  beneficiary: string;
  phone: string;
  reference: string;
  operation: string;
  notFound: string;
  audio: string;
  play: string;
  pause: string;
  slower: string;
  stopAudio: string;
  audioStub: string;
  audioUnavailable: string;
  voiceUnavailable: string;
  cloudDisabled: string;
  noSpeech: string;
  audioError: string;
  privacyTitle: string;
  privacyValue: string;
  privacyHint: string;
  integrityTitle: string;
  abortProtected: string;
  abortMixed: string;
  abortTarget: string;
  abortUnknown: string;
  staleAction: string;
  highlighted: string;
  settings: string;
  language: string;
  footer: string;
  refresh: string;
  summary: string;
  speakSummary: string;
  summaryHint: string;
  verify: string;
  confirmAction: string;
  cancelAction: string;
  actionSpoken: string;
  valuesNotSpoken: string;
  actionsPlanNote: string;
  noContentPlan: string;
}

export const copy: Record<UiLanguage, PanelCopy> = {
  fr: {
    eyebrow: "Z-Team",
    title: "Assistant Fulfulde",
    active: "Actif",
    inactive: "Inactif",
    error: "Erreur",
    translating: "Traduction…",
    page: "Page",
    noPage: "Aucune page",
    step: "Étape",
    stepUnknown: "Étape inconnue",
    stepLabels: {
      1: "Solde",
      2: "Frais",
      3: "Bénéficiaire",
      4: "Récapitulatif",
      5: "Confirmation",
    },
    pageLanguage: "Langue de la page",
    coverage: "Couverture des textes traduisibles",
    translated: "Traduits",
    protected: "Protégés",
    missed: "Manquants",
    enable: "Activer sur ce site",
    start: "Démarrer sur cette page",
    translate: "Traduire la page",
    rescan: "Rescanner",
    stop: "Arrêter / restaurer",
    noTab: "Aucun onglet actif.",
    unsupported: "Page non prise en charge (chrome://, PDF, page interne).",
    noContent: "Activez d’abord l’extension sur ce site.",
    permissionDenied: "Permission refusée.",
    busy: "Traitement…",
    sentences: "Phrases de cette étape",
    noSentences: "Aucune phrase traduisible détectée.",
    packMissing:
      "Aucune traduction fulfulde n’est installée. La page reste dans sa langue d’origine ; le pipeline et les valeurs protégées sont actifs.",
    original: "Original",
    target: "Fulfulde",
    missedBadge: "manquant",
    appliedBadge: "traduit",
    protectedValues: "Valeurs protégées",
    noProtected: "Aucune valeur financière détectée.",
    actions: "Actions de la page",
    showOnPage: "Montrer",
    lockedCheckbox: "À cocher par vous",
    highRisk: "Risque élevé",
    mediumRisk: "Risque moyen",
    lowRisk: "Risque faible",
    readback: "Récapitulatif à vérifier",
    readbackButton: "Lire le récapitulatif",
    readbackHint:
      "Vérifiez les valeurs affichées, puis appuyez vous-même sur le bouton de confirmation dans la page. L’extension ne clique jamais à votre place.",
    amount: "Montant",
    fee: "Frais",
    total: "Total débité",
    beneficiary: "Bénéficiaire",
    phone: "Téléphone",
    reference: "Référence",
    operation: "Opération",
    notFound: "—",
    audio: "Audio",
    play: "Lire",
    pause: "Pause",
    slower: "Plus lent",
    stopAudio: "Couper",
    audioStub:
      "Voix non disponible : le serveur local renvoie un silence de test, pas du fulfulde.",
    audioUnavailable: "Voix non disponible sur ce serveur local.",
    voiceUnavailable:
      "Le modèle de voix configuré n’est pas prêt (modèle ou clé manquants). Voir docs/MODELS.md.",
    cloudDisabled:
      "La voix cloud est désactivée. Activez ZTEAM_ALLOW_CLOUD=1 uniquement pour un test.",
    noSpeech: "Aucune phrase traduite à lire.",
    audioError: "Lecture audio impossible.",
    privacyTitle: "Ce qui quitte cette page",
    privacyValue: "Rien — traitement local",
    privacyHint:
      "Aucune donnée ne quitte cet appareil. Le service local 127.0.0.1 ne reçoit que le texte à prononcer.",
    integrityTitle: "Intégrité compromise",
    abortProtected: "Une valeur protégée a changé. La traduction a été annulée et la page restaurée.",
    abortMixed: "Une traduction ne préservait pas une valeur. La traduction a été annulée.",
    abortTarget:
      "Une traduction introduisait une valeur absente de la page. La traduction a été annulée.",
    abortUnknown: "La traduction a été annulée pour protéger la page.",
    staleAction: "Cette action a changé. Rescannez la page.",
    highlighted: "Action montrée sur la page. Appuyez dessus vous-même.",
    settings: "Réglages",
    language: "Langue de l’interface",
    footer: "Local-first · Adamawa Fulfulde (fub)",
    refresh: "Rafraîchir",
    summary: "Résumé de la page",
    speakSummary: "Lire le résumé",
    summaryHint:
      "L’assistant lit l’essentiel et les actions à faire, jamais toute la page. Les montants restent à l’écran.",
    verify: "Vérifier",
    confirmAction: "Confirmer",
    cancelAction: "Annuler",
    actionSpoken: "Action annoncée. Confirmez pour la montrer sur la page.",
    valuesNotSpoken:
      "Les montants, comptes et références ne sont pas lus à voix haute : vérifiez-les à l’écran.",
    actionsPlanNote: "Actions possibles ci-dessous.",
    noContentPlan: "Aucun texte à résumer."
  },
  en: {
    eyebrow: "Z-Team",
    title: "Fulfulde assistant",
    active: "Active",
    inactive: "Inactive",
    error: "Error",
    translating: "Translating…",
    page: "Page",
    noPage: "No page",
    step: "Step",
    stepUnknown: "Unknown step",
    stepLabels: {
      1: "Balance",
      2: "Fees",
      3: "Beneficiary",
      4: "Summary",
      5: "Confirmation",
    },
    pageLanguage: "Page language",
    coverage: "Translatable text coverage",
    translated: "Translated",
    protected: "Protected",
    missed: "Missed",
    enable: "Enable on this site",
    start: "Start on this page",
    translate: "Translate the page",
    rescan: "Rescan",
    stop: "Stop / restore",
    noTab: "No active tab.",
    unsupported: "Unsupported page (chrome://, PDF, internal page).",
    noContent: "Enable the extension on this site first.",
    permissionDenied: "Permission denied.",
    busy: "Working…",
    sentences: "Sentences on this step",
    noSentences: "No translatable sentence detected.",
    packMissing:
      "No Fulfulde translation pack is installed. The page stays in its original language; the pipeline and protected values are still active.",
    original: "Original",
    target: "Fulfulde",
    missedBadge: "missed",
    appliedBadge: "translated",
    protectedValues: "Protected values",
    noProtected: "No financial value detected.",
    actions: "Page actions",
    showOnPage: "Show",
    lockedCheckbox: "You must check this yourself",
    highRisk: "High risk",
    mediumRisk: "Medium risk",
    lowRisk: "Low risk",
    readback: "Summary to verify",
    readbackButton: "Read the summary",
    readbackHint:
      "Check the displayed values, then tap the confirmation button on the page yourself. The extension never clicks it for you.",
    amount: "Amount",
    fee: "Fee",
    total: "Total debited",
    beneficiary: "Beneficiary",
    phone: "Phone",
    reference: "Reference",
    operation: "Operation",
    notFound: "—",
    audio: "Audio",
    play: "Play",
    pause: "Pause",
    slower: "Slower",
    stopAudio: "Stop audio",
    audioStub: "No voice available: the local server returns test silence, not Fulfulde.",
    audioUnavailable: "No voice available on this local server.",
    voiceUnavailable:
      "The configured voice model is not ready (missing model or key). See docs/MODELS.md.",
    cloudDisabled:
      "Cloud speech is disabled. Set ZTEAM_ALLOW_CLOUD=1 for a test run only.",
    noSpeech: "No translated sentence to read.",
    audioError: "Audio playback failed.",
    privacyTitle: "What leaves this page",
    privacyValue: "Nothing — local processing",
    privacyHint:
      "No data leaves this device. The local 127.0.0.1 service only receives the text to pronounce.",
    integrityTitle: "Integrity check failed",
    abortProtected: "A protected value changed. The translation was cancelled and the page restored.",
    abortMixed: "A translation did not preserve a value. The translation was cancelled.",
    abortTarget: "A translation introduced a value that was not on the page. It was cancelled.",
    abortUnknown: "The translation was cancelled to protect the page.",
    staleAction: "This action changed. Rescan the page.",
    highlighted: "Action shown on the page. Tap it yourself.",
    settings: "Settings",
    language: "Interface language",
    footer: "Local-first · Adamawa Fulfulde (fub)",
    refresh: "Refresh",
    summary: "Page summary",
    speakSummary: "Read the summary",
    summaryHint:
      "The assistant reads the essentials and the next actions, never the whole page. Amounts stay on screen.",
    verify: "Review",
    confirmAction: "Confirm",
    cancelAction: "Cancel",
    actionSpoken: "Action announced. Confirm to show it on the page.",
    valuesNotSpoken:
      "Amounts, accounts and references are not read aloud: verify them on screen.",
    actionsPlanNote: "Available actions are listed below.",
    noContentPlan: "Nothing to summarise.",  },
};
