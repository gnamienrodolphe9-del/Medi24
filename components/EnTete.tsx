import Link from "next/link";
import BoutonUrgence from "./BoutonUrgence";

// En-tête commun : logo à gauche, bouton Urgence permanent à droite.
export default function EnTete() {
  return (
    <header className="flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-vert">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span className="text-[22px] font-extrabold tracking-tight">Medi24</span>
      </Link>
      <BoutonUrgence />
    </header>
  );
}
