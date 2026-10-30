import { useState } from "react";
import { useDB, save, update, code, day } from "../db";
import { Card, Btn, In, Sel, Tag, Scan, Page } from "../ui";
const CS = ["Open", "Sent to supplier", "Replaced", "Credited", "Rejected"];
export default function Claims() {
  const d = useDB(),
    [u, setU] = useState(null),
    [issue, setIssue] = useState("");
  const look = (s) => setU(d.unit.find((x) => x.serial === s) || { none: s });
  const item = u && d.item.find((i) => i.id === u.itemId),
    sale = u && d.sale.find((s) => s.id === u.saleId),
    ok = u && u.until && u.until >= day();
  const open = async () => {
    await save("claim", {
      code: await code("WC"),
      serial: u.serial,
      itemId: u.itemId,
      saleId: u.saleId,
      issue,
      status: "Open",
      date: Date.now(),
    });
    setIssue("");
    setU(null);
  };
  return (
    <Page title="Warranty claims">
      <Card className="space-y-3">
        <Scan onScan={look} label="Scan or type the IMEI / serial number" />
        {u &&
          (u.none ? (
            <p className="text-slate-500">
              No unit with serial {u.none} in our records.
            </p>
          ) : (
            <div className="space-y-2">
              <div>
                <b>{item?.name}</b>{" "}
                <span className="font-mono text-sm">S/N {u.serial}</span>
              </div>
              {u.status === "sold" ? (
                <>
                  <div className="text-sm text-slate-500">
                    Sold {new Date(u.soldDate).toLocaleDateString()} ·{" "}
                    {sale?.name} {sale?.phone} · receipt {sale?.code}
                  </div>
                  <Tag c={ok ? "ok" : "bad"}>
                    {u.until
                      ? ok
                        ? "Under warranty until " + u.until
                        : "Warranty ended " + u.until
                      : "No warranty"}
                  </Tag>
                  {ok && (
                    <div className="flex items-end gap-2">
                      <In
                        cls="flex-1"
                        label="Fault description"
                        value={issue}
                        onChange={(e) => setIssue(e.target.value)}
                      />
                      <Btn disabled={!issue} onClick={open}>
                        Open claim
                      </Btn>
                    </div>
                  )}
                </>
              ) : (
                <Tag>Still in stock, never sold</Tag>
              )}
            </div>
          ))}
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        {d.claim
          .slice()
          .reverse()
          .map((c) => (
            <Card key={c.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <b className="font-mono">{c.code}</b>
                <Tag
                  c={
                    c.status === "Open"
                      ? "warn"
                      : c.status === "Rejected"
                        ? "bad"
                        : "ok"
                  }
                >
                  {c.status}
                </Tag>
              </div>
              <div className="text-sm text-slate-500">
                S/N {c.serial} · {c.issue}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Sel
                  label="Status"
                  o={CS}
                  value={c.status}
                  onChange={(e) =>
                    save("claim", { ...c, status: e.target.value })
                  }
                />
                <In
                  label="Supplier"
                  value={c.supplier || ""}
                  onChange={(e) =>
                    save("claim", { ...c, supplier: e.target.value })
                  }
                />
                <In
                  label="Supplier ref"
                  value={c.sref || ""}
                  onChange={(e) =>
                    save("claim", { ...c, sref: e.target.value })
                  }
                />
              </div>
              <label className="block text-xs font-semibold text-slate-500">
                Fault description
                <textarea
                  rows={2}
                  defaultValue={c.issue || ""}
                  onBlur={(e) =>
                    e.target.value !== (c.issue || "") &&
                    update("claim", c.id, { issue: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-400/30 bg-white/50 px-3 py-2 text-sm dark:bg-white/5"
                />
              </label>
            </Card>
          ))}
      </div>
    </Page>
  );
}
