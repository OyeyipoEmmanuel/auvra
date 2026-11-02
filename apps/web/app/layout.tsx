import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auvra — The company that runs itself",
  description: "Describe the service you need. Auvra scopes the work, finds suitable agents, calculates the cost, and coordinates delivery.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
