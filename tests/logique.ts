import { decider, CASCADE, type EntreeCascade } from "../lib/cascade";
import { validerDemande } from "../lib/validation";
import { totalLignes, substitutsEnAttente } from "../lib/totaux";
import * as M from "../lib/messages";
import { codesIdentiques, codeValide } from "../lib/code";
import { jetonValide } from "../lib/jeton";

let ok = 0, ko = 0;
function egal(nom: string, a: unknown, b: unknown) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x === y) ok++; else { ko++; console.log("ECHEC", nom, "\n  obtenu :", x, "\n  attendu:", y); }
}
const base: EntreeCascade = { etat: "creee", ageSecondes: 0, vaguesEnvoyees: 0, rappelEnvoye: false, repliFait: false, pharmaciesRestantes: 8, sansReponse: 0, smsEnvoyes: 0 };

egal("vague 1", decider(base), [{ type: "envoyer_vague", vague: 1, nombre: 3 }]);
egal("aucune pharmacie", decider({ ...base, pharmaciesRestantes: 0 }), [{ type: "repli", aucune: true }]);
egal("une seule pharmacie", decider({ ...base, pharmaciesRestantes: 1 }), [{ type: "envoyer_vague", vague: 1, nombre: 1 }]);
const apres1 = { ...base, etat: "envoyee" as const, vaguesEnvoyees: 1, pharmaciesRestantes: 5, sansReponse: 3, smsEnvoyes: 3 };
egal("rien à 60 s", decider({ ...apres1, ageSecondes: 60 }), []);
egal("rappel à 120 s", decider({ ...apres1, ageSecondes: 120 }), [{ type: "rappel", nombre: 3 }]);
egal("pas de 2e rappel", decider({ ...apres1, ageSecondes: 150, rappelEnvoye: true }), []);
egal("vague 2 à 240 s", decider({ ...apres1, ageSecondes: 240, rappelEnvoye: true, smsEnvoyes: 6 }), [{ type: "envoyer_vague", vague: 2, nombre: 3 }]);
egal("vague 2 + rappel si rappel manqué", decider({ ...apres1, ageSecondes: 240 }), [{ type: "rappel", nombre: 3 }, { type: "envoyer_vague", vague: 2, nombre: 3 }]);
egal("repli à 360 s", decider({ ...apres1, ageSecondes: 360, rappelEnvoye: true, vaguesEnvoyees: 2, smsEnvoyes: 9, pharmaciesRestantes: 2, sansReponse: 6 }), [{ type: "repli", aucune: false }]);
egal("expire à 30 min", decider({ ...apres1, ageSecondes: 1800 }), [{ type: "expirer" }]);
egal("rien si confirmée", decider({ ...apres1, etat: "confirmee", ageSecondes: 500 }), []);
egal("toutes indisponibles : vague suivante tout de suite", decider({ ...apres1, ageSecondes: 50, sansReponse: 0 }), [{ type: "envoyer_vague", vague: 2, nombre: 3 }]);
egal("toutes indisponibles et plus personne : repli", decider({ ...apres1, ageSecondes: 50, sansReponse: 0, pharmaciesRestantes: 0 }), [{ type: "repli", aucune: false }]);
egal("plafond SMS respecté", decider({ ...apres1, ageSecondes: 240, rappelEnvoye: true, smsEnvoyes: 8 }), [{ type: "envoyer_vague", vague: 2, nombre: 1 }]);
egal("plafond atteint pas de vague", decider({ ...apres1, ageSecondes: 240, rappelEnvoye: true, smsEnvoyes: 9, repliFait: true }), []);
egal("repli déjà fait pas répété", decider({ ...apres1, ageSecondes: 400, rappelEnvoye: true, repliFait: true, vaguesEnvoyees: 2 }), []);

// Validation
const bon = { type: "medicament", telephone: "07 00 00 00 00", produits: ["Doliprane 1000 x2", " "], texteLibre: "", age: "", poidsKg: "", grossesse: false, allergies: "", traitements: "", consentement: true, latitude: 5.33, longitude: -4.08, repere: "", avecOrdonnance: false };
const r1: any = validerDemande(bon);
egal("valide", r1.ok, true);
egal("ligne quantité", r1.valeur.lignes, [{ produit: "Doliprane 1000", quantite: 2 }]);
egal("téléphone normalisé", r1.valeur.telephone, "+2250700000000");
egal("sans consentement", (validerDemande({ ...bon, consentement: false }) as any).ok, false);
egal("sans position ni repère", (validerDemande({ ...bon, latitude: null, longitude: null }) as any).ok, false);
egal("repère seul accepté", (validerDemande({ ...bon, latitude: null, longitude: null, repere: "Carrefour Siporex" }) as any).ok, true);
egal("tramadol refusé", (validerDemande({ ...bon, produits: ["Tramadol 50"] }) as any).ok, false);
egal("Codéine accentuée refusée", (validerDemande({ ...bon, produits: ["Codéine"] }) as any).ok, false);
egal("ordonnance sans photo", (validerDemande({ ...bon, type: "ordonnance", produits: [] }) as any).ok, false);
egal("ordonnance avec photo", (validerDemande({ ...bon, type: "ordonnance", produits: [], avecOrdonnance: true }) as any).ok, true);
egal("symptômes sans âge", (validerDemande({ ...bon, type: "symptomes", produits: [], texteLibre: "maux de tete depuis hier" }) as any).ok, false);
egal("symptômes complets", (validerDemande({ ...bon, type: "symptomes", produits: [], texteLibre: "maux de tete depuis hier", age: "34 ans", poidsKg: "70,5" }) as any).valeur.poidsKg, 70.5);
egal("téléphone invalide", (validerDemande({ ...bon, telephone: "123" }) as any).ok, false);
egal("trop de produits", (validerDemande({ ...bon, produits: Array.from({ length: 11 }, (_, i) => "Produit " + i) }) as any).ok, false);
egal("position invalide", (validerDemande({ ...bon, latitude: 200, longitude: 0 }) as any).ok, false);

// Totaux
const L = (o: any) => ({ id: "x", produit: "p", disponible: true, substitut: null, prix_fcfa: 0, substitut_accepte: null, ...o });
egal("total simple", totalLignes([L({ prix_fcfa: 1000 }), L({ prix_fcfa: 500 })]), { total: 1500, prixManquant: false });
egal("substitut refusé", totalLignes([L({ prix_fcfa: 1000 }), L({ disponible: false, substitut: "s", prix_fcfa: 700, substitut_accepte: false })]), { total: 1000, prixManquant: false });
egal("substitut accepté", totalLignes([L({ prix_fcfa: 1000 }), L({ disponible: false, substitut: "s", prix_fcfa: 700, substitut_accepte: true })]), { total: 1700, prixManquant: false });
egal("prix manquant", totalLignes([L({ prix_fcfa: null })]), { total: 0, prixManquant: true });
egal("en attente", substitutsEnAttente([L({ disponible: false, substitut: "s" }), L({ disponible: false, substitut: null }), L()]).length, 1);

// SMS : ASCII et < 160
const msgs = [M.smsCodeVerification("1234"), M.smsAlertePharmacie("https://medi24.vercel.app/p/" + "a".repeat(48), "1,2 km"), M.smsRappelPharmacie("https://medi24.vercel.app/p/" + "a".repeat(48)), M.smsLivraisonPharmacie("https://medi24.vercel.app/p/" + "a".repeat(48)), M.smsLivreur("https://medi24.vercel.app/l/" + "a".repeat(48), "Pharmacie du Carrefour"), M.smsPatientReponse("https://medi24.vercel.app/suivi/" + "a".repeat(48)), M.smsPatientPrete("https://medi24.vercel.app/suivi/" + "a".repeat(48)), M.smsGardeSoir("https://medi24.vercel.app/pharmacie/gardes?j=" + "a".repeat(48))];
msgs.forEach((m, i) => { egal(`sms ${i} ascii`, /^[\x20-\x7E]+$/.test(m), true); if (m.length > 160) { ko++; console.log("SMS trop long", i, m.length); } else ok++; });
egal("nettoyage", M.nettoyerSms("Pharmacie d’Été"), "Pharmacie d'Ete");
egal("code", [codeValide("0042"), codeValide("42"), codesIdentiques("1234", "1234"), codesIdentiques("1234", "1235")], [true, false, true, false]);
egal("jeton", [jetonValide("a".repeat(48)), jetonValide("A".repeat(48)), jetonValide("abc")], [true, false, false]);
console.log(`${ok} réussis, ${ko} échec(s)`);

// --- Aides de l'administration et options SMS ---
import { afficherTelephone, celluleCsv, ecartSecondes, formaterDuree, un } from "../lib/admin/outils";
import { options } from "../lib/options";
let ok2 = 0, ko2 = 0;
function egal2(nom: string, a: unknown, b: unknown) {
  if (JSON.stringify(a) === JSON.stringify(b)) ok2++; else { ko2++; console.log("ECHEC", nom, JSON.stringify(a), JSON.stringify(b)); }
}
egal2("durée s", formaterDuree(42), "42 s");
egal2("durée min", formaterDuree(95), "1 min 35 s");
egal2("durée h", formaterDuree(4020), "1 h 07 min");
egal2("durée vide", formaterDuree(null), "—");
egal2("écart", ecartSecondes("2026-11-01T10:00:00Z", "2026-11-01T10:01:30Z"), 90);
egal2("écart nul", ecartSecondes("2026-11-01T10:00:00Z", null), null);
egal2("téléphone", afficherTelephone("+2250700000000"), "+225 07 00 00 00 00");
egal2("csv guillemets", celluleCsv('a"b'), '"a""b"');
egal2("csv formule", celluleCsv("=1+1"), "\"'=1+1\"");
egal2("un liste", un([{ a: 1 }]), { a: 1 });
egal2("un objet", un({ a: 1 }), { a: 1 });
egal2("un null", un(null), null);
delete process.env.SMS_PATIENT; delete process.env.SMS_RAPPEL; delete process.env.SMS_GARDE_SOIR;
egal2("options par défaut", [options.smsPatient(), options.smsRappel(), options.smsConfirmationPharmacie(), options.smsGardeSoir()], [false, false, false, true]);
process.env.SMS_PATIENT = "oui"; process.env.SMS_GARDE_SOIR = "non";
egal2("options modifiées", [options.smsPatient(), options.smsGardeSoir()], [true, false]);
console.log(`${ok2} réussis, ${ko2} échec(s) (administration et options)`);

// --- Mode test ---
delete process.env.MODE_TEST;
egal2("mode test absent", options.modeTest(), false);
process.env.MODE_TEST = "oui";
egal2("mode test actif", options.modeTest(), true);
process.env.MODE_TEST = "non";
egal2("mode test coupé", options.modeTest(), false);
console.log(`${ok2} réussis, ${ko2} échec(s) (avec le mode test)`);
