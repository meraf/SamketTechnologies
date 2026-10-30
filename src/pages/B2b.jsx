import { useState } from "react";
import { useDB, save, mn } from "../db";
import { Card, Btn, In, Sel, Tag, Gate, useF, Page } from "../ui";
const KINDS = [
    "Security cameras",
    "Network infrastructure",
    "Computer fleet care",
    "Annual maintenance (AMC)",
    "Other",
  ],
  ST = ["Quote", "Approved", "Installing", "Active", "Completed", "Cancelled"];
export default function B2b() {
  const d = useDB(),
    [f, b, setF] = useF(),
    [inv, setInv] = useState(null),
    [q, setQ] = useState("");
  const L = d.b2b
    .filter((x) => JSON.stringify(x).toLowerCase().includes(q.toLowerCase()))
    .sort((a, c) => c.ts - a.ts);
  const submit = async (e) => {
    e.preventDefault();
    await save("b2b", {
      ...f,
      amount: +f.amount || 0,
      cost: +f.cost || 0,
      devices: +f.devices || 0,
      date: f.date || Date.now(),
      inv:
        f.inv ||
        (+f.amount > 0
          ? "B2B-" + Date.now().toString(36).toUpperCase().slice(-5)
          : ""),
    });
    setF(null);
  };
  const slip = (x) => ({
    title: "INVOICE " + (x.inv || x.id.slice(-6).toUpperCase()),
    lines: [
      new Date().toLocaleString(),
      x.company,
      "Tax ID: " + (x.taxId || "-"),
      `${x.contact || ""} ${x.phone || ""}`,
      "--",
      x.kind || "",
      x.site ? "Site: " + x.site : "",
      x.devices ? x.devices + " device(s)" : "",
      x.sla ? "SLA: " + x.sla : "",
      "--",
      "TOTAL " + (x.amount || 0) + " ETB",
      "Terms: as agreed in the signed contract",
    ].filter(Boolean),
    stub: [],
  });
  return (
    <Page
      title="Business clients"
      right={
        <Btn onClick={() => setF({ kind: KINDS[0], status: "Quote" })}>
          New client / project
        </Btn>
      }
    >
      {f && (
        <Card>
          <form
            onSubmit={submit}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <In label="Company *" required {...b("company")} />
            <In label="Tax ID (TIN)" {...b("taxId")} />
            <In label="Contact person" {...b("contact")} />
            <In label="Phone" type="tel" {...b("phone")} />
            <In label="Email" type="email" {...b("email")} />
            <Sel label="Service" o={KINDS} {...b("kind")} />
            <In cls="sm:col-span-2" label="Site / address" {...b("site")} />
            <In label="Devices / cameras" type="number" {...b("devices")} />
            <Sel label="Contract status" o={ST} {...b("status")} />
            <In label="SLA (e.g. 4h response)" {...b("sla")} />
            <In label="Invoice amount (ETB)" type="number" {...b("amount")} />
            <In label="Our cost (ETB)" type="number" {...b("cost")} />
            <In label="Contract starts" type="date" {...b("start")} />
            <In label="Contract ends" type="date" {...b("end")} />
            <label className="block text-xs font-semibold text-slate-500 sm:col-span-2 lg:col-span-3">
              Project notes (equipment, camera positions, visits)
              <textarea
                rows={3}
                {...b("notes")}
                className="mt-1 w-full rounded-xl border border-slate-400/30 bg-white/50 px-3 py-2 text-sm dark:bg-white/5"
              />
            </label>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
              <Btn>Save</Btn>
              <Btn v="g" type="button" onClick={() => setF(null)}>
                Cancel
              </Btn>
            </div>
          </form>
        </Card>
      )}
      <In
        label="Search company, tax ID, site"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {L.map((x) => (
          <Card key={x.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <b className="min-w-0 flex-1 truncate">{x.company}</b>
              <Tag
                c={
                  x.status === "Active"
                    ? "ok"
                    : x.status === "Cancelled"
                      ? "bad"
                      : x.status === "Quote"
                        ? "warn"
                        : "slate"
                }
              >
                {x.status}
              </Tag>
            </div>
            <div className="break-words text-sm text-slate-500">
              {x.kind} · {x.devices || 0} devices · TIN {x.taxId || "-"}
              <br />
              {x.contact} {x.phone}
              <br />
              {x.site}
              {x.sla && (
                <>
                  <br />
                  SLA: {x.sla}
                </>
              )}
              {x.start && (
                <>
                  <br />
                  {x.start} → {x.end || "open"}
                </>
              )}
            </div>
            <div className="font-bold">{mn(x.amount)}</div>
            <div className="flex gap-2">
              <Btn v="g" className="!py-1" onClick={() => setF(x)}>
                Open
              </Btn>
              {x.amount > 0 && (
                <Btn v="g" className="!py-1" onClick={() => setInv(slip(x))}>
                  Invoice
                </Btn>
              )}
            </div>
          </Card>
        ))}
      </div>
      {!L.length && (
        <p className="text-slate-500">
          No business clients yet. Quote requests from the website appear here.
        </p>
      )}
      {inv && (
        <Gate slip={inv} title="Invoice ready" onClose={() => setInv(null)} />
      )}
    </Page>
  );
}
