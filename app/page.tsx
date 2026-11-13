import Link from "next/link";
import EnTete from "@/components/EnTete";
import DemandeEnCours from "@/components/DemandeEnCours";

// Écran d'accueil : deux entrées de même taille, Urgence et Médicament (maquette 1).
export default function Accueil() {
  return (
    <main className="flex min-h-screen flex-col gap-5 px-5 pb-6 pt-5">
      <EnTete />
      <DemandeEnCours />

      <section className="flex flex-col gap-2.5">
        <p className="inline-flex w-fit items-center gap-2 rounded-2xl bg-vert-clair px-3 py-1.5 text-[13px] font-semibold text-vert-fonce">
          <span className="h-2 w-2 rounded-full bg-vert" />
          Pharmacies de garde · Yopougon
        </p>
        <h1 className="text-[30px] font-extrabold leading-[1.15] tracking-tight">
          Un médicament cette nuit ? On alerte les pharmacies de garde.
        </h1>
        <p className="text-base leading-snug text-discret">
          Vous décrivez votre besoin, la première pharmacie qui répond vous
          contacte.
        </p>
      </section>

      <section className="flex flex-col gap-3.5">
        <Link
          href="/urgence"
          className="flex h-[156px] flex-col justify-between rounded-[18px] bg-rouge p-5 text-white"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
            </svg>
          </span>
          <span>
            <span className="block text-[26px] font-extrabold tracking-tight">
              Urgence
            </span>
            <span className="mt-1 block text-[15px] leading-snug">
              SAMU, pompiers, ma position. Rien à chercher.
            </span>
          </span>
        </Link>

        <Link
          href="/demande"
          className="flex h-[156px] flex-col justify-between rounded-[18px] bg-vert p-5 text-white"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.5 3.5l10 10a4.2 4.2 0 0 1-6 6l-10-10a4.2 4.2 0 0 1 6-6z" />
              <path d="M8 11l5 5" />
            </svg>
          </span>
          <span>
            <span className="block text-[26px] font-extrabold tracking-tight">
              J&apos;ai besoin d&apos;un médicament
            </span>
            <span className="mt-1 block text-[15px] leading-snug">
              Nom, ordonnance ou symptômes.
            </span>
          </span>
        </Link>
      </section>

      <Link
        href="/pharmacies-de-garde"
        className="flex min-h-16 items-center gap-3 rounded-[14px] border-[1.5px] border-trait bg-white px-4 py-3"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0a6847"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        <span className="flex-1">
          <span className="block text-base font-bold">
            Voir les pharmacies de garde
          </span>
          <span className="mt-0.5 block text-[13px] text-discret">
            Liste, carte, appel direct, itinéraire
          </span>
        </span>
      </Link>

      <Link
        href="/compte"
        className="flex min-h-12 items-center justify-center rounded-[14px] text-[15px] font-bold text-vert underline"
      >
        Mon compte et mes demandes
      </Link>

      <p className="mt-auto text-[13px] leading-snug text-discret">
        Medi24 met en relation avec les pharmacies. Le pharmacien décide de ce
        qu&apos;il vous remet. Service en test à Yopougon.
      </p>
    </main>
  );
}
