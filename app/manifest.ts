import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Leggera Labs",
    short_name: "Leggera Labs",
    description: "Private, local AI and process automation for SMEs.",
    display: "browser",
    background_color: "#14120f",
    theme_color: "#14120f",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
