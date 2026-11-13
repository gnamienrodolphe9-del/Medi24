import Link from "next/link";
import BoutonUrgence from "./BoutonUrgence";

// En-tête commun : logo à gauche, bouton Urgence permanent à droite.
export default function EnTete() {
  return (
    <header className="flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2.5">
        {/* Logo officiel : remplacez public/logo-embleme.png pour le changer partout dans l'application. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-embleme.png" alt="" width={40} height={40} className="h-10 w-10" />
        <span className="text-[22px] font-extrabold tracking-tight">Medi24</span>
      </Link>
      <BoutonUrgence />
    </header>
  );
}
