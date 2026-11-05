import "./globals.css";
import type { Metadata, Viewport } from "next";
import ContextMenu from "./components/ContextMenu";
import IdleGuard from "./components/IdleGuard";
import { getUser, canEdit, demoMode } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Team Timesheets",
  description: "Jira worklogs and utilisation",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icon-180.png" },
  appleWebApp: { capable: true, title: "Timesheets", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser().catch(() => null);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("tt-theme");if(t)document.documentElement.dataset.theme=t;else if(matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.dataset.theme="dark"}catch(e){}` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      </head>
      <body>
        {demoMode && <div className="demobar">Live demo with fictional data. Read-only. <a href="https://github.com/thisamarupasinghe/team-timesheets" target="_blank" rel="noopener noreferrer">View the source</a></div>}
        {children}
        {user && !demoMode && !user.email.startsWith("local-dev") && <IdleGuard />}
        {canEdit(user?.role) && <ContextMenu />}
      </body>
    </html>
  );
}
