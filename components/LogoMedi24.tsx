// Emblème Medi24 pour les en-têtes. L'image se change en remplaçant public/logo-embleme.png.
export default function LogoMedi24({ taille = 40 }: { taille?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo-embleme.png" alt="" width={taille} height={taille} style={{ width: taille, height: taille }} />
  );
}
