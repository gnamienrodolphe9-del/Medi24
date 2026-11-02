// Page affichée quand l'internet est coupé et que la page demandée n'est pas en mémoire.
// Les numéros d'urgence restent visibles et cliquables.
export default function HorsLigne() {
  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 py-8">
      <h1 className="text-[28px] font-extrabold tracking-tight">
        Vous êtes hors ligne
      </h1>
      <p className="text-base leading-snug text-discret">
        Cette page n&apos;est pas disponible sans internet. En cas d&apos;urgence,
        appelez directement :
      </p>
      <a
        href="tel:185"
        className="flex min-h-16 items-center justify-between rounded-2xl bg-rouge px-5 text-white"
      >
        <span className="text-xl font-extrabold">SAMU</span>
        <span className="text-3xl font-extrabold">185</span>
      </a>
      <a
        href="tel:180"
        className="flex min-h-16 items-center justify-between rounded-2xl border-2 border-rouge bg-white px-5 text-rouge"
      >
        <span className="text-xl font-extrabold">Pompiers</span>
        <span className="text-3xl font-extrabold">180</span>
      </a>
    </main>
  );
}
