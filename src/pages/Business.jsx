import { useState } from "react";
import { Card, Btn, In, Sel, useF, Page } from "../ui";
const SV = [
  [
    "📹",
    "Security cameras",
    "CCTV and IP camera design, installation, cabling and remote viewing for shops, offices and compounds.",
  ],
  [
    "🌐",
    "Network infrastructure",
    "Structured cabling, Wi-Fi coverage, routers, switches and secure office networks.",
  ],
  [
    "💻",
    "Computer fleet care",
    "Repair and preventive maintenance packages for every PC and laptop your team uses.",
  ],
  [
    "📜",
    "Annual maintenance (AMC)",
    "Fixed yearly contract with response-time SLAs, scheduled visits and written warranty.",
  ],
];
export default function Business() {
  const [f, b] = useF({ kind: "Security cameras" }),
    [ok, setOk] = useState(false),
    [err, setErr] = useState("");
  const send = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const r = await fetch("/api/quote", {
        method: "POST",
        body: JSON.stringify(f),
      });
      if (!r.ok) throw 0;
      setOk(true);
    } catch {
      setErr("We could not send your request. Please call us or try again.");
    }
  };
  return (
    <Page title="Business solutions">
      <p className="-mt-2 text-slate-500">
        Camera systems, networks and IT maintenance for companies, with
        contracts and SLAs.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SV.map(([e, t, x]) => (
          <Card key={t} className="transition hover:-translate-y-1">
            <div className="text-3xl">{e}</div>
            <b className="mt-2 block">{t}</b>
            <p className="text-sm text-slate-500">{x}</p>
          </Card>
        ))}
      </div>
      <Card className="mx-auto w-full max-w-2xl">
        {ok ? (
          <div className="text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500">
              <svg
                viewBox="0 0 24 24"
                className="h-12 w-12"
                fill="none"
                stroke="#fff"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </div>
            <h2 className="mt-3 text-xl font-bold">Request received</h2>
            <p className="text-slate-500">
              Our business team will contact you with a quote.
            </p>
          </div>
        ) : (
          <form onSubmit={send} className="grid gap-3 sm:grid-cols-2">
            <h2 className="text-xl font-bold sm:col-span-2">Request a quote</h2>
            <In label="Company *" required {...b("company")} />
            <In label="Contact person *" required {...b("contact")} />
            <In label="Phone *" type="tel" required {...b("phone")} />
            <In label="Email" type="email" {...b("email")} />
            <Sel
              label="Service"
              o={[
                "Security cameras",
                "Network infrastructure",
                "Computer fleet care",
                "Annual maintenance (AMC)",
                "Other",
              ]}
              {...b("kind")}
            />
            <In
              label="Number of devices / cameras"
              type="number"
              min="0"
              {...b("devices")}
            />
            <In cls="sm:col-span-2" label="Site address" {...b("site")} />
            <label className="block text-xs font-semibold text-slate-500 sm:col-span-2">
              What do you need?
              <textarea
                rows={3}
                {...b("notes")}
                className="mt-1 w-full rounded-xl border border-slate-400/30 bg-white/50 px-3 py-2 text-sm dark:bg-white/5"
              />
            </label>
            {err && <p className="text-sm text-red-500 sm:col-span-2">{err}</p>}
            <div className="sm:col-span-2">
              <Btn className="w-full">Send request</Btn>
            </div>
          </form>
        )}
      </Card>
    </Page>
  );
}
