import type { ReactNode } from "react";

import type { Metadata } from "next";

import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dr. Nona CRM Moldova",
    template: "%s | Dr. Nona CRM",
  },
  description: "Внутренняя система управления заявками Dr. Nona Moldova.",
  icons: {
    icon: "/brand/favicon-64.png",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
