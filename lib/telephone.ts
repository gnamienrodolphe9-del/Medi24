// Numéros de téléphone ivoiriens : +225 suivi de 10 chiffres (format en vigueur depuis 2021).
// Accepte "07 00 00 00 00", "0700000000", "+225 07 00 00 00 00" ou "00225 0700000000".
// Renvoie le numéro au format international "+2250700000000", ou null si invalide.
export function normaliserTelephoneCi(saisie: string): string | null {
  const net = saisie.replace(/[\s.\-()]/g, "");
  let chiffres: string;
  if (net.startsWith("+225")) chiffres = net.slice(4);
  else if (net.startsWith("00225")) chiffres = net.slice(5);
  else chiffres = net;
  if (!/^\d{10}$/.test(chiffres)) return null;
  return `+225${chiffres}`;
}
