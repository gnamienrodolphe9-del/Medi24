"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import CadreAdmin from "@/components/admin/CadreAdmin";
import { Carte, MessageErreur, Pastille } from "@/components/ui";
import { afficherTelephone, ecartSecondes, formaterDuree, TYPES_LIBELLES, un } from "@/lib/admin/outils";
import { libelleEtat } from "@/lib/etats";
import { formaterDateHeureAbidjan } from "@/lib/garde";
import { creerClientNavigateur } from "@/lib/supabase/client";
import type { PharmacieAdmin } from "@/lib/types";

type Dem = { type: string; etat: string; cree_le: string; pharmacie_retenue_id: string | null };
type Alerte = {
  id: string; demande_id: string; cree_le: string; envoyee_le: string | null; ouverte_le: string | null;
  rappel_le: string | null; resultat: string | null; demandes: Dem | Dem[] | null;
};
type Reponse = { demande_id: string; statut: string; cree_le: string };
type Garde = { id: string; debut: string; fin: string; confirmee: boolean };
type Avis = { id: string; etat: string; evaluations: { note: number; commentaire: string | null } | { note: number; commentaire: string | null }[] | null };

function Stat({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <div className="rounded-2xl border-[1.5px] border-trait bg-white p-3">
      <p className="text-[24px] font-extrabold leading-none">{valeur}</p>
      <p className="mt-1.5 text-[12.5px] leading-tight text-discret">{libelle}</p>
    </div>
  );
}

function Contenu() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<PharmacieAdmin | null>(null);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [reponses, setReponses] = useState<Reponse[]>([]);
  const [gardes, setGardes] = useState<Garde[]>([]);
  const [avis, setAvis] = useState<Avis[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    async function charger() {
      const db = creerClientNavigateur();
      const { data: liste, error } = await db.rpc("admin_lister_pharmacies");
      if (error) return setErreur("Lecture impossible : " + error.message);
      const trouvee = ((liste ?? []) as PharmacieAdmin[]).find((x) => x.id === id) ?? null;
      if (!trouvee) return setErreur("Pharmacie introuvable.");
      if (annule) return;
      setP(trouvee);

      const [a, r, g, e] = await Promise.all([
        db.from("alertes").select("id, demande_id, cree_le, envoyee_le, ouverte_le, rappel_le, resultat, demandes(type, etat, cree_le, pharmacie_retenue_id)").eq("pharmacie_id", id).order("cree_le", { ascending: false }).limit(300),
        db.from("reponses").select("demande_id, statut, cree_le").eq("pharmacie_id", id).limit(1000),
        db.from("gardes").select("id, debut, fin, confirmee").eq("pharmacie_id", id).order("debut", { ascending: false }).limit(60),
        db.from("demandes").select("id, etat, evaluations(note, commentaire)").eq("pharmacie_retenue_id", id).limit(500),
      ]);
      if (annule) return;
      setAlertes((a.data ?? []) as unknown as Alerte[]);
      setReponses((r.data ?? []) as Reponse[]);
      setGardes((g.data ?? []) as Garde[]);
      setAvis((e.data ?? []) as unknown as Avis[]);
    }
    charger();
    return () => {
      annule = true;
    };
  }, [id]);

  if (erreur) return <MessageErreur>{erreur}</MessageErreur>;
  if (!p) return <p className="text-base text-discret">Chargement…</p>;

  // Délai de réponse = de l'envoi du SMS à la réponse de la pharmacie.
  const delais = alertes
    .map((a) => {
      const rep = reponses.find((r) => r.demande_id === a.demande_id);
      return rep ? ecartSecondes(a.envoyee_le ?? a.cree_le, rep.cree_le) : null;
    })
    .filter((x): x is number => x !== null && x >= 0)
    .sort((x, y) => x - y);
  const mediane = delais.length ? delais[Math.floor(delais.length / 2)] : null;

  const repondues = alertes.filter((a) => a.resultat).length;
  const positives = alertes.filter((a) => a.resultat === "disponible" || a.resultat === "partiel").length;
  const retenues = alertes.filter((a) => un(a.demandes)?.pharmacie_retenue_id === id).length;
  const remises = avis.filter((d) => d.etat === "remise").length;
  const notes = avis.map((d) => un(d.evaluations)?.note).filter((n): n is number => typeof n === "number");
  const moyenne = notes.length ? notes.reduce((s, n) => s + n, 0) / notes.length : null;
  const gardesConfirmees = gardes.filter((g) => g.confirmee).length;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/pharmacies" className="inline-flex min-h-11 w-fit items-center text-[15px] font-semibold text-vert">‹ Toutes les pharmacies</Link>

      <Carte titre={p.nom}>
        <div className="flex flex-wrap gap-2">
          {p.suspendue ? <Pastille ton="rouge">Suspendue</Pastille> : p.validee ? <Pastille ton="vert">Validée</Pastille> : <Pastille ton="ambre">À valider</Pastille>}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[14px]">
          <dt className="text-discret">Adresse</dt><dd className="font-semibold">{[p.adresse, p.repere].filter(Boolean).join(" · ") || "—"}</dd>
          <dt className="text-discret">Numéro d&apos;alerte</dt><dd className="font-semibold">{afficherTelephone(p.telephone_alerte_1)}</dd>
          <dt className="text-discret">Secours</dt><dd className="font-semibold">{afficherTelephone(p.telephone_alerte_2)}</dd>
          <dt className="text-discret">Numéro public</dt><dd className="font-semibold">{afficherTelephone(p.telephone_public)}</dd>
          <dt className="text-discret">N° d&apos;ordre</dt><dd className="font-semibold">{p.numero_ordre ?? "—"}</dd>
        </dl>
      </Carte>

      <div className="grid grid-cols-2 gap-3">
        <Stat valeur={String(alertes.length)} libelle="Alertes reçues" />
        <Stat valeur={alertes.length ? `${Math.round((repondues / alertes.length) * 100)} %` : "—"} libelle="Taux de réponse" />
        <Stat valeur={String(positives)} libelle="Réponses positives (dispo ou partiel)" />
        <Stat valeur={formaterDuree(mediane)} libelle="Délai médian de réponse" />
        <Stat valeur={String(retenues)} libelle="Demandes retenues" />
        <Stat valeur={String(remises)} libelle="Remises effectuées" />
        <Stat valeur={moyenne !== null ? `${moyenne.toFixed(2)} / 5` : "—"} libelle={`Note moyenne (${notes.length} avis)`} />
        <Stat valeur={gardes.length ? `${gardesConfirmees} / ${gardes.length}` : "—"} libelle="Gardes confirmées" />
      </div>

      <Carte titre={`Historique des alertes (${alertes.length})`}>
        <ul className="flex flex-col gap-2">
          {alertes.map((a) => {
            const d = un(a.demandes);
            return (
              <li key={a.id}>
                <Link href={`/admin/demandes/${a.demande_id}`} className="flex items-center justify-between gap-2 rounded-xl border-[1.5px] border-trait p-3 text-[13.5px]">
                  <span>
                    <strong>{formaterDateHeureAbidjan(a.cree_le)}</strong><br />
                    {TYPES_LIBELLES[d?.type ?? ""] ?? "—"} · demande {d ? libelleEtat(d.etat as never).toLowerCase() : "—"}
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    {a.resultat ? <Pastille ton={a.resultat === "indisponible" ? "rouge" : "vert"}>{a.resultat}</Pastille> : <Pastille ton="gris">{a.ouverte_le ? "Ouverte, sans réponse" : "Jamais ouverte"}</Pastille>}
                    {d?.pharmacie_retenue_id === id && <Pastille ton="vert">Retenue</Pastille>}
                  </span>
                </Link>
              </li>
            );
          })}
          {alertes.length === 0 && <li className="text-sm text-discret">Aucune alerte reçue.</li>}
        </ul>
      </Carte>

      <Carte titre="Gardes récentes">
        <ul className="flex flex-col gap-1.5 text-[13.5px]">
          {gardes.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2">
              <span>{formaterDateHeureAbidjan(g.debut)} → {formaterDateHeureAbidjan(g.fin)}</span>
              {g.confirmee ? <Pastille ton="vert">Confirmée</Pastille> : <Pastille ton="ambre">Non confirmée</Pastille>}
            </li>
          ))}
          {gardes.length === 0 && <li className="text-sm text-discret">Aucune garde enregistrée.</li>}
        </ul>
      </Carte>
    </div>
  );
}

export default function PageDetailPharmacie() {
  return (
    <CadreAdmin titre="Détail d'une pharmacie">
      <Contenu />
    </CadreAdmin>
  );
}
