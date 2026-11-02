"use client";

import { useCallback, useEffect, useState } from "react";
import CadreAdmin from "@/components/admin/CadreAdmin";
import Champ from "@/components/admin/Champ";
import { BOUTON_PRINCIPAL, MessageErreur, MessageInfo, Pastille } from "@/components/ui";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { normaliserTelephoneCi } from "@/lib/telephone";

type Structure = { id: string; nom: string; type: string | null; adresse: string | null; telephone: string | null; ouvert_la_nuit: boolean };

const VIDE = { nom: "", type: "", adresse: "", telephone: "", latitude: "", longitude: "" };

function Contenu() {
  const [liste, setListe] = useState<Structure[]>([]);
  const [form, setForm] = useState(VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(async () => {
    const { data, error } = await creerClientNavigateur()
      .from("structures_sante")
      .select("id, nom, type, adresse, telephone, ouvert_la_nuit")
      .order("nom");
    if (error) setErreur("Lecture impossible : " + error.message);
    else setListe((data ?? []) as Structure[]);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const modifier = (c: keyof typeof VIDE) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [c]: e.target.value }));

  async function ajouter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreur(null);
    setSucces(null);
    if (!form.nom.trim()) return setErreur("Le nom est obligatoire.");
    let telephone: string | null = null;
    if (form.telephone.trim()) {
      telephone = normaliserTelephoneCi(form.telephone);
      if (!telephone) return setErreur("Le téléphone doit avoir 10 chiffres.");
    }
    let position: string | null = null;
    if (form.latitude.trim() || form.longitude.trim()) {
      const lat = Number(form.latitude.replace(",", "."));
      const lng = Number(form.longitude.replace(",", "."));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return setErreur("Latitude et longitude doivent être des nombres.");
      position = `SRID=4326;POINT(${lng} ${lat})`;
    }
    setOccupe(true);
    const { error } = await creerClientNavigateur().from("structures_sante").insert({
      nom: form.nom.trim(),
      type: form.type.trim() || null,
      adresse: form.adresse.trim() || null,
      telephone,
      position,
      ouvert_la_nuit: true,
    });
    setOccupe(false);
    if (error) return setErreur("Ajout impossible : " + error.message);
    setForm(VIDE);
    setSucces("Structure ajoutée.");
    charger();
  }

  async function basculer(s: Structure) {
    const { error } = await creerClientNavigateur().from("structures_sante").update({ ouvert_la_nuit: !s.ouvert_la_nuit }).eq("id", s.id);
    if (error) setErreur("Modification impossible : " + error.message);
    else charger();
  }

  async function supprimer(s: Structure) {
    if (!window.confirm(`Supprimer ${s.nom} ?`)) return;
    const { error } = await creerClientNavigateur().from("structures_sante").delete().eq("id", s.id);
    if (error) setErreur("Suppression impossible : " + error.message);
    else charger();
  }

  return (
    <div className="flex flex-col gap-6">
      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      {succes && <MessageInfo>{succes}</MessageInfo>}

      <form onSubmit={ajouter} className="flex flex-col gap-4 rounded-2xl border-[1.5px] border-trait bg-white p-4">
        <h2 className="text-lg font-extrabold">Nouvelle structure</h2>
        <p className="text-[13px] leading-snug text-discret">
          Hôpital, clinique ou centre de santé ouvert la nuit. Vérifiez par téléphone avant d&apos;ajouter : cette liste s&apos;affiche dans l&apos;espace Urgence.
        </p>
        <Champ libelle="Nom" required value={form.nom} onChange={modifier("nom")} />
        <Champ libelle="Type" placeholder="Hôpital, clinique, centre de santé…" value={form.type} onChange={modifier("type")} />
        <Champ libelle="Adresse" value={form.adresse} onChange={modifier("adresse")} />
        <Champ libelle="Téléphone" type="tel" value={form.telephone} onChange={modifier("telephone")} />
        <div className="grid grid-cols-2 gap-3">
          <Champ libelle="Latitude" inputMode="decimal" value={form.latitude} onChange={modifier("latitude")} />
          <Champ libelle="Longitude" inputMode="decimal" value={form.longitude} onChange={modifier("longitude")} />
        </div>
        <button type="submit" disabled={occupe} className={BOUTON_PRINCIPAL}>{occupe ? "Ajout…" : "Ajouter"}</button>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">Structures ({liste.length})</h2>
        <ul className="flex flex-col gap-3">
          {liste.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-trait bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-extrabold leading-tight">{s.nom}</p>
                  <p className="text-[13px] text-discret">{[s.type, s.adresse, s.telephone].filter(Boolean).join(" · ")}</p>
                </div>
                {s.ouvert_la_nuit ? <Pastille ton="vert">Affichée</Pastille> : <Pastille ton="gris">Masquée</Pastille>}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => basculer(s)} className="min-h-11 rounded-xl border-[1.5px] border-[#76837b] bg-white px-3.5 text-sm font-bold">
                  {s.ouvert_la_nuit ? "Masquer" : "Afficher"}
                </button>
                <button type="button" onClick={() => supprimer(s)} className="min-h-11 rounded-xl border-[1.5px] border-rouge bg-white px-3.5 text-sm font-bold text-rouge">
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function PageStructures() {
  return (
    <CadreAdmin titre="Structures de santé">
      <Contenu />
    </CadreAdmin>
  );
}
