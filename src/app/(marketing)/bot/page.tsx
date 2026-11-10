import type { Metadata } from "next";
import { Section } from "@/components/ui/layout";
import { socialImages } from "@/lib/seo";
import { product } from "@/config/product";
import { USER_AGENT } from "@/lib/crawl/types";
import { EXCERPT_MAX } from "@/lib/crawl/normalize";
import { ROBOTS_PRODUCT_TOKEN } from "@/lib/crawl/net/robots";
import { DENY_HOSTS } from "@/lib/crawl/net/egress";

const title = "The Straightpin crawler";
const description = "Who we are when we visit a company's careers page, what we read, how fast we go, and how an employer can ask us to stop.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/bot" },
  openGraph: { title: `${title} · ${product.fullName}`, description, url: "/bot", ...socialImages().openGraph },
  twitter: { title: `${title} · ${product.fullName}`, ...socialImages().twitter },
};

const code = "rounded-sm bg-surface-raised px-1 font-mono text-sm text-text";

export default function BotPage() {
  return (
    <Section labelledBy="bot-title">
      <h1 id="bot-title" className="heading-3 md:heading-1 max-w-3xl text-text">{title}</h1>
      <p className="body-3 md:title-1 mt-4 max-w-2xl text-text-subtle">
        If you run a careers page and found us in your logs, this page is for you.
      </p>
      <div className="mt-12 grid max-w-3xl grid-cols-1 gap-12">
        <section aria-labelledby="bot-ua">
          <h2 id="bot-ua" className="heading-5 text-text">Who we are</h2>
          <p className="body-3 mt-3 text-text-subtle">Straightpin is a job search site run by {product.company}. Our crawler identifies itself with this user agent:</p>
          <p className="mt-3 break-words"><code className={code}>{USER_AGENT}</code></p>
        </section>

        <section aria-labelledby="bot-what">
          <h2 id="bot-what" className="heading-5 text-text">What we crawl</h2>
          <ul className="body-3 mt-3 grid grid-cols-1 list-disc gap-2 pl-5 text-text-subtle">
            <li>Public job feeds that hiring systems offer to anyone: Greenhouse, Lever, Ashby, Workable, Recruitee and Personio.</li>
            <li>Public careers pages that list a job in schema.org JobPosting markup, found through the sitemap named in your robots.txt.</li>
            <li>Nothing behind a login, nothing that needs a form, and no applicant data. We never apply on anyone&apos;s behalf.</li>
          </ul>
          <p className="body-3 mt-3 text-text-subtle">
            We do not crawl {DENY_HOSTS.join(", ")}, and we do not use proxies or tools that hide who we are. If a site shows a bot check, we stop and mark that host as blocked instead of getting around it.
          </p>
        </section>

        <section aria-labelledby="bot-manners">
          <h2 id="bot-manners" className="heading-5 text-text">How we behave</h2>
          <ul className="body-3 mt-3 grid grid-cols-1 list-disc gap-2 pl-5 text-text-subtle">
            <li>We read your <code className={code}>robots.txt</code> before any other request and keep it for up to 24 hours. A server error on robots.txt counts as &quot;do not crawl&quot; for 24 hours.</li>
            <li>At most one request per second and four at once to a host. We follow <code className={code}>Crawl-delay</code> and <code className={code}>Retry-After</code>.</li>
            <li>We ask only for what changed, using ETag and If-Modified-Since when your server supports them.</li>
          </ul>
        </section>

        <section aria-labelledby="bot-stop">
          <h2 id="bot-stop" className="heading-5 text-text">How to ask us to stop</h2>
          <p className="body-3 mt-3 text-text-subtle">Either way works. Use whichever is easier for you.</p>
          <ol className="body-3 mt-3 grid grid-cols-1 list-decimal gap-2 pl-5 text-text-subtle">
            <li>
              Add this to your <code className={code}>robots.txt</code>. We pick it up within a day:
              <pre className="mt-2 overflow-x-auto rounded-sm bg-surface-raised p-3 font-mono text-sm text-text">{`User-agent: ${ROBOTS_PRODUCT_TOKEN}\nDisallow: /`}</pre>
            </li>
            <li>
              Email <a className="text-action underline underline-offset-4" href={`mailto:${product.supportEmail}?subject=Crawler%20removal%20request`}>{product.supportEmail}</a> with the subject &quot;Crawler removal request&quot; and your company name or careers page address. We stop crawling and remove your listings within 48 hours, and we reply when it is done.
            </li>
          </ol>
        </section>

        <section aria-labelledby="bot-contact">
          <h2 id="bot-contact" className="heading-5 text-text">Contact</h2>
          <p className="body-3 mt-3 text-text-subtle">
            Something wrong with how we visit your site, or a listing you want corrected? Write to <a className="text-action underline underline-offset-4" href={`mailto:${product.supportEmail}`}>{product.supportEmail}</a>. A person reads it. What we keep from your page is described on <a className="text-action underline underline-offset-4" href="/about/data">what we store</a>.
          </p>
          <p className="body-6 mt-3 text-text-subtle">Each listing is shown as facts, a short excerpt of up to {EXCERPT_MAX} characters, and a link that sends the job seeker to your own page to apply.</p>
        </section>
      </div>
    </Section>
  );
}
