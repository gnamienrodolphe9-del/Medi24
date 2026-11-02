// Réduit une photo d'ordonnance avant l'envoi : 1 600 pixels au plus, JPEG.
// Une photo de téléphone pèse 3 à 8 Mo ; après réduction, environ 300 à 600 Ko,
// ce qui passe même avec une mauvaise connexion.
export async function compresserImage(fichier: File, coteMax = 1600, qualite = 0.72): Promise<File> {
  const image = await chargerImage(fichier);
  const echelle = Math.min(1, coteMax / Math.max(image.largeur, image.hauteur));
  const largeur = Math.round(image.largeur * echelle);
  const hauteur = Math.round(image.hauteur * echelle);

  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const contexte = canvas.getContext("2d");
  if (!contexte) throw new Error("Compression impossible sur cet appareil.");
  contexte.fillStyle = "#ffffff";
  contexte.fillRect(0, 0, largeur, hauteur);
  contexte.drawImage(image.source, 0, 0, largeur, hauteur);
  image.liberer();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", qualite)
  );
  if (!blob) throw new Error("Compression impossible sur cet appareil.");
  return new File([blob], "ordonnance.jpg", { type: "image/jpeg" });
}

type ImageChargee = {
  source: CanvasImageSource;
  largeur: number;
  hauteur: number;
  liberer: () => void;
};

async function chargerImage(fichier: File): Promise<ImageChargee> {
  // createImageBitmap applique l'orientation de la photo (téléphone tenu en travers).
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(fichier);
      return {
        source: bitmap,
        largeur: bitmap.width,
        hauteur: bitmap.height,
        liberer: () => bitmap.close(),
      };
    } catch {
      // On essaie la méthode classique ci-dessous.
    }
  }
  const adresse = URL.createObjectURL(fichier);
  const element = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Photo illisible. Essayez une autre photo."));
    img.src = adresse;
  });
  return {
    source: element,
    largeur: element.naturalWidth,
    hauteur: element.naturalHeight,
    liberer: () => URL.revokeObjectURL(adresse),
  };
}
