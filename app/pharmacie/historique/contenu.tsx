"use client";

import { useEffect, useMemo, useState } from "react";
import CadrePharmacie, { useJetonGestion } from "@/components/pharmacie/CadrePharmacie";
import { Carte, Chargement, MessageErreur, Pastille } from "@/components/ui";
import { formaterDuree } from "@/lib/admin/outils";
import { appeler } from "@/lib/client/api";
import { formaterDateHeureAbidjan } from "@/lib/garde";
import { formaterFcfa } from "@/lib/totaux";

type LigneReponseHistorique = {
  produit: string;
  disponible: boolean;
  substitut: string | null;
  prix: number | null;
  substitutAccepte: boolean | null;
};

type Ligne = {
  id: string;
  le: string;
  resultat: string | null;
  type: "medicament" | "ordonnance" | "symptomes" | null;
  etat: string | null;
  mode: "retrait" | "livraison" | null;
  retenue: boolean;
  priseParAutre: boolean;
  repere: string | null;
  texteLibre: string | null;
  demandes: { produit: string; quantite: number }[];
  delaiReponseSecondes: number | null;
  reponse: {
    statut: string;
    retraitPossible: boolean;
    livraisonPossible: boolean;
    total: number;
    prixManquant: boolean;
    lignes: LigneReponseHistorique[];
  } | null;
  remiseLe: string | null;
  note: number | null;
  commentaire: string | null;
};
type Donnees = { pharmacie: string; historique: Ligne[] };

const TYPES: Record<string, string> = { medicament: "Médicament", ordonnance: "Ordonnance", symptomes: "Symptômes" };
const ETATS: Record<string, string> = {
  creee: "Créée",
  envoyee: "Envoyée",
  vue: "Vue",
  confirmee: "Patient en train de choisir",
  prete: "Commande prête",
  en_livraison: "En livraison",
  remise: "Remise",
  annulee: "Annulée",
  expiree: "Expirée",
  repli: "Liste d'appel",
};

type Onglet = "toutes" | "en_cours" | "remises" | "repondues" | "sans_reponse" | "autre";

const ONGLETS: { id: Onglet; libelle: string; garde: (l: Ligne) => boolean }[] = [
  { id: "toutes", libelle: "Toutes", garde: () => true },
  { id: "en_cours", libelle: "En cours", garde: (l) => l.retenue && ["confirmee", "prete", "en_livraison"].includes(l.etat ?? "") },
  { id: "remises", libelle: "Remises", garde: (l) => l.retenue && l.etat === "remise" },
  { id: "repondues", libelle: "Répondues", garde: (l) => l.resultat !== null },
  { id: "sans_reponse", libelle: "Sans réponse", garde: (l) => l.resultat === null },
  { id: "autre", libelle: "Autre pharmacie", garde: (l) => l.priseParAutre },
];

function resume(l: Ligne): string {
  if (l.type === "ordonnance") return "Ordonnance (photo)";
  if (l.type === "symptomes") return `Symptômes : ${(l.texteLibre ?? "").slice(0, 80)}`;
  const produits = l.demandes.map((d) => (d.quantite > 1 ? `${d.produit} x${d.quantite}` : d.produit));
  return produits.slice(0, 3).join(", ") + (produits.length > 3 ? "…" : "") || "Demande";
}

export default function ContenuHistoriquePharmacie() {
  const jeton = useJetonGestion();
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("toutes");

  useEffect(() => {
    if (!jeton) return;
    appeler<Donnees>(`/api/pharmacie/gestion?j=${jeton}&historique=1`).then((r) => {
      if (r.ok) setDonnees(r.donnees);
      else setErreur(r.erreur);
    });
  }, [jeton]);

  const lignes = useMemo(() => donnees?.historique ?? [], [donnees]);

  const chiffres = useMemo(() => {
    const repondues = lignes.filter((l) => l.resultat !== null).length;
    const remises = lignes.filter((l) => l.retenue && l.etat === "remise");
    const delais = lignes.map((l) => l.delaiReponseSecondes).filter((d): d is number => d !== null);
    const montant = remises.reduce((t, l) => t + (l.reponse && !l.reponse.prixManquant ? l.reponse.total : 0), 0);
    return {
      alertes: lignes.length,
      tauxReponse: lignes.length ? Math.round((repondues / lignes.length) * 100) : null,
      remises: remises.length,
      delaiMoyen: delais.length ? Math.round(delais.reduce((a, b) => a + b, 0) / delais.length) : null,
      montant,
    };
  }, [lignes]);

  const courant = ONGLETS.find((o) => o.id === onglet) ?? ONGLETS[0];
  const visibles = lignes.filter(courant.garde);

  return (
    <CadrePharmacie titre="Historique" jeton={jeton} nomPharmacie={donnees?.pharmacie} actif="historique">
      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      {!donnees && !erreur && <Chargement />}
      {donnees && (
        <>
          <div className="grid grid-cols-2 gap-2 text-center">
            <Carte>
              <p className="text-2xl font-extrabold">{chiffres.alertes}</p>
              <p className="text-[12px] text-discret">demandes reçues</p>
            </Carte>
            <Carte>
              <p className="text-2xl font-extrabold">{chiffres.tauxReponse === null ? "—" : `${chiffres.tauxReponse} %`}</p>
              <p className="text-[12px] text-discret">taux de réponse</p>
            </Carte>
            <Carte>
              <p className="text-2xl font-extrabold">{chiffres.remises}</p>
              <p className="text-[12px] text-discret">remises</p>
            </Carte>
            <Carte>
              <p className="text-2xl font-extrabold">{formaterDuree(chiffres.delaiMoyen)}</p>
              <p className="text-[12px] text-discret">délai moyen de réponse</p>
            </Carte>
          </div>
          {chiffres.remises > 0 && (
            <p className="text-[13px] text-discret">
              Montant des commandes remises : <strong>{formaterFcfa(chiffres.montant)}</strong> (prix saisis dans vos réponses).
            </p>
          )}

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer l'historique">
            {ONGLETS.map((o) => {
              const nombre = lignes.filter(o.garde).length;
              const actif = o.id === onglet;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="tab"
                  aria-selected={actif}
                  onClick={() => setOnglet(o.id)}
                  className={`min-h-11 rounded-xl px-3.5 text-sm font-bold transition-colors ${
                    actif ? "bg-vert text-white" : "bg-vert-clair text-vert-fonce hover:bg-vert hover:text-white"
                  }`}
                >
                  {o.libelle} ({nombre})
                </button>
              );
            })}
          </div>

          {visibles.length === 0 && <p className="text-base text-discret">Rien dans cet onglet pour le moment.</p>}

          <ul className="flex flex-col gap-2">
            {visibles.map((l) => (
              <li key={l.id}>
                <details className="group rounded-xl border-[1.5px] border-trait bg-white">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold leading-tight">
                        {l.type ? TYPES[l.type] : "Demande"} · {resume(l)}
                      </p>
                      <p className="text-[12.5px] text-discret">{formaterDateHeureAbidjan(l.le)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {l.resultat ? (
                        <Pastille ton={l.resultat === "indisponible" ? "rouge" : "vert"}>{l.resultat}</Pastille>
                      ) : (
                        <Pastille ton="gris">Sans réponse</Pastille>
                      )}
                      {l.retenue && l.etat === "remise" && <Pastille ton="vert">Remise</Pastille>}
                      {l.priseParAutre && <Pastille ton="gris">Autre pharmacie</Pastille>}
                    </div>
                  </summary>

                  <div className="flex flex-col gap-3 border-t border-trait p-3 text-[14px] leading-snug">
                    <section>
                      <h3 className="font-extrabold">La demande</h3>
                      {l.demandes.length > 0 && (
                        <ul className="list-disc pl-5">
                          {l.demandes.map((d, i) => (
                            <li key={i}>
                              {d.produit}
                              {d.quantite > 1 ? ` x${d.quantite}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                      {l.type === "ordonnance" && <p>Photo d&apos;ordonnance.</p>}
                      {l.texteLibre && <p>« {l.texteLibre} »</p>}
                      {l.repere && <p className="text-discret">Patient près de : {l.repere}</p>}
                    </section>

                    <section>
                      <h3 className="font-extrabold">Ma réponse</h3>
                      {!l.reponse && <p className="text-discret">Vous n&apos;avez pas répondu à cette demande.</p>}
                      {l.reponse && (
                        <>
                          <p>
                            {l.reponse.statut === "disponible"
                              ? "Disponible"
                              : l.reponse.statut === "partiel"
                                ? "Partiellement disponible"
                                : "Indisponible"}
                            {l.delaiReponseSecondes !== null ? ` · répondu en ${formaterDuree(l.delaiReponseSecondes)}` : ""}
                          </p>
                          {l.reponse.lignes.length > 0 && (
                            <ul className="mt-1 flex flex-col gap-1">
                              {l.reponse.lignes.map((r, i) => (
                                <li key={i} className="flex justify-between gap-2">
                                  <span>
                                    {r.produit}
                                    {!r.disponible && (
                                      <span className="text-discret">
                                        {" "}
                                        · indisponible
                                        {r.substitut
                                          ? `, proposé : ${r.substitut} (${r.substitutAccepte === true ? "accepté" : r.substitutAccepte === false ? "refusé" : "en attente"})`
                                          : ""}
                                      </span>
                                    )}
                                  </span>
                                  <span className="whitespace-nowrap font-semibold">{r.prix === null ? "—" : formaterFcfa(r.prix)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {l.reponse.lignes.length > 0 && (
                            <p className="mt-1 font-bold">
                              Total : {formaterFcfa(l.reponse.total)}
                              {l.reponse.prixManquant ? " (un prix manque)" : ""}
                            </p>
                          )}
                          <p className="text-discret">
                            {[l.reponse.retraitPossible ? "Retrait possible" : null, l.reponse.livraisonPossible ? "Livraison possible" : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </>
                      )}
                    </section>

                    <section>
                      <h3 className="font-extrabold">La suite</h3>
                      <p>État : {l.etat ? ETATS[l.etat] ?? l.etat : "—"}</p>
                      {l.mode && <p>Choix du patient : {l.mode === "livraison" ? "livraison" : "retrait en pharmacie"}</p>}
                      {l.priseParAutre && <p className="text-discret">Une autre pharmacie a été retenue par le patient.</p>}
                      {l.remiseLe && <p>Remise le {formaterDateHeureAbidjan(l.remiseLe)}</p>}
                      {l.note !== null && (
                        <p>
                          Avis du patient : <strong>{l.note}/5</strong>
                          {l.commentaire ? ` · « ${l.commentaire} »` : ""}
                        </p>
                      )}
                    </section>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </CadrePharmacie>
  );
}
