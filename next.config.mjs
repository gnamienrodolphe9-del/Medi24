/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // La bibliothèque des notifications push s'exécute seulement côté serveur, telle quelle.
  serverExternalPackages: ["web-push"],
};

export default nextConfig;
