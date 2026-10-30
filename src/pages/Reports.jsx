import { useState } from "react";
import { useDB, save, mn, day } from "../db";
import { Card, Btn, In, Sel, Tag, can, useUser, Page } from "../ui";
export default function Reports() {
  const d = useDB(),
    u = useUser(),
    [m, setM] = useState(day().slice(0, 7)),
    [e, setE] = useState({ kind: "Variable", date: day() }),
    inM = (t) => t && day(t).slice(0, 7) === m;
  const ss = d.sale.filter((s) => !s.void && inM(s.date)),
    sr = ss.reduce((a, s) => a + s.total, 0),
    sp =
      sr -
      ss.reduce(
        (a, s) => a + s.lines.reduce((x, l) => x + (l.cost || 0) * l.q, 0),
        0,
      );
  const rs = d.ticket.filter((t) => inM(t.done)),
    rr = rs.reduce((a, t) => a + t.cost, 0),
    rp = rr - rs.reduce((a, t) => a + (t.pcost || 0), 0);
  const ex = d.exp.filter((x) =>
      x.kind === "Fixed"
        ? x.date.slice(0, 7) <= m && (!x.stop || x.stop.slice(0, 7) >= m)
        : x.date.slice(0, 7) === m,
    ),
    fx = ex.filter((x) => x.kind === "Fixed").reduce((a, x) => a + x.amt, 0),
    vx = ex.filter((x) => x.kind !== "Fixed").reduce((a, x) => a + x.amt, 0),
    pf = can(u, "profit");
  const K = (a, b, c) => (
    <Card>
      <div className="text-sm text-slate-500">{a}</div>
      <div className="text-2xl font-extrabold">{mn(b)}</div>
      <div className="text-xs text-slate-500">{c}</div>
    </Card>
  );
  return (
    <Page
      title="Reports"
      right={
        <input
          type="month"
          value={m}
          onChange={(x) => setM(x.target.value)}
          className="rounded-xl border border-slate-400/30 bg-transparent px-3 py-2"
        />
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {K("Selling revenue", sr, pf ? "profit " + mn(sp) : "")}
        {K("Repair revenue", rr, pf ? "profit " + mn(rp) : "")}
        {K("Fixed expenses", fx, "monthly")}
        {K("Variable expenses", vx, "this month")}
        {pf ? (
          K("Net profit", sp + rp - fx - vx, "after expenses")
        ) : (
          <Card>
            <div className="text-sm text-slate-500">Net profit</div>
            <Tag>Master only</Tag>
          </Card>
        )}
      </div>
      <Card>
        <h2 className="mb-3 font-bold">Add expense</h2>
        <div className="grid gap-2 sm:grid-cols-5">
          <In
            label="What for"
            value={e.name || ""}
            onChange={(x) => setE({ ...e, name: x.target.value })}
          />
          <In
            label="Amount"
            type="number"
            value={e.amt || ""}
            onChange={(x) => setE({ ...e, amt: +x.target.value })}
          />
          <Sel
            label="Type"
            o={["Fixed", "Variable"]}
            value={e.kind}
            onChange={(x) => setE({ ...e, kind: x.target.value })}
          />
          <In
            label="Date"
            type="date"
            value={e.date}
            onChange={(x) => setE({ ...e, date: x.target.value })}
          />
          <Btn
            className="self-end"
            onClick={async () => {
              await save("exp", e);
              setE({ kind: "Variable", date: day() });
            }}
          >
            Add
          </Btn>
        </div>
      </Card>
      <Card>
        {ex.map((x) => (
          <div
            key={x.id}
            className="flex items-center gap-3 border-t border-slate-400/20 py-2 text-sm first:border-0"
          >
            <span className="flex-1">{x.name}</span>
            <Tag>{x.kind}</Tag>
            <span>{mn(x.amt)}</span>
            {can(u, "delete") && (
              <button
                onClick={() =>
                  confirm("Delete expense?") && save("exp", { ...x, del: true })
                }
              >
                🗑
              </button>
            )}
          </div>
        ))}
        {!ex.length && (
          <p className="text-slate-500">No expenses this month.</p>
        )}
      </Card>
    </Page>
  );
}
