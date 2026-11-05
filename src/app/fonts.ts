import { Bricolage_Grotesque, Caveat, JetBrains_Mono, Public_Sans } from "next/font/google";

// Straightpin type system (docs/DESIGN.md §5). Self hosted at build by next/font, no runtime font CDN.
// `sans` = Public Sans (body + UI), `mono` = JetBrains Mono (tiny metadata only).
export const sans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-kit-sans", display: "swap" });
export const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-kit-mono", display: "swap" });
// Display headings (no 800/900) and the one Caveat margin note ("Old posting").
export const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-kit-display", display: "swap" });
export const note = Caveat({ subsets: ["latin"], weight: ["600"], variable: "--font-kit-note", display: "swap" });
