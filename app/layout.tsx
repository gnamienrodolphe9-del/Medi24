import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import EnregistrementServiceWorker from "@/components/EnregistrementServiceWorker";

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
      <body className="mx-auto min-h-screen max-w-md font-sans antialiased">
        {children}
        <EnregistrementServiceWorker />
      </body>
    </html>
  );
}
