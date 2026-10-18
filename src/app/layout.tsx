import type { Metadata, Viewport } from "next";
import "./globals.css";
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
  viewportFit: "cover",
  themeColor: "#7160d8",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
