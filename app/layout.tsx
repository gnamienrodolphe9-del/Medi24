import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import EnregistrementServiceWorker from "@/components/EnregistrementServiceWorker";
import { VERSION_APP } from "@/lib/version";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--police-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Medi24",
  description:
    "Trouvez une pharmacie de garde et votre médicament, la nuit, à Yopougon.",
  manifest: "/manifest.webmanifest",
  applicationName: "Medi24",
  icons: { apple: "/icons/apple-touch-icon.png" },
};



export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a6847",
};

export default function LayoutRacine({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={figtree.variable}>
      <head>
        {/* Garde la proposition d'installation du navigateur (envoyée une seule fois, très tôt)
            pour que le bouton « Installer » des pages puisse l'ouvrir plus tard. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__medi24Installation=e;});" +
              "window.addEventListener('appinstalled',function(){window.__medi24Installation=null;});",
          }}
        />
      </head>
      <body className="mx-auto min-h-screen max-w-md font-sans antialiased">
        {children}
        <p className="py-4 text-center text-sm text-gray-500">Medi24 - {new Date().getFullYear()} - Version : {VERSION_APP} </p>
        <EnregistrementServiceWorker />
      </body>
    </html>
  );
}
