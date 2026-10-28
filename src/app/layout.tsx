import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./phase2.css";
import { headers } from "next/headers";
import PwaRegistration from "@/components/pwa-registration";
export const metadata: Metadata = {
  title: "Meu Norte · Gerenciador financeiro pessoal",
  description:
    "Seu dinheiro, com direção. Organize contas, metas e investimentos no seu ritmo.",
  applicationName: "Meu Norte",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Meu Norte" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#14151e",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await headers(); // Dynamic HTML: Next attaches the per-request CSP nonce to its scripts.
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
