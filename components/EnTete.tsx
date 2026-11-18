import Link from "next/link";
import BoutonUrgence from "./BoutonUrgence";
import LogoMedi24 from "./LogoMedi24";

// En-tête commun : logo à gauche, bouton Urgence permanent à droite.
export default function EnTete() {
  return (
    <header className="flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2.5">
        <LogoMedi24 taille={40} />
        <span className="text-[22px] font-extrabold tracking-tight">Medi24</span>
      </Link>
      <BoutonUrgence />
    </header>
  );
}
