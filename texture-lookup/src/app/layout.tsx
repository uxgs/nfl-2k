import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PS2 Texture Lookup",
  description: "Find texture IDs for PS2 football uniform modding."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

