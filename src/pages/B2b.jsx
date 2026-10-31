import { useState } from "react";
import { Link } from "react-router-dom";
import { useDB, save, mn, code, alertStaff } from "../db";
import {
  Card,
  Btn,
  In,
  Sel,
  Tag,
  Gate,
  Modal,
  PrintSheet,
  useF,
  useUser,
  Page,
} from "../ui";
const KINDS = [
    "Security cameras",
    "Network infrastructure",
    "Computer fleet care",
    "Annual maintenance (AMC)",
    "Other",
  ],
  ST = ["Quote", "Approved", "Installing", "Active", "Completed", "Cancelled"],
  TERMS = ["One-off", "Daily", "Weekly", "Monthly", "Yearly"],
  METHODS = ["Bank transfer", "Cash", "Telebirr", "CBE Birr", "Cheque"];

// ---- billing dates (local calendar dates, YYYY-MM-DD) ----
const iso = (dt) =>
  new Date(dt.getTime() - dt.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
export const todayStr = () => iso(new Date());
export const nextDate = (s, terms) => {
  const dt = new Date((s || todayStr()) + "T12:00:00");
  if (terms === "Daily") dt.setDate(dt.getDate() + 1);
  else if (terms === "Weekly") dt.setDate(dt.getDate() + 7);
  else if (terms === "Monthly") {
    const day = dt.getDate();
    dt.setDate(1);
    dt.setMonth(dt.getMonth() + 1);
    dt.setDate(Math.min(day, new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate()));
  } else if (terms === "Yearly") dt.setFullYear(dt.getFullYear() + 1);
  return iso(dt);
};
const recurring = (x) => x.terms && x.terms !== "One-off";
const billable = (x) => +x.amount > 0 && !["Quote", "Cancelled"].includes(x.status);
const isDue = (x) => billable(x) && !!x.nextDue && x.nextDue <= todayStr() && !x.paid;
export const dueList = (d) => d.b2b.filter(isDue);

/** In-app notification: red banner on every staff page while a B2B payment is due and not yet confirmed.
 *  (The Telegram alert for the same event is sent by the server, see lib/handler.js b2bReminders.) */
export function DueBanner() {
  const d = useDB(),
    L = dueList(d);
  if (!L.length) return null;
  return (
    <Link
      to="/staff/b2b"
      className="mx-2 mt-2 block rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 sm:mx-auto sm:max-w-6xl"
    >
      🔔 B2B payment due:{" "}
      {L.slice(0, 3)
        .map((x) => `${x.company} (${mn(x.amount)})`)
        .join(", ")}
      {L.length > 3 ? ` +${L.length - 3} more` : ""} · open to confirm once
      received
    </Link>
  );
}

const line = (k, v) => `${k}: ${v || "-"}`;
const invSlip = (x) => ({
  title: "INVOICE " + (x.inv || x.id.slice(-6).toUpperCase()),
  lines: [
    new Date().toLocaleString(),
    "--",
    "## Billed to",
    x.company,
    line("Tax ID (TIN)", x.taxId),
    line("Contact", `${x.contact || ""} ${x.phone || ""}`.trim()),
    line("Address / site", x.site),
    "--",
    "## Service",
    line("Service", x.kind),
    x.devices ? line("Devices", x.devices) : "",
    x.sla ? line("SLA", x.sla) : "",
    line("Billing terms", x.terms || "One-off"),
    x.nextDue ? line("Payment due", x.nextDue) : "",
    "--",
    `AMOUNT DUE${recurring(x) ? " (" + x.terms.toUpperCase() + " BILLING)" : ""}: ${x.amount || 0} ETB`,
    "Payment is registered only after Samket staff confirm receipt of funds.",
    "Terms: as agreed in the signed contract",
  ].filter((l) => l !== ""),
  stub: [
    "B2B " + (x.inv || x.id.slice(-6).toUpperCase()),
    x.company,
    `${x.contact || ""} ${x.phone || ""}`.trim(),
    `${x.kind || ""} · ${x.terms || "One-off"}`,
    `Amount ${x.amount || 0} ETB · due ${x.nextDue || "-"}`,
    "Staff: ____________  Date: __________",
  ],
});
const rcSlip = (x, p) => ({
  title: "PAYMENT RECEIPT " + p.rc,
  lines: [
    new Date(p.date).toLocaleString(),
    "--",
    "## Received from",
    x.company,
    line("Tax ID (TIN)", x.taxId),
    line("Contact", `${x.contact || ""} ${x.phone || ""}`.trim()),
    "--",
    "## Payment",
    line("For", `${x.kind || ""}${x.inv ? " · invoice " + x.inv : ""}`),
    line("Billing terms", x.terms || "One-off"),
    p.period ? line("Period / due date", p.period) : "",
    line("Method", p.method),
    p.ref ? line("Reference", p.ref) : "",
    "--",
    `AMOUNT RECEIVED: ${p.amount} ETB`,
    "--",
    line("Received by", p.by),
    "Thank you for your business.",
  ].filter((l) => l !== ""),
  stub: [
    p.rc,
    x.company,
    `Received ${p.amount} ETB · ${p.method}${p.ref ? " · " + p.ref : ""}`,
    `${x.kind || ""} · ${x.terms || "One-off"}`,
    p.next ? "Next billing date: " + p.next : "One-off payment settled",
    "Staff: ____________  Date: __________",
  ],
});

const H = ({ children }) => (
  <div style={{ fontWeight: 700, fontSize: 11.5, margin: "7px 0 2px", borderBottom: "1px solid #000" }}>
    {children}
  </div>
);
const Blank = ({ l, v }) => (
  <div style={{ display: "flex", gap: 4, alignItems: "flex-end", margin: "3px 0" }}>
    {l && <span style={{ whiteSpace: "nowrap" }}>{l}:</span>}
    <span style={{ flex: 1, borderBottom: "1px solid #000", minHeight: 13, paddingLeft: 3 }}>{v}</span>
  </div>
);
/** One printable A4 page: scope of work, safety, payment terms and signature blocks for both companies. */
export function TermsSheet({ x }) {
  return (
    <div
      className="a4page"
      style={{ width: "210mm", height: "296mm", boxSizing: "border-box", padding: "11mm 13mm", background: "#fff", color: "#000", fontFamily: "Arial,Helvetica,sans-serif", fontSize: 10.5, lineHeight: 1.35, overflow: "hidden" }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>SAMKET TECHNOLOGIES</div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>BUSINESS SERVICE AGREEMENT · TERMS, SAFETY &amp; SCOPE OF WORK</div>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
        {[
          ["SERVICE PROVIDER", ["Company", "TIN", "Address", "Representative", "Phone"], ["Samket Technologies"]],
          ["CLIENT", ["Company", "TIN", "Address / site", "Representative", "Phone"], [x.company, x.taxId, x.site, x.contact, x.phone]],
        ].map(([t, ls, vs]) => (
          <div key={t} style={{ flex: 1, border: "1px solid #000", padding: "3px 6px" }}>
            <b>{t}</b>
            {ls.map((l, i) => (
              <Blank key={l} l={l} v={vs[i]} />
            ))}
          </div>
        ))}
      </div>
      <H>1. Scope of work</H>
      <div>
        Service: <b>{x.kind || "________________"}</b>
        {x.devices ? ` · ${x.devices} device(s)/point(s)` : ""}
        {x.sla ? ` · response target: ${x.sla}` : ""}. Samket supplies, installs, configures, maintains and repairs
        the equipment and systems listed below, and only those.
      </div>
      <Blank l="Equipment / systems / locations covered" v={x.notes && x.notes.split("\n")[0]} />
      <Blank l="Out of scope (billed separately)" v="" />
      <Blank l="Contract period" v={x.start ? `${x.start} to ${x.end || "open"}` : ""} />
      <H>2. Safety</H>
      <ol style={{ margin: 0, paddingLeft: 16 }}>
        <li>The Client provides safe, lawful access to the site and names a site contact; the Client discloses hazards (live electrical work, heights, confined spaces, hazardous materials) before work starts.</li>
        <li>Samket staff follow safe working practice: power is isolated before work on equipment, ladders and tools are used correctly, and cabling is routed and fixed safely. Either party may stop work immediately if a condition is unsafe.</li>
        <li>The Client's mains power, earthing and surge protection must be adequate. Samket is not liable for faults caused by unsafe or defective site power, or by lightning, flood or fire.</li>
        <li>Each party backs up or protects its own data. Samket will not copy, remove or disclose Client data or footage and treats all Client information as confidential.</li>
        <li>Equipment is handled with care. Removed or replaced parts belong to the Client unless agreed otherwise in writing.</li>
      </ol>
      <H>3. Payment</H>
      <div>
        Amount: <b>{x.amount ? `${x.amount} ETB` : "________ ETB"}</b> · billing terms:{" "}
        <b>{x.terms || "One-off"}</b> (daily / weekly / monthly / yearly / one-off) · first / next payment due:{" "}
        <b>{x.nextDue || "__________"}</b>. Payment is due on the billing date. A payment counts as received only when
        Samket confirms the funds, and a receipt is then issued. Overdue amounts may pause service after 7 days&apos; written
        notice.
      </div>
      <H>4. Warranty &amp; liability</H>
      <div>
        Workmanship and supplied parts carry the warranty stated on the invoice or receipt. Warranty excludes misuse, liquid
        or physical damage, unauthorised repair and power faults. Samket&apos;s total liability is limited to the fees paid for
        the affected service. Neither party is liable for indirect loss.
      </div>
      <H>5. Changes &amp; termination</H>
      <div>
        Changes to scope or price must be written and signed by both parties. Either party may end the agreement with 30
        days&apos; written notice; fees for work already done remain payable. Disputes are first settled by discussion between
        the representatives named above.
      </div>
      <H>6. Additional agreed terms</H>
      <Blank l="" v="" />
      <Blank l="" v="" />
      <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
        {["For SAMKET TECHNOLOGIES", "For the CLIENT" + (x.company ? " – " + x.company : "")].map((t) => (
          <div key={t} style={{ flex: 1 }}>
            <b>{t}</b>
            <Blank l="Name" v="" />
            <Blank l="Title" v="" />
            <Blank l="Date" v="" />
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <div style={{ flex: 1, height: 44, borderBottom: "1px solid #000", fontSize: 9, color: "#444" }}>Signature</div>
              <div style={{ width: 70, height: 44, border: "1px dashed #000", fontSize: 9, color: "#444", textAlign: "center" }}>Stamp</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function TermsModal({ x, onClose }) {
  const go = () => {
    const end = () => {
      removeEventListener("afterprint", end);
      onClose();
    };
    addEventListener("afterprint", end);
    setTimeout(() => print(), 60);
  };
  return (
    <>
      <div className="print:hidden">
        <Modal title={`Terms & scope sheet · ${x.company}`} onClose={onClose} z={60}>
          <p className="text-sm text-slate-500">
            One A4 page for both companies to fill in, sign and stamp: scope of work, safety, payment terms and signature blocks.
            Details already entered for this client are pre-filled.
          </p>
          <div className="flex gap-2">
            <Btn onClick={go}>🖨 Print A4</Btn>
            <Btn v="g" onClick={onClose}>
              Close
            </Btn>
          </div>
          <div className="overflow-auto rounded-xl bg-slate-200 p-2">
            <div style={{ zoom: 0.5 }} className="mx-auto w-fit shadow">
              <TermsSheet x={x} />
            </div>
          </div>
        </Modal>
      </div>
      <PrintSheet page="A4 portrait">
        <TermsSheet x={x} />
      </PrintSheet>
    </>
  );
}

export default function B2b() {
  const d = useDB(),
    u = useUser(),
    [f, b, setF] = useF(),
    [inv, setInv] = useState(null),
    [terms, setTerms] = useState(null),
    [pay, setPay] = useState(null),
    [pv, setPv] = useState({}),
    [perr, setPerr] = useState(""),
    [busy, setBusy] = useState(false),
    [q, setQ] = useState("");
  const L = d.b2b
    .filter((x) => JSON.stringify(x).toLowerCase().includes(q.toLowerCase()))
    .sort((a, c) => c.ts - a.ts);
  const submit = async (e) => {
    e.preventDefault();
    const rec = f.terms && f.terms !== "One-off";
    if (rec && +f.amount > 0 && !f.nextDue)
      return alert("Recurring terms need the billing date (first payment due).");
    await save("b2b", {
      ...f,
      terms: f.terms || "One-off",
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
  const openPay = (x) => {
    setPerr("");
    setPv({
      amount: x.amount,
      method: "Bank transfer",
      ref: "",
      next: recurring(x) ? nextDate(x.nextDue || todayStr(), x.terms) : "",
    });
    setPay(x);
  };
  // Staff press "Confirm Payment" only when the money has really arrived. This is the ONLY thing that adds B2B revenue.
  const confirmPay = async () => {
    if (busy) return;
    const x = pay,
      amt = +pv.amount;
    if (!(amt > 0)) return setPerr("Enter the amount received.");
    if (recurring(x) && !pv.next) return setPerr("Enter the next billing date.");
    setBusy(true);
    try {
      const p = await save("b2bpay", {
        b2bId: x.id,
        company: x.company,
        rc: await code("BR"),
        amount: amt,
        cost: +x.cost || 0,
        method: pv.method,
        ref: (pv.ref || "").trim(),
        period: x.nextDue || "",
        next: recurring(x) ? pv.next : "",
        date: Date.now(),
        by: u.role,
      });
      await save("b2b", {
        ...x,
        lastPaid: Date.now(),
        nextDue: recurring(x) ? pv.next : x.nextDue,
        paid: !recurring(x),
      });
      alertStaff(`Payment received: ${x.company} paid ${amt} ETB (${pv.method}) · receipt ${p.rc}`);
      setPay(null);
      setInv(rcSlip(x, p));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title="Business clients"
      right={
        <Btn onClick={() => setF({ kind: KINDS[0], status: "Quote", terms: "One-off" })}>
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
            <In
              label={recurring(f) ? "Amount per billing period (ETB)" : "Invoice amount (ETB)"}
              type="number"
              {...b("amount")}
            />
            <In
              label={recurring(f) ? "Our cost per period (ETB)" : "Our cost (ETB)"}
              type="number"
              {...b("cost")}
            />
            <Sel label="Payment terms" o={TERMS} {...b("terms")} />
            <In
              label={recurring(f) ? "Billing date * (first payment due)" : "Payment due date (optional)"}
              type="date"
              {...b("nextDue")}
            />
            <In label="Contract starts" type="date" {...b("start")} />
            <In label="Contract ends" type="date" {...b("end")} />
            <p className="self-end text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
              Agreeing terms does not count as income. Revenue is added only when you press
              “Confirm Payment”. On the due date staff get an in-app alert and a Telegram message.
            </p>
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
        {L.map((x) => {
          const pays = d.b2bpay.filter((p) => p.b2bId === x.id).sort((a, c) => c.date - a.date),
            due = isDue(x);
          return (
            <Card key={x.id} className={`space-y-2 ${due ? "!border-red-500/60" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <b className="min-w-0 flex-1 truncate">{x.company}</b>
                {due && <Tag c="bad">Payment due</Tag>}
                {x.paid && <Tag c="ok">Paid</Tag>}
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
              <div className="font-bold">
                {mn(x.amount)}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {x.terms || "One-off"}
                  {x.nextDue && !x.paid ? ` · next due ${x.nextDue}` : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn v="g" className="!py-1" onClick={() => setF(x)}>
                  Open
                </Btn>
                {x.amount > 0 && (
                  <Btn v="g" className="!py-1" onClick={() => setInv(invSlip(x))}>
                    Invoice
                  </Btn>
                )}
                <Btn v="g" className="!py-1" onClick={() => setTerms(x)}>
                  Terms sheet
                </Btn>
                {billable(x) && !x.paid && (
                  <Btn className="!py-1" onClick={() => openPay(x)}>
                    Confirm Payment
                  </Btn>
                )}
              </div>
              {!!pays.length && (
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer">
                    {pays.length} payment(s) received · {mn(pays.reduce((a, p) => a + p.amount, 0))}
                  </summary>
                  {pays.map((p) => (
                    <div key={p.id} className="mt-1 flex items-center gap-2">
                      <span className="flex-1">
                        {new Date(p.date).toLocaleDateString()} · {mn(p.amount)} · {p.method} · {p.rc}
                      </span>
                      <button
                        className="font-semibold text-orange-500"
                        onClick={() => setInv(rcSlip(x, p))}
                      >
                        Receipt
                      </button>
                    </div>
                  ))}
                </details>
              )}
            </Card>
          );
        })}
      </div>
      {!L.length && (
        <p className="text-slate-500">
          No business clients yet. Quote requests from the website appear here.
        </p>
      )}
      {pay && (
        <Modal title={`Confirm payment · ${pay.company}`} onClose={() => setPay(null)} z={60}>
          <p className="text-sm text-slate-500">
            Only confirm when the money has actually been received. This adds the amount to revenue and issues an A4 receipt.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <In
              label="Amount received (ETB)"
              type="number"
              value={pv.amount ?? ""}
              onChange={(e) => setPv({ ...pv, amount: e.target.value })}
            />
            <Sel
              label="Method"
              o={METHODS}
              value={pv.method}
              onChange={(e) => setPv({ ...pv, method: e.target.value })}
            />
            <In
              cls="sm:col-span-2"
              label="Reference / transaction no. (optional)"
              value={pv.ref}
              onChange={(e) => setPv({ ...pv, ref: e.target.value })}
            />
            {recurring(pay) && (
              <In
                cls="sm:col-span-2"
                label={`Next billing date * (${pay.terms.toLowerCase()} terms)`}
                type="date"
                value={pv.next}
                onChange={(e) => setPv({ ...pv, next: e.target.value })}
              />
            )}
          </div>
          {perr && <p className="text-sm text-red-500">{perr}</p>}
          <div className="flex gap-2">
            <Btn disabled={busy} onClick={confirmPay}>
              Confirm Payment
            </Btn>
            <Btn v="g" onClick={() => setPay(null)}>
              Cancel
            </Btn>
          </div>
        </Modal>
      )}
      {terms && <TermsModal x={terms} onClose={() => setTerms(null)} />}
      {inv && (
        <Gate
          a4only
          slip={inv}
          title={inv.title.startsWith("PAYMENT") ? "Payment confirmed" : "Invoice ready"}
          sub={inv.title}
          onClose={() => setInv(null)}
        />
      )}
    </Page>
  );
}
