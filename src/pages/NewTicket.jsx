import { newTicketCode } from "../../lib/ticketcode.js";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { save, code, upCust, alertStaff } from "../db";
import { Card, Btn, In, Sel, Gate, useF, Page } from "../ui";
export const CH = [
  "Battery health",
  "Screen scratches",
  "Camera",
  "FaceID / Touch ID",
  "Speakers / mic",
  "Charging port",
  "Water indicator",
];
export const ps = (t, tear = false) => ({
  title: "REPAIR " + t.code,
  lines: [
    new Date(t.date).toLocaleString(),
    `${t.name} ${t.phone}`,
    `${t.device || ""} ${t.imei ? "IMEI " + t.imei : ""}`,
    "Problem: " + (t.issue || ""),
    "--",
    "CHECK " +
      Object.entries(t.chk || {})
        .map(([k, v]) => k.split(" ")[0] + ":" + v)
        .join(" "),
    "Condition accepted: " + (t.ack ? "YES" : "NO"),
    ...(t.status === "Delivered"
      ? [
          "--",
          `Price ${t.cost} ETB`,
          t.war > 0 ? `Warranty ${t.war} days` : "No warranty",
        ]
      : t.status === "Unfixed"
        ? [
            "--",
            "RESULT: NOT REPAIRED (UNFIXED)",
            t.why ? "Reason: " + t.why : "",
            `Diagnosis fee ${t.cost || 0} ETB`,
          ].filter(Boolean)
        : []),
  ],
  // Compact right-hand tear-away strip: customer, phone, date, problem only.
  stub: !tear
    ? []
    : [
        ["Customer", t.name],
        ["Phone", t.phone],
        ["Date", new Date(t.date).toLocaleDateString()],
        ["Problem", (t.issue || "").slice(0, 220)],
      ].filter((r) => r[1]),
});
export default function NewTicket() {
  const [f, b, setF] = useF({
      dtype: "Phone",
      chk: Object.fromEntries(CH.map((k) => [k, "OK"])),
    }),
    [slip, setSlip] = useState(null),
    nav = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    const cid = await upCust(f.name, f.phone),
      t = await save("ticket", {
        ...f,
        custId: cid,
        code: newTicketCode(),
        status: "Received",
        cost: 0,
        pcost: 0,
        war: 0,
        date: Date.now(),
        hist: [{ s: "Received", t: Date.now() }],
      });
    alertStaff(
      `New repair ticket ${t.code}: ${t.name} ${t.phone} · ${t.device || t.dtype} · ${(t.issue || "").slice(0, 120)}`,
    );
    setSlip(ps(t, true));
  };
  return (
    <Page title="New repair ticket">
      <Card>
        <form
          onSubmit={submit}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <In label="Customer *" required {...b("name")} />
          <In label="Phone *" required type="tel" {...b("phone")} />
          <In label="Email" type="email" {...b("email")} />
          <Sel
            label="Device type"
            o={["Phone", "Laptop", "Desktop", "Tablet", "Modem", "Other"]}
            {...b("dtype")}
          />
          <In label="Brand and model" {...b("device")} />
          <In label="IMEI / serial" {...b("imei")} />
          <label className="block text-xs font-semibold text-slate-500 sm:col-span-2 lg:col-span-3">
            Problem *
            <textarea
              required
              rows={2}
              {...b("issue")}
              className="mt-1 w-full rounded-xl border border-slate-400/30 bg-white/50 px-3 py-2 text-sm dark:bg-white/5"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <b className="text-sm">Intake checklist (condition before work)</b>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CH.map((k) => (
                <Sel
                  key={k}
                  label={k}
                  o={["OK", "Issue", "N/A"]}
                  value={f.chk[k]}
                  onChange={(e) =>
                    setF({ ...f, chk: { ...f.chk, [k]: e.target.value } })
                  }
                />
              ))}
            </div>
            <label className="mt-3 flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!f.ack}
                onChange={(e) => setF({ ...f, ack: e.target.checked })}
              />
              Customer confirmed this condition and accepts it
            </label>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Btn>Checkout</Btn>
          </div>
        </form>
      </Card>
      {slip && (
        <Gate
          title="Ticket created"
          sub={slip.title}
          slip={slip}
          onClose={() => nav("/staff/repairs")}
        />
      )}
    </Page>
  );
}
