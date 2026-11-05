import { Geist, Geist_Mono } from "next/font/google";

// Placeholder type pair (playbook whitelist). A product swaps these two lines per its docs/DESIGN.md.
export const sans = Geist({ subsets: ["latin"], variable: "--font-kit-sans", display: "swap" });
export const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-kit-mono", display: "swap" });
