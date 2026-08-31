import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeilPass — Know before you pay",
  description: "Scam-resistant private payment requests on Starknet, powered by STRK20.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
