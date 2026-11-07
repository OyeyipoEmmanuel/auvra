import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], display: "swap", variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Auvra — The company that runs itself",
  description:
    "Describe the service you need. Auvra scopes the work, finds suitable agents, calculates the cost, and coordinates delivery.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={geist.variable}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
