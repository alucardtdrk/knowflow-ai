import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "KnowFlow AI — conhecimento que resolve",
  description:
    "Transforme documentos da sua equipe em orientação clara, com fontes e próximos passos.",
  icons: { icon: "/brand/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
