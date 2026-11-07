"use client";

// Signal d'une nouvelle demande sur la page de la pharmacie : bip, vibration et titre de l'onglet.
// Le son ne peut jouer qu'après un premier toucher sur la page (règle des navigateurs) ; la
// vibration et le titre fonctionnent toujours.
let contexteAudio: AudioContext | null = null;

export function signalerNouvelleDemande(): void {
  try {
    navigator.vibrate?.([400, 150, 400, 150, 400]);
  } catch {
    // Vibration indisponible : sans importance.
  }
  try {
    const Classe =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Classe) return;
    contexteAudio = contexteAudio ?? new Classe();
    if (contexteAudio.state === "suspended") void contexteAudio.resume();
    for (let i = 0; i < 3; i++) {
      const oscillateur = contexteAudio.createOscillator();
      const gain = contexteAudio.createGain();
      oscillateur.frequency.value = 880;
      gain.gain.value = 0.15;
      oscillateur.connect(gain);
      gain.connect(contexteAudio.destination);
      const debut = contexteAudio.currentTime + i * 0.35;
      oscillateur.start(debut);
      oscillateur.stop(debut + 0.2);
    }
  } catch {
    // Son indisponible : sans importance.
  }
}
