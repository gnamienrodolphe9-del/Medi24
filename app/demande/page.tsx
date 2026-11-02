import EnTete from "@/components/EnTete";
import FormulaireDemande from "@/components/FormulaireDemande";

export default function Demande() {
  return (
    <main className="flex min-h-screen flex-col gap-5 px-5 pb-10 pt-5">
      <EnTete />
      <h1 className="text-[28px] font-extrabold tracking-tight">Que vous faut-il ?</h1>
      <FormulaireDemande />
    </main>
  );
}
