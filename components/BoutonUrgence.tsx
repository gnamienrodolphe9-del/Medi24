import Link from "next/link";

// Bouton Urgence présent sur tous les écrans, comme demandé dans le cahier des charges (P7).
export default function BoutonUrgence() {
  return (
    <Link
      href="/urgence"
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-rouge px-4 text-[15px] font-bold text-white"
    >
      <svg
        width="18"
        height="18"
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
      Urgence
    </Link>
  );
}
