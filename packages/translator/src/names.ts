const NAME_TOKEN = String.raw`[A-ZÀ-Ý][a-zà-ÿ]+(?:[-'’][A-ZÀ-Ý][a-zà-ÿ]+)*`;
const SINGLE_NAME = new RegExp(`^${NAME_TOKEN}$`, "u");
const MULTI_NAME = new RegExp(`^${NAME_TOKEN}(?:\\s+${NAME_TOKEN}){1,3}$`, "u");

const EXCLUDED_TAGS = new Set([
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "A",
  "BUTTON",
  "NAV",
  "SUMMARY",
  "LABEL",
  "OPTION",
]);

/**
 * Common UI, heading and function words. A person's name is unlikely to
 * contain one of these tokens; a page heading very often does. This keeps the
 * generic name guard from protecting "Getting Started Guide" or
 * "Privacy Policy" while still protecting "Amina Ngo Bell".
 */
const STOPWORDS = new Set(
  `
  a an the and or but for with from to of in on at by as is are was were be been being
  this that these those it its you your we our they their he she his her them who what
  when where why how all any each every more most some such no not only own same so than
  too very can will just should now new old first last next previous learn read view see
  get start started starting guide overview introduction welcome home page site website
  privacy policy terms service services contact about help support login sign register
  account accounts search menu close open download upload news blog article articles docs
  documentation reference api share print edit update delete save cancel submit send
  continue back click here details summary index list table data information features
  pricing product products company careers jobs team people user users profile settings
  language languages english french fulfulde frequently asked questions getting tutorial
  tutorials example examples sample samples cookie cookies consent newsletter subscribe
  follow social media copyright rights reserved total amount fee phone name date
  beneficiary address email city country status number code type category description
  title subject message note reason operation balance transaction payment transfer
  receipt confirmation confirm next previous important notice warning error success info
  le la les un une des du de dans en sur sous avec pour par au aux et ou mais donc or ni
  car ce cet cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs je
  tu il elle on nous vous ils elles est sont être avoir a ont faire plus moins tout tous
  toute toutes autre autres même mêmes premier première dernier dernière nouveau nouvelle
  ancien ancienne voir lire apprendre découvrir accueil web internet confidentialité
  politique conditions propos aide connexion inscription compte comptes recherche fermer
  ouvrir télécharger envoyer actualités partager imprimer modifier mettre jour supprimer
  enregistrer annuler continuer retour suivant précédent cliquer ici détails résumé liste
  tableau données informations aperçu fonctionnalités tarifs produit produits entreprise
  carrières emplois équipe personnes utilisateur utilisateurs profil paramètres langue
  langues français anglais cookies consentement abonner suivre médias sociaux droits
  réservés questions fréquentes commencer démarrer tutoriel tutoriels exemple exemples
  montant frais téléphone nom référence bénéficiaire adresse courriel ville pays statut
  numéro catégorie description titre sujet objet motif opération solde transaction
  paiement transfert reçu récapitulatif confirmation confirmer modifier valider
  enregistrer
  `
    .trim()
    .split(/\s+/),
);

export interface PersonNameOptions {
  tagName?: string;
  allowSingle?: boolean;
}

/**
 * Conservative person-name guard for general pages.
 *
 * It is intentionally not a full NER model: it protects 2–4 Title Case tokens
 * that are not in a heading/link/button and do not contain a common UI word.
 * The demo's greeting, label context and input values provide the narrower
 * cases (single first names, beneficiary fields).
 */
export function isLikelyPersonName(text: string, options: PersonNameOptions = {}): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed === trimmed.toUpperCase()) return false;
  if (options.tagName && EXCLUDED_TAGS.has(options.tagName.toUpperCase())) return false;

  const valid = options.allowSingle
    ? SINGLE_NAME.test(trimmed) || MULTI_NAME.test(trimmed)
    : MULTI_NAME.test(trimmed);
  if (!valid) return false;

  const tokens = trimmed.toLowerCase().split(/\s+/);
  return !tokens.some((token) => STOPWORDS.has(token));
}
