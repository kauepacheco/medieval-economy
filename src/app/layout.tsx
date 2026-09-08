import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Medieval Economy · Your village",
  description: "Build a village, put your people to work, and grow a medieval economy. Local development world.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
