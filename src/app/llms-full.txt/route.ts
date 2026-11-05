import { docs } from "@/content/docs";
import { product } from "@/config/product";

export const dynamic = "force-static";

export function GET() {
  const parts = docs.map((d) => {
    const body = d.sections
      .map((s) => {
        const code = s.code ? `\n\n\`\`\`${s.code.lang}\n${s.code.code}\n\`\`\`` : "";
        return `## ${s.heading}\n\n${s.body.join("\n\n")}${code}`;
      })
      .join("\n\n");
    return `# ${d.title}\n\nSource: ${product.url}/docs/${d.slug}\n\n${d.description}\n\n${body}`;
  });
  return new Response(`# ${product.fullName} documentation\n\n${parts.join("\n\n---\n\n")}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
