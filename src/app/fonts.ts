import { Archivo, JetBrains_Mono, Newsreader } from "next/font/google";

// Straightpin type system (docs/design-brief.md §5, "the Help Wanted page"). Self hosted at build by next/font.
// `sans` = Archivo (body + UI, variable weight), `display` = Newsreader (headlines),
// `mono` = JetBrains Mono (dates, prices, counts, source hosts: tabular figures).
export const sans = Archivo({ subsets: ["latin"], variable: "--font-kit-sans", display: "swap" });
// One static weight keeps the hero heading file small, so the swap lands early (LCP).
export const display = Newsreader({ subsets: ["latin"], weight: ["600"], style: ["normal"], variable: "--font-kit-display", display: "swap" });
export const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-kit-mono", display: "swap" });
