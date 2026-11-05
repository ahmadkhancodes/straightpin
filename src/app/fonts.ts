import { Bricolage_Grotesque, Caveat, JetBrains_Mono, Public_Sans } from "next/font/google";

// docs/DESIGN.md section 5. Self hosted at build time by next/font (no runtime font CDN).
export const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-straight-display", display: "swap" });
export const sans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-straight-sans", display: "swap" });
// Tiny metadata only: source host and first posted date.
export const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-straight-mono", display: "swap" });
// One use only: the "Old posting" margin note.
export const hand = Caveat({ subsets: ["latin"], weight: ["600"], variable: "--font-straight-hand", display: "swap" });
