import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Inventario Cafe",
  description: "Inventario semanal de cafeteria comparado con stock FUDO"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
