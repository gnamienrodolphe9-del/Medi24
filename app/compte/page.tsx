import type { Metadata } from "next";
import EnTete from "@/components/EnTete";
import ContenuCompte from "./contenu";

export const metadata: Metadata = { title: "Mon compte · Medi24" };

export default function PageCompte() {
  return (
    <main className="flex min-h-screen flex-col gap-5 px-5 pb-10 pt-5">
      <EnTete />
      <h1 className="text-[28px] font-extrabold tracking-tight">Mon compte</h1>
      <ContenuCompte />
    </main>
  );
}
