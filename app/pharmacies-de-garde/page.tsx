import EnTete from "@/components/EnTete";
import ListePharmaciesGarde from "@/components/ListePharmaciesGarde";

// Annuaire public des pharmacies de garde de Yopougon (maquette « Voir les pharmacies de garde »).
export default function PharmaciesDeGarde() {
  return (
    <main className="flex min-h-screen flex-col gap-5 px-5 pb-8 pt-5">
      <EnTete />
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">
          Pharmacies de garde
        </h1>
        <p className="mt-1 text-base leading-snug text-discret">
          Les plus proches de vous, ouvertes en ce moment.
        </p>
      </div>
      <ListePharmaciesGarde />
    </main>
  );
}
