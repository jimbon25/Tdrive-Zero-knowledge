import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "react-hot-toast";
import { DialogProvider } from "@/components/notifications/DialogProvider";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TDrive | Telegram Cloud Storage",
  description: "Secure, personal cloud storage using Telegram as backend",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.className, "theme-transition")}>
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <DialogProvider />
            {children}
            <Toaster position="bottom-left" />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
