import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NihongoBridge",
    short_name: "NihongoBridge",
    description: "Focused Japanese study, SRS review, and JLPT practice.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FAFAF7",
    theme_color: "#C0392B",
    lang: "en",
  };
}
