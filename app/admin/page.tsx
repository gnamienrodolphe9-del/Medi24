"use client";

import Link from "next/link";
import CadreAdmin from "@/components/admin/CadreAdmin";

const ENTREES = [
  ["/admin/indicateurs", "Indicateurs", "Demandes, réponses, délais, SMS, gardes de ce soir"],
  ["/admin/demandes", "Demandes", "Toutes les demandes avec les patients, les pharmacies et la chronologie"],
  ["/admin/evaluations", "Avis des patients", "Notes et commentaires, export CSV"],
  ["/admin/pharmacies", "Pharmacies", "Créer, valider ou suspendre une pharmacie, lien de gestion"],
  ["/admin/gardes", "Gardes", "Saisir le planning de garde (heures d'Abidjan)"],
  ["/admin/structures", "Structures de santé", "Liste affichée dans l'espace Urgence"],
  ["/admin/journal", "Journal", "Historique des alertes, SMS et incidents"],
];

export default function AccueilAdmin() {
  return (
    <CadreAdmin titre="Administration">
      <div className="flex flex-col gap-3">
        {ENTREES.map(([adresse, titre, aide]) => (
          <Link
            key={adresse}
            href={adresse}
            className="flex min-h-16 flex-col justify-center rounded-2xl border-[1.5px] border-trait bg-white px-4 py-3"
          >
            <span className="text-lg font-extrabold">{titre}</span>
            <span className="text-sm text-discret">{aide}</span>
          </Link>
        ))}
        <p className="text-[13px] leading-snug text-discret">
          Ordre conseillé : créer la pharmacie, vérifier son numéro d&apos;ordre, la valider,
          lui envoyer son lien de gestion, puis saisir ses gardes. Seules les pharmacies
          validées et de garde sont alertées et apparaissent dans l&apos;annuaire.
        </p>
      </div>
    </CadreAdmin>
  );
}
