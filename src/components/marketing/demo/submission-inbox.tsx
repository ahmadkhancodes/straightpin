import { Badge } from "@/components/ui/states";

type Status = "Delivered" | "Held" | "Spam blocked";
interface Row {
  name: string;
  email: string;
  preview: string;
  when: string;
  status: Status;
  receipt: string;
}

const rows: Row[] = [
  { name: "Daniel Okafor", email: "daniel@okaforbuilds.ng", preview: "Do you ship to Lagos? We need 40 units by January.", when: "2 min ago", status: "Delivered", receipt: "Sent 14:07:12, opened by ops@" },
  { name: "Priya Raman", email: "priya.raman@northfold.io", preview: "Quote for the agency plan across 11 client sites.", when: "17 min ago", status: "Delivered", receipt: "Sent 13:52:41" },
  { name: "cheap-seo-4u", email: "ranker@mailbox-promo.ru", preview: "Boost your Google ranking in 48 hours!!!", when: "41 min ago", status: "Spam blocked", receipt: "Not counted toward quota" },
  { name: "Hannah Lindqvist", email: "hannah@lindqvist.se", preview: "The booking form shows an error after step 2.", when: "Nov 3, 14:07", status: "Held", receipt: "Over limit, kept for release" },
  { name: "Tomás Villanueva", email: "tomas@casavillanueva.mx", preview: "Booking request for Dec 14, party of 9.", when: "Nov 3, 09:52", status: "Delivered", receipt: "Sent 09:52:03" },
  { name: "Jun Park", email: "jun@parkandvale.com", preview: "Partnership enquiry from our design studio.", when: "Nov 2, 21:18", status: "Delivered", receipt: "Sent 21:18:44" },
];

const tone: Record<Status, "success" | "warning" | "danger"> = { Delivered: "success", Held: "warning", "Spam blocked": "danger" };

/** Static illustration of the real inbox: believable data, cropped to one panel on small screens. */
export function SubmissionInbox() {
  return (
    <figure className="m-0">
      <figcaption className="sr-only">Example of the Postslot submissions inbox with a delivery receipt for each submission</figcaption>
      <div className="max-h-96 overflow-hidden rounded-lg border border-border bg-surface md:max-h-none">
        <div className="flex items-center justify-between gap-4 border-b border-border bg-surface-raised px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <p className="title-4 truncate text-text">contact-form</p>
            <p className="caption-5 truncate text-text-subtle">Sent to hello@okaforbuilds.ng</p>
          </div>
          <p className="caption-4 shrink-0 text-text-subtle">6 of 187 shown</p>
        </div>
        <table className="w-full border-collapse text-left">
          <thead className="sr-only md:not-sr-only">
            <tr className="border-b border-border">
              <th scope="col" className="px-4 py-2 caption-3 text-text-subtle">From</th>
              <th scope="col" className="hidden px-4 py-2 caption-3 text-text-subtle md:table-cell">Message</th>
              <th scope="col" className="hidden px-4 py-2 caption-3 text-text-subtle sm:table-cell">Received</th>
              <th scope="col" className="px-4 py-2 caption-3 text-text-subtle">Delivery receipt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email} className="border-b border-border last:border-b-0">
                <td className="max-w-0 px-4 py-3 align-top">
                  <p className="title-4 truncate text-text">{r.name}</p>
                  <p className="caption-5 truncate text-text-subtle">{r.email}</p>
                  <p className="caption-5 mt-1 truncate text-text-muted md:hidden">{r.preview}</p>
                </td>
                <td className="hidden max-w-0 px-4 py-3 align-top md:table-cell">
                  <p className="body-6 truncate text-text-subtle">{r.preview}</p>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 align-top caption-2 text-text-subtle sm:table-cell">{r.when}</td>
                <td className="px-4 py-3 align-top">
                  <Badge tone={tone[r.status]}>{r.status}</Badge>
                  <p className="caption-5 mt-1 hidden text-text-subtle sm:block">{r.receipt}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
