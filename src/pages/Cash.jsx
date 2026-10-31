import { useState } from "react";
import { useDB, save, mn, day } from "../db";
import { Card, Btn, In, Sel, Tag, useUser, Page } from "../ui";
import { BANKS } from "../bankpay";

const TABS = ["Cash", "Transaction", "All"],
  SORTS = {
    Cash: ["Amount"],
    Transaction: ["Bank name", "Date", "Amount"],
    All: ["Date", "Amount", "Bank / type"],
  };
export default function Cash() {
  const d = useDB(),
    u = useUser(),
    [f, b, setF] = useF0(),
    [tab, setTab] = useState("Cash"),
    [sk, setSk] = useState({}),
    [dir, setDir] = useState("desc"),
    [bf, setBf] = useState("All banks"),
    [ba, setBa] = useState({ bank: BANKS[0][0] }),
    t0 = day();
  // One row per payment: retail sales and confirmed B2B payments. "Cash" = money in the drawer, everything else = bank / wallet.
  const rows = [
    ...d.sale
      .filter((s) => !s.void)
      .map((s) => ({
        id: s.id,
        kind: s.pay === "Cash" ? "Cash" : "Transaction",
        date: s.date,
        amt: +s.total || 0,
        bank: s.pay === "Cash" ? "Cash" : s.bank || s.pay,
        ref: s.txRef || "",
        ver: s.pay === "Cash" ? "" : s.verify ? s.verify.status : "unverified",
        label: "Sale " + s.code,
        who: s.name || "",
      })),
    ...d.b2bpay.map((p) => ({
      id: p.id,
      kind: p.method === "Cash" ? "Cash" : "Transaction",
      date: p.date,
      amt: +p.amount || 0,
      bank: p.method === "Cash" ? "Cash" : p.method,
      ref: p.ref || "",
      ver: "",
      label: "B2B " + (p.rc || ""),
      who: p.company || "",
    })),
  ];
  const keys = SORTS[tab],
    key = keys.includes(sk[tab]) ? sk[tab] : keys[0],
    banks = [...new Set(rows.filter((r) => r.kind === "Transaction").map((r) => r.bank))].sort(),
    shown = rows
      .filter(
        (r) =>
          (tab === "All" || r.kind === tab) &&
          (tab === "Cash" || bf === "All banks" || r.bank === bf),
      )
      .sort((x, y) => {
        const c =
          key === "Amount"
            ? x.amt - y.amt
            : key === "Date"
              ? x.date - y.date
              : String(x.bank).localeCompare(String(y.bank)) || x.date - y.date;
        return dir === "asc" ? c : -c;
      }),
    shownTotal = shown.reduce((a, r) => a + r.amt, 0);
  const addAcct = async () => {
    const bank = ba.bank === "Other" ? (ba.other || "").trim() : ba.bank;
    if (!bank || !(ba.number || "").trim() || !(ba.holder || "").trim())
      return alert("Enter the bank name, account number and account holder name.");
    await save("bankacct", {
      bank,
      number: ba.number.trim(),
      holder: ba.holder.trim(),
    });
    setBa({ bank: ba.bank });
  };
  const sales = d.sale
      .filter((s) => !s.void && s.pay === "Cash" && day(s.date) === t0)
      .reduce((a, s) => a + s.total, 0),
    rep = d.ticket
      .filter(
        (t) =>
          (t.status === "Delivered" || t.status === "Unfixed") &&
          t.done &&
          day(t.done) === t0,
      )
      .reduce((a, t) => a + t.cost, 0),
    pay = d.payout.filter((p) => day(p.date) === t0);
  const out = pay.reduce((a, p) => a + p.amt, 0),
    exp = (+f.float || 0) + sales + rep - out,
    diff = (+f.count || 0) - exp,
    closed = d.close.find((c) => c.day === t0);
  return (
    <Page title="Cash & transactions">
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full px-5 py-2 text-sm font-bold transition ${tab === t ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-500/10 hover:bg-slate-500/20"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <Card className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Sel
            label="Sort by"
            o={keys}
            value={key}
            onChange={(e) => setSk({ ...sk, [tab]: e.target.value })}
          />
          <Sel
            label="Order"
            o={["desc", "asc"]}
            value={dir}
            onChange={(e) => setDir(e.target.value)}
          />
          {tab !== "Cash" && (
            <Sel
              label="Bank"
              o={["All banks", ...banks]}
              value={bf}
              onChange={(e) => setBf(e.target.value)}
            />
          )}
          <span className="flex-1" />
          <b>
            {shown.length} payment(s) · {mn(shownTotal)}
          </b>
        </div>
        {shown.slice(0, 200).map((r) => (
          <div
            key={r.kind + r.id}
            className="flex flex-wrap items-center gap-2 border-t border-slate-400/20 pt-2 text-sm"
          >
            <span className="w-36 text-slate-500">
              {new Date(r.date).toLocaleString()}
            </span>
            <b className="min-w-0 flex-1 truncate">
              {r.label}
              {r.who && <span className="font-normal text-slate-500"> · {r.who}</span>}
            </b>
            <span className="text-slate-500">
              {r.bank}
              {r.ref ? ` · ${r.ref}` : ""}
            </span>
            {r.ver && (
              <Tag c={r.ver === "verified" ? "ok" : r.ver === "failed" ? "bad" : "slate"}>
                {r.ver === "verified"
                  ? "Verified"
                  : r.ver === "failed"
                    ? "Verification failed"
                    : "Not verified"}
              </Tag>
            )}
            <b className="w-28 text-right">{mn(r.amt)}</b>
          </div>
        ))}
        {!shown.length && <p className="text-slate-500">No payments here yet.</p>}
      </Card>
      {tab !== "Cash" && (
        <Card className="space-y-3">
          <h2 className="font-bold">Store bank accounts</h2>
          <p className="text-sm text-slate-500">
            Used to check the receiver name when a customer pays by bank transfer.
          </p>
          {d.bankacct.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-t border-slate-400/20 pt-2 text-sm">
              <b className="flex-1">
                {a.bank} · {a.number}
                <span className="block font-normal text-slate-500">{a.holder}</span>
              </b>
              <button
                className="text-xs text-red-500 underline"
                onClick={() =>
                  confirm(`Remove ${a.bank} ${a.number}?`) &&
                  save("bankacct", { ...a, del: true })
                }
              >
                Remove
              </button>
            </div>
          ))}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Sel
              label="Bank name"
              o={BANKS.map((x) => x[0])}
              value={ba.bank}
              onChange={(e) => setBa({ ...ba, bank: e.target.value })}
            />
            {ba.bank === "Other" && (
              <In
                label="Other bank name"
                value={ba.other || ""}
                onChange={(e) => setBa({ ...ba, other: e.target.value })}
              />
            )}
            <In
              label="Account number"
              value={ba.number || ""}
              onChange={(e) => setBa({ ...ba, number: e.target.value })}
            />
            <In
              label="Account holder name"
              value={ba.holder || ""}
              onChange={(e) => setBa({ ...ba, holder: e.target.value })}
            />
          </div>
          <Btn onClick={addAcct}>Add account</Btn>
        </Card>
      )}
      {tab !== "Transaction" && (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="font-bold">Today ({t0})</h2>
          <p>Cash sales: {mn(sales)}</p>
          <p>Repairs delivered: {mn(rep)}</p>
          <p>Payouts: −{mn(out)}</p>
          {pay.map((p) => (
            <p key={p.id} className="text-sm text-slate-500">
              {p.note}: {mn(p.amt)}
            </p>
          ))}
          <div className="flex items-end gap-2">
            <In cls="flex-1" label="Payout note" {...b("pn")} />
            <In cls="w-28" label="Amount" type="number" {...b("pa")} />
            <Btn
              onClick={async () => {
                await save("payout", {
                  note: f.pn,
                  amt: +f.pa || 0,
                  date: Date.now(),
                  by: u.role,
                });
                setF({ ...f, pn: "", pa: "" });
              }}
            >
              Add
            </Btn>
          </div>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">End of day count</h2>
          {closed ? (
            <>
              <Tag c={closed.diff ? "warn" : "ok"}>
                Closed ·{" "}
                {closed.diff ? `difference ${mn(closed.diff)}` : "balanced"}
              </Tag>
              <p className="text-sm text-slate-500">
                Expected {mn(closed.exp)} · counted {mn(closed.count)} · by{" "}
                {closed.by}
              </p>
            </>
          ) : (
            <>
              <In label="Opening float" type="number" {...b("float")} />
              <In
                label="Counted cash in drawer"
                type="number"
                {...b("count")}
              />
              <p>
                Expected: <b>{mn(exp)}</b>
              </p>
              <Tag c={diff ? "warn" : "ok"}>
                {diff ? `Difference ${mn(diff)}` : "Balanced"}
              </Tag>
              <In label="Note on any difference" {...b("note")} />
              <Btn
                onClick={() =>
                  confirm("Close the day?") &&
                  save("close", {
                    day: t0,
                    exp,
                    count: +f.count || 0,
                    diff,
                    float: +f.float || 0,
                    note: f.note || "",
                    by: u.role,
                  })
                }
              >
                Close the day
              </Btn>
            </>
          )}
        </Card>
      </div>
      )}
      {tab !== "Transaction" && (
      <Card>
        <h2 className="mb-2 font-bold">Past closings</h2>
        {d.close
          .slice()
          .reverse()
          .map((c) => (
            <div
              key={c.id}
              className="flex gap-3 border-t border-slate-400/20 py-2 text-sm"
            >
              <span>{c.day}</span>
              <span className="flex-1">
                expected {mn(c.exp)} · counted {mn(c.count)}
              </span>
              <Tag c={c.diff ? "warn" : "ok"}>{c.diff ? mn(c.diff) : "ok"}</Tag>
            </div>
          ))}
      </Card>
      )}
    </Page>
  );
}
import { useState as us } from "react";
function useF0() {
  const [f, setF] = us({});
  return [
    f,
    (k) => ({
      value: f[k] ?? "",
      onChange: (e) => setF((x) => ({ ...x, [k]: e.target.value })),
    }),
    setF,
  ];
}
