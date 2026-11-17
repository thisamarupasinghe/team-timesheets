import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/shell.css";
import "./styles/pages.css";
import "./styles/mono.css"; // black-and-white theme: remove this line to go back to teal
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import IdleGuard from "./components/IdleGuard";
import ServiceWorker from "./components/ServiceWorker";
import { Toaster } from "./components/ui/Toast";
import { getUser, demoMode } from "@/lib/auth";

const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Team Timesheets", template: "%s · Team Timesheets" },
  description: "Jira worklogs and utilisation",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icon-180.png" },
  appleWebApp: { capable: true, title: "Timesheets", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#111111" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0c" },
  ],
};

// Runs before paint: applies the saved theme (or the system one) and the sidebar state, so nothing flashes.
const PREPAINT = `try{var d=document.documentElement,t=localStorage.getItem("tt-theme");d.dataset.theme=t==="light"||t==="dark"?t:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");if(localStorage.getItem("tt-sb")==="collapsed")d.dataset.sb="collapsed"}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser().catch(() => null);
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
      </head>
      <body>
        {children}
        <Toaster />
        <ServiceWorker />
        {user && !demoMode && !user.email.startsWith("local-dev") && <IdleGuard />}
      </body>
    </html>
  );
}
