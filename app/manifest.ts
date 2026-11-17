import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Team Timesheets",
    short_name: "Timesheets",
    description: "Jira worklogs and utilisation",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f2f7f8",
    theme_color: "#111111", // black status bar on the installed phone app (matches the sign-in screen)
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
