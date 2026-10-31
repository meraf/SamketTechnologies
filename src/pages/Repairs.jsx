import { useState } from "react";
import { Link } from "react-router-dom";
import {
  matchQ,
  useRemoteSearch,
  useDB,
  save,
  update,
  mn,
  notify,
  upCust,
  normPhone,
} from "../db";
import {
  Card,
  Btn,
  In,
  Gate,
  Timeline,
  STATUSES,
  UNFIXED,
  StatusTag,
  EditModal,
  Page,
  useUser,
  can,
} from "../ui";
import { ps } from "./NewTicket";
const U = STATUSES.indexOf(UNFIXED); // 5
const fields = (pf) => [
  { k: "name", label: "Customer *", req: true },
  { k: "phone", label: "Phone *", type: "tel", req: true },
  { k: "email", label: "Email", type: "email" },
  {
    k: "dtype",
    label: "Device type",
    o: ["Phone", "Laptop", "Desktop", "Tablet", "Modem", "Other"],
  },
  { k: "device", label: "Brand and model" },
  { k: "imei", label: "IMEI / serial" },
  { k: "issue", label: "Problem *", type: "textarea", req: true },
  { k: "status", label: "Status", o: STATUSES },
  { k: "cost", label: "Repair price (ETB)", type: "number" },
  ...(pf ? [{ k: "pcost", label: "Parts cost (ETB)", type: "number" }] : []),
  { k: "war", label: "Warranty (days)", type: "number" },
  {
    k: "work",
    label: "Work done / notes (customer sees this)",
    type: "textarea",
  },
  {
    k: "why",
    label: "Why it could not be fixed (customer sees this when Unfixed)",
    type: "textarea",
  },
];
export default function Repairs() {
  const d = useDB(),
    u = useUser(),
    pf = can(u, "profit"),
    [q, setQ] = useState(""),
    [slip, setSlip] = useState(null),
    [m, setM] = useState(null),
    [v, setV] = useState({}),
    [err, setErr] = useState(""),
    [ed, setEd] = useState(null),
    [sortBy, setSortBy] = useState("date"),
    [sortDir, setSortDir] = useState("desc");
  useRemoteSearch(q);
  // move a ticket to status i; history keeps one entry per step passed
  const apply = async (t, i, x = {}) => {
    const now = Date.now(),
      cur = STATUSES.indexOf(t.status),
      hist = [...(t.hist || [])];
    if (i === U || cur === U) hist.push({ s: STATUSES[i], t: now });
    else
      for (let k = cur + 1; k <= i; k++) hist.push({ s: STATUSES[k], t: now });
    const nt = await save("ticket", {
      ...t,
      ...x,
      status: STATUSES[i],
      hist,
      done: i >= 3 ? now : null,
    });
    notify(nt, STATUSES[i]);
    return nt;
  };
  // Tear-away stub exists ONLY at step 1 (Received): ticket received from the website, or created by staff.
  const step = (t, i) => {
    const cur = STATUSES.indexOf(t.status);
    if (i === cur) return;
    // Client-created ticket (Requested) -> staff click "Received": print it WITH the tear-away stub (step 1 only).
    if (t.status === "Requested" && i === 0)
      return apply(t, 0).then((nt) => setSlip(ps(nt, true)));
    if (!(i >= 3 && (cur === U || i > cur))) return apply(t, i); // going back, or to steps 1-3: no questions
    setErr("");
    setV({
      cost: t.cost > 0 ? t.cost : "",
      pcost: t.cost > 0 && t.pcost != null ? t.pcost : "",
      war: t.war > 0 ? t.war : "",
      why: t.why || "",
    });
    setM({ t, i });
  };
  // Jumping ahead (e.g. step 1 -> 5) must still capture what steps 4 and 5 normally record.
  const cur = m ? STATUSES.indexOf(m.t.status) : 0,
    fresh = !!m && (cur < 3 || cur === U); // step 4 (Ready) details not recorded yet
  const unf = !!m && m.i === U,
    askP = !!m && (unf || (m.i >= 3 && fresh) || !(m.t.cost > 0)),
    askW = !!m && m.i === 4,
    skipped = !!m && !unf && m.i === 4 && fresh;
  const bad = (x) => x === "" || x == null || isNaN(+x) || +x < 0;
  const ok = async () => {
    if (askP && bad(v.cost))
      return setErr(
        unf
          ? "Enter the diagnosis fee (0 if none)."
          : "Enter the repair price (0 or more).",
      );
    if (askP && !unf && bad(v.pcost))
      return setErr("Enter the parts cost (0 if no parts were used).");
    if (askW && bad(v.war))
      return setErr("Enter the warranty in days (0 = no warranty).");
    if (unf && !String(v.why || "").trim())
      return setErr("Say briefly why the device could not be fixed.");
    const x = {
      cost: askP ? +v.cost : m.t.cost,
      pcost: askP ? +v.pcost || 0 : m.t.pcost,
      war: askW ? +v.war : unf ? 0 : m.t.war,
    };
    if (unf) x.why = String(v.why).trim();
    const nt = await apply(m.t, m.i, x);
    setM(null);
    if (m.i >= 4) setSlip(ps(nt));
  };
  const set = (k) => (e) => {
    setErr("");
    setV({ ...v, [k]: e.target.value });
  };
  const saveEdit = async (f) => {
    const t = ed,
      { status, ...patch } = f;
    if (!pf) delete patch.pcost;
    if (f.name !== t.name || normPhone(f.phone) !== normPhone(t.phone))
      patch.custId = await upCust(f.name, f.phone); // keep the customer history linked
    if (status !== t.status) await apply(t, STATUSES.indexOf(status), patch);
    else await update("ticket", t.id, patch);
  };
  const when = (t) => +t.date || +t.ts || 0,
    // time of day (minutes since midnight) the ticket was logged
    tod = (t) => {
      const x = new Date(when(t));
      return x.getHours() * 60 + x.getMinutes();
    },
    rank = (t) => {
      const i = STATUSES.indexOf(t.status);
      return i < 0 ? -1 : i; // "Requested" (website) first, then Received ... Delivered, Unfixed
    };
  const L = d.ticket
    .filter((t) => matchQ(t, q))
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      let r;
      if (sortBy === "status") r = rank(a) - rank(b) || when(b) - when(a);
      else if (sortBy === "time") r = tod(a) - tod(b) || when(a) - when(b);
      else r = when(a) - when(b);
      return r * dir;
    });
  return (
    <Page
      title="Repair tickets"
      right={
        <Link to="/staff/repairs/new">
          <Btn>+ New ticket</Btn>
        </Link>
      }
    >
      <>
        <In
          label="Search by customer name, phone number or ticket code"
          type="search"
          placeholder="e.g. Abebe, 0924598198, SKT-9K2P8X"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-xs font-semibold text-slate-500">
            Sort by
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="mt-1 rounded-xl border border-slate-400/30 bg-white/50 px-3 py-2 text-sm outline-none dark:bg-white/5"
            >
              <option value="date">Date</option>
              <option value="status">Status</option>
              <option value="time">Time (of day)</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            className="rounded-xl border border-slate-400/30 px-3 py-2 text-sm font-bold hover:bg-slate-500/10"
          >
            {sortDir === "asc"
              ? sortBy === "date" || sortBy === "time"
                ? "↑ Oldest first"
                : "↑ First step first"
              : sortBy === "date" || sortBy === "time"
                ? "↓ Newest first"
                : "↓ Last step first"}
          </button>
          {q && (
            <span className="pb-2 text-sm text-slate-500">{L.length} ticket(s) found</span>
          )}
        </div>
      </>
      <div className="grid gap-3 lg:grid-cols-2">
        {L.map((t) => (
          <Card key={t.id} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <b className="font-mono">{t.code}</b>
              <StatusTag s={t.status} />
              {t.doa && <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">DOA</span>}
              <span className="text-xs text-slate-400">
                {new Date(when(t)).toLocaleDateString()}{" "}
                {new Date(when(t)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="flex-1" />
              <span className="text-sm">{mn(t.cost)}</span>
            </div>
            <div className="break-words text-sm text-slate-500">
              {t.name} · {t.phone} · {t.device} {t.imei}
              <br />
              {t.issue}
            </div>
            {t.status === UNFIXED && t.why && (
              <p className="rounded-xl bg-red-500/10 p-2 text-sm text-red-600 dark:text-red-400">
                <b>Not repaired:</b> {t.why}
              </p>
            )}
            <Timeline
              status={t.status}
              hist={t.hist}
              onStep={(i) => step(t, i)}
            />
            <p className="text-center text-[11px] text-slate-400">
              Tap a step to move the repair there. The red ✕ marks a device that
              could not be fixed.
            </p>
            <label className="block text-xs font-semibold text-slate-500">
              Work done / notes (customer sees this)
              <textarea
                rows={2}
                defaultValue={t.work || ""}
                onBlur={(e) =>
                  e.target.value !== (t.work || "") &&
                  update("ticket", t.id, { work: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-400/30 bg-white/50 px-3 py-2 text-sm dark:bg-white/5"
              />
            </label>
            <div className="flex gap-2">
              <Btn v="g" className="!py-1" onClick={() => setEd(t)}>
                ✎ Edit
              </Btn>
              <Btn v="g" className="!py-1" onClick={() => setSlip(ps(t, t.status === "Received"))}>
                Print
              </Btn>
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="mb-2 font-bold">Telegram outbox</h2>
        {d.notif
          .slice(-5)
          .reverse()
          .map((n) => (
            <div key={n.id} className="break-words text-sm text-slate-500">
              📨 {n.to}: {n.text}
            </div>
          ))}
        {!d.notif.length && (
          <p className="text-sm text-slate-500">
            Status changes message the customer once they link the bot from the
            tracking page.
          </p>
        )}
      </Card>
      {m && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3 backdrop-blur-sm">
          <Card className="w-full max-w-sm space-y-3 !bg-white dark:!bg-slate-900">
            <h3 className="font-bold">
              {unf
                ? "Unfixed: could not be repaired"
                : `Step ${m.i + 1}: ${STATUSES[m.i]}`}
            </h3>
            {skipped && (
              <p className="rounded-xl bg-amber-500/10 p-2 text-sm text-amber-700 dark:text-amber-400">
                You skipped steps. Before delivering, enter what step 4 (Ready)
                and step 5 (Delivered) record: repair price, parts cost and
                warranty.
              </p>
            )}
            {askP && (
              <div className="grid grid-cols-2 gap-2">
                <In
                  label={
                    unf
                      ? "Diagnosis fee (ETB, 0 if none)"
                      : "Repair price (ETB)"
                  }
                  type="number"
                  min="0"
                  value={v.cost}
                  onChange={set("cost")}
                />
                <In
                  label={
                    unf ? "Parts cost (ETB, optional)" : "Parts cost (ETB) *"
                  }
                  type="number"
                  min="0"
                  value={v.pcost}
                  onChange={set("pcost")}
                />
              </div>
            )}
            {unf && (
              <label className="block text-xs font-semibold text-slate-500">
                Why it could not be fixed (customer sees this) *
                <textarea
                  rows={3}
                  value={v.why}
                  onChange={set("why")}
                  className="mt-1 w-full rounded-xl border border-slate-400/30 bg-white/50 px-3 py-2 text-sm dark:bg-white/5"
                />
              </label>
            )}
            {askW && (
              <In
                label="Warranty days * (type 0 for none)"
                type="number"
                min="0"
                value={v.war}
                onChange={set("war")}
              />
            )}
            {err && <p className="text-sm text-red-500">{err}</p>}
            <div className="flex gap-2">
              <Btn onClick={ok}>
                {m.i === 4
                  ? "Deliver and print receipt"
                  : unf
                    ? "Mark unfixed and print"
                    : "Confirm"}
              </Btn>
              <Btn v="g" onClick={() => setM(null)}>
                Cancel
              </Btn>
            </div>
          </Card>
        </div>
      )}
      {ed && (
        <EditModal
          title={`Edit ${ed.code}`}
          fields={fields(pf)}
          value={ed}
          onSave={saveEdit}
          onClose={() => setEd(null)}
        />
      )}
      {slip && (
        <Gate
          title="Receipt ready"
          sub={slip.title}
          slip={slip}
          onClose={() => setSlip(null)}
        />
      )}
    </Page>
  );
}
