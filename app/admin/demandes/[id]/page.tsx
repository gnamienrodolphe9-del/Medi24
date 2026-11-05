"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import CadreAdmin from "@/components/admin/CadreAdmin";
import { Carte, MessageErreur, Pastille } from "@/components/ui";
import { afficherTelephone, ecartSecondes, formaterDuree, TYPES_LIBELLES, un } from "@/lib/admin/outils";
import { libelleEtat } from "@/lib/etats";
import { formaterDateHeureAbidjan, formaterHeureAbidjan } from "@/lib/garde";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { formaterFcfa, totalLignes, type LigneReponse } from "@/lib/totaux";

type Nom = { nom: string } | { nom: string }[] | null;

type Demande = {
  id: string;
  type: string;
  etat: string;
  mode: string | null;
  cree_le: string;
  mis_a_jour_le: string;
  retenue_le: string | null;
  mode_choisi_le: string | null;
  remise_le: string | null;
  telephone_patient: string;
  telephone_verifie: boolean;
  repere: string | null;
  texte_libre: string | null;
  age_texte: string | null;
  poids_kg: number | null;
  grossesse: boolean;
  allergies: string | null;
  traitements: string | null;
  essais_code: number;
  sms_envoyes: number;
  repli_fait: boolean;
  rappel_envoye: boolean;
  pharmacies: Nom;
  lignes_demande: { produit: string; quantite: number }[];
  ordonnances: { id: string; cree_le: string; supprimer_apres: string | null }[];
  alertes: {
    id: string; vague: number; cree_le: string; envoyee_le: string | null; ouverte_le: string | null;
    rappel_le: string | null; resultat: string | null; sms_erreur: string | null; pharmacies: Nom;
  }[];
  reponses: {
    id: string; statut: string; avis: string | null; retrait_possible: boolean; livraison_possible: boolean;
    cree_le: string; pharmacies: Nom; lignes_reponse: LigneReponse[];
    livraisons: { id: string; telephone_livreur: string; etat: string; cree_le: string; remis_le: string | null }[] | { id: string; telephone_livreur: string; etat: string; cree_le: string; remis_le: string | null } | null;
  }[];
  evaluations: { note: number; commentaire: string | null; cree_le: string } | { note: number; commentaire: string | null; cree_le: string }[] | null;
};

type Evenement = { id: number; evenement: string; detail: unknown; cree_le: string };

function Ligne({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-trait py-1.5 text-[14px] last:border-0">
      <dt className="text-discret">{libelle}</dt>
      <dd className="text-right font-semibold">{valeur}</dd>
    </div>
  );
}

function Contenu() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Demande | null>(null);
  const [journal, setJournal] = useState<Evenement[]>([]);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    async function charger() {
      const db = creerClientNavigateur();
      const { data, error } = await db
        .from("demandes")
        .select(
          "id, type, etat, mode, cree_le, mis_a_jour_le, retenue_le, mode_choisi_le, remise_le, telephone_patient, telephone_verifie, repere, texte_libre, age_texte, poids_kg, grossesse, allergies, traitements, essais_code, sms_envoyes, repli_fait, rappel_envoye, pharmacies!pharmacie_retenue_id(nom), lignes_demande(produit, quantite), ordonnances(id, cree_le, supprimer_apres), alertes(id, vague, cree_le, envoyee_le, ouverte_le, rappel_le, resultat, sms_erreur, pharmacies(nom)), reponses(id, statut, avis, retrait_possible, livraison_possible, cree_le, pharmacies(nom), lignes_reponse(id, produit, disponible, substitut, prix_fcfa, substitut_accepte), livraisons(id, telephone_livreur, etat, cree_le, remis_le)), evaluations(note, commentaire, cree_le)"
        )
        .eq("id", id)
        .maybeSingle();
      if (annule) return;
      if (error) return setErreur("Lecture impossible : " + error.message);
      if (!data) return setErreur("Demande introuvable.");
      setD(data as unknown as Demande);

      const { data: j } = await db
        .from("journal_alertes")
        .select("id, evenement, detail, cree_le")
        .eq("demande_id", id)
        .order("id");
      if (!annule) setJournal((j ?? []) as Evenement[]);

      const { data: pos } = await db.rpc("admin_position_demande", { p_demande: id });
      const p0 = ((pos ?? []) as { latitude: number; longitude: number }[])[0];
      if (!annule && p0) setPosition(p0);
    }
    charger();
    return () => {
      annule = true;
    };
  }, [id]);

  if (erreur) return <MessageErreur>{erreur}</MessageErreur>;
  if (!d) return <p className="text-base text-discret">Chargement…</p>;

  const evaluation = un(d.evaluations);
  const retenue = un(d.pharmacies);
  const reponseRetenue = d.reponses.find((r) => un(r.pharmacies)?.nom === retenue?.nom) ?? null;
  const livraison = reponseRetenue ? un(reponseRetenue.livraisons) : null;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/demandes" className="inline-flex min-h-11 w-fit items-center text-[15px] font-semibold text-vert">‹ Toutes les demandes</Link>

      <Carte titre="Résumé">
        <dl>
          <Ligne libelle="État" valeur={<Pastille ton={["expiree", "repli"].includes(d.etat) ? "rouge" : d.etat === "remise" ? "vert" : "ambre"}>{libelleEtat(d.etat as never)}</Pastille>} />
          <Ligne libelle="Type" valeur={TYPES_LIBELLES[d.type] ?? d.type} />
          <Ligne libelle="Créée le (Abidjan)" valeur={formaterDateHeureAbidjan(d.cree_le)} />
          <Ligne libelle="Pharmacie retenue" valeur={retenue?.nom ?? "Aucune"} />
          <Ligne libelle="Délai de réponse" valeur={formaterDuree(ecartSecondes(d.cree_le, d.retenue_le))} />
          <Ligne libelle="Mode choisi" valeur={d.mode ? (d.mode === "retrait" ? "Retrait" : "Livraison") : "—"} />
          <Ligne libelle="Remise" valeur={d.remise_le ? formaterDateHeureAbidjan(d.remise_le) : "—"} />
          <Ligne libelle="Durée totale jusqu'à la remise" valeur={formaterDuree(ecartSecondes(d.cree_le, d.remise_le))} />
          <Ligne libelle="SMS envoyés" valeur={d.sms_envoyes} />
          <Ligne libelle="Liste d'appel affichée" valeur={d.repli_fait ? "Oui" : "Non"} />
          <Ligne libelle="Essais de code ratés" valeur={d.essais_code} />
        </dl>
      </Carte>

      <Carte titre="Patient">
        <dl>
          <Ligne libelle="Téléphone" valeur={<a href={`tel:${d.telephone_patient}`} className="text-vert underline">{afficherTelephone(d.telephone_patient)}</a>} />
          <Ligne libelle="Numéro vérifié par SMS" valeur={d.telephone_verifie ? "Oui" : "Non"} />
          <Ligne libelle="Repère" valeur={d.repere ?? "—"} />
          <Ligne libelle="Position GPS" valeur={position ? (
            <a href={`https://www.google.com/maps?q=${position.latitude},${position.longitude}`} target="_blank" rel="noopener noreferrer" className="text-vert underline">Voir sur la carte</a>
          ) : "Non partagée"} />
          {d.age_texte && <Ligne libelle="Âge" valeur={d.age_texte} />}
          {d.poids_kg && <Ligne libelle="Poids" valeur={`${d.poids_kg} kg`} />}
          {d.type === "symptomes" && <Ligne libelle="Grossesse" valeur={d.grossesse ? "Oui" : "Non"} />}
          {d.allergies && <Ligne libelle="Allergies" valeur={d.allergies} />}
          {d.traitements && <Ligne libelle="Traitements" valeur={d.traitements} />}
        </dl>
      </Carte>

      <Carte titre="Ce qui a été demandé">
        {d.lignes_demande.length > 0 && (
          <ul className="flex flex-col gap-1 text-[15px] font-semibold">
            {d.lignes_demande.map((l, i) => <li key={i}>• {l.produit}{l.quantite > 1 ? ` x${l.quantite}` : ""}</li>)}
          </ul>
        )}
        {d.texte_libre && <p className="whitespace-pre-line rounded-xl bg-fond p-3 text-[14px] leading-snug">{d.texte_libre}</p>}
        {d.ordonnances.length > 0 && (
          <p className="text-[14px]">
            Ordonnance : {d.ordonnances.length} photo(s) jointe(s)
            {d.ordonnances[0].supprimer_apres ? `, effacée le ${formaterDateHeureAbidjan(d.ordonnances[0].supprimer_apres)}` : ""}. Les photos ne sont visibles que des pharmacies alertées.
          </p>
        )}
        {d.lignes_demande.length === 0 && !d.texte_libre && d.ordonnances.length === 0 && <p className="text-sm text-discret">Aucun détail enregistré.</p>}
      </Carte>

      <Carte titre={`Pharmacies alertées (${d.alertes.length})`}>
        {d.alertes.length === 0 ? <p className="text-sm text-discret">Aucune alerte envoyée.</p> : (
          <ul className="flex flex-col gap-2">
            {[...d.alertes].sort((a, b) => a.cree_le.localeCompare(b.cree_le)).map((a) => (
              <li key={a.id} className="rounded-xl border-[1.5px] border-trait p-3 text-[13.5px]">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-extrabold">{un(a.pharmacies)?.nom ?? "—"} <span className="font-normal text-discret">· vague {a.vague}</span></p>
                  {a.resultat ? <Pastille ton={a.resultat === "indisponible" ? "rouge" : "vert"}>{a.resultat}</Pastille> : <Pastille ton="gris">Sans réponse</Pastille>}
                </div>
                <p className="mt-1 text-discret">
                  Alerte {a.envoyee_le ? `envoyée à ${formaterHeureAbidjan(a.envoyee_le)}` : "non envoyée"}
                  {a.ouverte_le ? ` · lien ouvert à ${formaterHeureAbidjan(a.ouverte_le)} (+${formaterDuree(ecartSecondes(a.envoyee_le ?? a.cree_le, a.ouverte_le))})` : " · lien jamais ouvert"}
                  {a.rappel_le ? ` · rappel à ${formaterHeureAbidjan(a.rappel_le)}` : ""}
                </p>
                {a.sms_erreur && <p className="font-semibold text-rouge">Échec SMS : {a.sms_erreur}</p>}
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Carte titre={`Réponses des pharmacies (${d.reponses.length})`}>
        {d.reponses.length === 0 ? <p className="text-sm text-discret">Aucune réponse.</p> : (
          <ul className="flex flex-col gap-3">
            {d.reponses.map((r) => {
              const { total, prixManquant } = totalLignes(r.lignes_reponse);
              const estRetenue = un(r.pharmacies)?.nom === retenue?.nom;
              return (
                <li key={r.id} className="rounded-xl border-[1.5px] border-trait p-3 text-[13.5px]">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-extrabold">{un(r.pharmacies)?.nom ?? "—"}</p>
                    <span className="flex gap-1.5">
                      {estRetenue && <Pastille ton="vert">Retenue</Pastille>}
                      <Pastille ton={r.statut === "indisponible" ? "rouge" : r.statut === "partiel" ? "ambre" : "vert"}>{r.statut}</Pastille>
                    </span>
                  </div>
                  <p className="text-discret">
                    Répondu à {formaterHeureAbidjan(r.cree_le)} · retrait {r.retrait_possible ? "oui" : "non"} · livraison {r.livraison_possible ? "oui" : "non"}
                  </p>
                  {r.avis && <p className="mt-1 whitespace-pre-line rounded-lg bg-fond p-2">Avis : {r.avis}</p>}
                  {r.lignes_reponse.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {r.lignes_reponse.map((l) => (
                        <li key={l.id} className="flex justify-between gap-2">
                          <span>
                            {l.produit} {l.disponible ? "" : <em className="text-rouge">(indisponible)</em>}
                            {l.substitut ? <> → {l.substitut} {l.substitut_accepte === true ? "(accepté)" : l.substitut_accepte === false ? "(refusé)" : "(sans réponse)"}</> : null}
                          </span>
                          <span className="font-semibold">{l.prix_fcfa != null ? formaterFcfa(l.prix_fcfa) : "—"}</span>
                        </li>
                      ))}
                      <li className="flex justify-between border-t border-trait pt-1 font-extrabold">
                        <span>Total retenu</span><span>{formaterFcfa(total)}{prixManquant ? " +" : ""}</span>
                      </li>
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Carte>

      {livraison && (
        <Carte titre="Livraison">
          <dl>
            <Ligne libelle="Livreur" valeur={afficherTelephone(livraison.telephone_livreur)} />
            <Ligne libelle="État" valeur={livraison.etat} />
            <Ligne libelle="Course créée" valeur={formaterDateHeureAbidjan(livraison.cree_le)} />
            <Ligne libelle="Remis" valeur={livraison.remis_le ? formaterDateHeureAbidjan(livraison.remis_le) : "—"} />
          </dl>
        </Carte>
      )}

      <Carte titre="Avis du patient">
        {evaluation ? (
          <>
            <p className="text-xl font-extrabold">{evaluation.note} / 5</p>
            {evaluation.commentaire && <p className="whitespace-pre-line text-[14px]">{evaluation.commentaire}</p>}
          </>
        ) : <p className="text-sm text-discret">Pas d&apos;avis donné.</p>}
      </Carte>

      <Carte titre="Chronologie complète">
        <ul className="flex flex-col gap-1.5">
          {journal.map((e) => (
            <li key={e.id} className="text-[13px]">
              <strong>{formaterHeureAbidjan(e.cree_le)}</strong> · {e.evenement}
              {e.detail !== null && e.detail !== undefined && <span className="break-all font-mono text-[12px] text-discret"> {JSON.stringify(e.detail)}</span>}
            </li>
          ))}
          {journal.length === 0 && <li className="text-sm text-discret">Aucun événement.</li>}
        </ul>
      </Carte>
    </div>
  );
}

export default function PageDetailDemande() {
  return (
    <CadreAdmin titre="Détail d'une demande">
      <Contenu />
    </CadreAdmin>
  );
}
