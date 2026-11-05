import { docs } from "@/content/docs";
import { legalDocs } from "@/content/legal";
import { product } from "@/config/product";

export const dynamic = "force-static";

export function GET() {
  const u = (path: string) => `${product.url}${path}`;
  const lines = [
    `# ${product.fullName}`,
    "",
    `> ${product.description}`,
    "",
    "## Help",
    "",
    ...docs.map((d) => `- [${d.title}](${u(`/docs/${d.slug}`)}): ${d.description}`),
    "",
    "## Product",
    "",
    `- [Pricing](${u("/pricing")}): Free, Weekly, Monthly, Lifetime and Plus, with the 7 day refund`,
    `- [How we check](${u("/how-we-check")}): How we check direct source, reposts, ghost signals and agencies`,
    `- [Compare with directroles.net](${u("/compare/directroles")}): Dated price comparison`,
    `- [Full documentation as one file](${u("/llms-full.txt")}): All docs in markdown`,
    "",
    "## Legal",
    "",
    ...legalDocs.map((d) => `- [${d.title}](${u(`/legal/${d.slug}`)}): ${d.description}`),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
