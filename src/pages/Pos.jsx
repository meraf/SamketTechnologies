import { useState } from "react";
import {
  useDB,
  save,
  stock,
  code,
  mn,
  addD,
  upCust,
  normPhone,
  alertStaff,
} from "../db";
import { Card, Btn, In, Sel, Tag, Scan, Gate, saleSlip, Page } from "../ui";
const E = { n: "", p: "", d: 0, m: "Cash" };
// One cart, one receipt. A cart line is either
//  - a tracked unit (picked from stock, its serial is fixed, qty 1), or
//  - an untracked item with a quantity: Qty 3 shows "Serial Number #1..#3" so every unit gets its own serial.
const fit = (a, n) => Array.from({ length: n }, (_, i) => a[i] || "");
export default function Pos() {
  const d = useDB(),
    [q, setQ] = useState(""),
    [cart, setCart] = useState([]),
    [c, setC] = useState(E),
    [pick, setPick] = useState(null),
    [sel, setSel] = useState([]),
    [done, setDone] = useState(null),
    [busy, setBusy] = useState(false);
  const items = d.item.filter((i) =>
    (i.name + i.cat).toLowerCase().includes(q.toLowerCase()),
  );
  const free = (i) =>
    d.unit.filter(
      (u) =>
        u.itemId === i.id &&
        u.status === "in_stock" &&
        !cart.some((l) => l.serial === u.serial),
    );
  const line = (i, u) => ({
    k: Math.random(),
    itemId: i.id,
    name: i.name,
    serial: u && u.serial,
    cost: u ? u.cost : i.cost,
    base: i.price,
    price: i.price,
    war: i.war || 0,
    q: 1,
    imeis: [""],
    tag: u && u.tag,
  });
  const addMany = (i, us) => {
    setCart((c) => [...c, ...(us.length ? us : [null]).map((u) => line(i, u))]);
    setPick(null);
    setSel([]);
  };
  const click = (i) =>
    i.ser
      ? (setSel([]), setPick(i))
      : (stock(d, i) <= 0 && !confirm("No stock recorded. Add anyway?")) ||
        addMany(i, []);
  const scan = (s) => {
    const u = d.unit.find((x) => x.serial === s && x.status === "in_stock");
    u
      ? cart.some((l) => l.serial === s)
        ? alert("Already in the cart.")
        : addMany(
            d.item.find((i) => i.id === u.itemId),
            [u],
          )
      : alert("That serial is not in stock.");
  };
  const up = (k, p) =>
    setCart(cart.map((l) => (l.k === k ? { ...l, ...p } : l)));
  const setQty = (l, v) => {
    const n = Math.min(200, Math.max(1, Math.floor(+v) || 1));
    up(l.k, { q: n, imeis: fit(l.imeis, n) });
  };
  const setSn = (l, i, v) =>
    up(l.k, { imeis: fit(l.imeis, l.q).map((x, j) => (j === i ? v : x)) });
  const all = cart.flatMap((l) =>
    l.serial ? [l.serial] : l.imeis.map((x) => x.trim()).filter(Boolean),
  );
  const dup = all.filter((x, i) => all.indexOf(x) !== i);
  const units = cart.reduce((a, l) => a + l.q, 0);
  const total = Math.max(
    0,
    cart.reduce((a, l) => a + l.price * l.q, 0) - (+c.d || 0),
  );
  const known =
    c.p && normPhone(c.p).length >= 9
      ? d.cust.find((x) => normPhone(x.phone) === normPhone(c.p))
      : null;
  const setPhone = (p) => {
    const k =
      normPhone(p).length >= 9 &&
      d.cust.find((x) => normPhone(x.phone) === normPhone(p));
    setC({ ...c, p, n: c.n || (k && k.name) || "" });
  };
  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const cid = await upCust(c.n, c.p),
        L = cart.map(({ imeis, ...l }) => {
          const im = l.serial ? [] : imeis.map((x) => x.trim()).filter(Boolean);
          return {
            ...l,
            imeis: im,
            imei: im.join(", "),
            until: l.war > 0 ? addD(l.war) : "",
          };
        });
      const s = await save("sale", {
        code: await code("SL"),
        custId: cid,
        name: c.n,
        phone: c.p,
        lines: L,
        total,
        disc: +c.d || 0,
        pay: c.m,
        date: Date.now(),
      });
      for (const l of L)
        if (l.serial) {
          const u = d.unit.find((x) => x.serial === l.serial);
          await save("unit", {
            ...u,
            status: "sold",
            soldDate: Date.now(),
            saleId: s.id,
            until: l.until,
          });
        } else await save("move", { item: l.itemId, q: -l.q, ref: s.id });
      alertStaff(
        `Sale ${s.code}: ${mn(total)} (${c.m}) · ${L.reduce((a, l) => a + l.q, 0)} item(s)${c.n ? " · " + c.n : ""}`,
      );
      setCart([]);
      setC(E);
      setDone(s);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page title="Sell">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card>
            <Scan onScan={scan} />
          </Card>
          <In
            label="Search items"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((i) => {
              const n = stock(d, i);
              return (
                <button
                  key={i.id}
                  onClick={() => click(i)}
                  className="rounded-2xl border border-white/30 bg-white/60 p-4 text-left shadow transition hover:-translate-y-1 hover:shadow-xl active:scale-95 dark:border-white/10 dark:bg-white/5"
                >
                  <b className="block">{i.name}</b>
                  <span className="text-sm text-slate-500">{mn(i.price)}</span>
                  <div className="mt-1 flex gap-1">
                    <Tag c={n <= (i.min || 0) ? "bad" : "ok"}>{n} in stock</Tag>
                    {i.ser && <Tag>S/N</Tag>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <Card className="h-fit space-y-3">
          <div className="flex items-center">
            <h2 className="flex-1 text-xl font-bold">Cart</h2>
            {!!cart.length && (
              <>
                <Tag>
                  {units} item{units === 1 ? "" : "s"}
                </Tag>
                <button
                  className="ml-2 text-xs text-slate-500 underline"
                  onClick={() => confirm("Empty the cart?") && setCart([])}
                >
                  Clear
                </button>
              </>
            )}
          </div>
          {cart.map((l) => {
            const n = l.serial ? 0 : l.imeis.filter((x) => x.trim()).length;
            return (
              <div
                key={l.k}
                className="space-y-2 border-b border-slate-400/20 pb-3"
              >
                <div className="flex items-center">
                  <b className="flex-1">
                    {l.name}
                    {l.serial && (
                      <span className="block font-mono text-xs font-normal text-slate-500">
                        S/N {l.serial}
                      </span>
                    )}
                  </b>
                  <button
                    aria-label="Remove"
                    onClick={() => setCart(cart.filter((x) => x.k !== l.k))}
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {!l.serial && (
                    <In
                      label="Qty"
                      type="number"
                      min="1"
                      value={l.q}
                      onChange={(e) => setQty(l, e.target.value)}
                    />
                  )}
                  <In
                    label="Unit price"
                    type="number"
                    placeholder={l.base}
                    value={l.price !== l.base ? l.price : ""}
                    onChange={(e) =>
                      up(l.k, { price: +e.target.value || l.base })
                    }
                  />
                  <In
                    label="Warranty days"
                    type="number"
                    min="0"
                    value={l.war}
                    onChange={(e) => up(l.k, { war: +e.target.value || 0 })}
                  />
                </div>
                {!l.serial && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-500">
                      IMEI / serial numbers (optional)
                      {l.q > 1 && (
                        <span className="ml-1 font-normal">
                          · {n} of {l.q} entered
                        </span>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {fit(l.imeis, l.q).map((v, i) => (
                        <In
                          key={i}
                          label={`Serial Number #${i + 1}`}
                          placeholder="Scan or type"
                          value={v}
                          onChange={(e) => setSn(l, i, e.target.value)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-right text-sm text-slate-500">
                  {l.q} × {mn(l.price)} = <b>{mn(l.q * l.price)}</b>
                </div>
              </div>
            );
          })}
          {!cart.length && (
            <p className="text-slate-500">
              Scan or tap items to build one sale. Quantity above 1 gives each
              unit its own serial number field, and everything prints on one
              receipt.
            </p>
          )}
          {!!dup.length && (
            <p className="rounded-xl bg-red-500/10 p-2 text-sm text-red-600 dark:text-red-400">
              Duplicate serial number: {[...new Set(dup)].join(", ")}
            </p>
          )}
          <In
            label="Phone"
            type="tel"
            value={c.p}
            onChange={(e) => setPhone(e.target.value)}
          />
          {known && (
            <p className="-mt-1 text-xs text-emerald-600 dark:text-emerald-400">
              Existing customer ({known.name || "no name"}): this sale is added
              to their history.
            </p>
          )}
          <In
            label="Customer"
            value={c.n}
            onChange={(e) => setC({ ...c, n: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <In
              label="Discount"
              type="number"
              min="0"
              value={c.d || ""}
              onChange={(e) => setC({ ...c, d: e.target.value })}
            />
            <Sel
              label="Payment"
              o={["Cash", "Bank transfer", "Telebirr", "CBE Birr"]}
              value={c.m}
              onChange={(e) => setC({ ...c, m: e.target.value })}
            />
          </div>
          <div className="text-3xl font-extrabold tracking-tight">
            {mn(total)}
          </div>
          <Btn
            className="w-full"
            disabled={!cart.length || !!dup.length || busy}
            onClick={finish}
          >
            Checkout{units > 1 ? ` · ${units} items` : ""}
          </Btn>
        </Card>
      </div>
      {pick && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="max-h-[80vh] w-full max-w-sm overflow-auto !bg-white dark:!bg-slate-900">
            <h3 className="mb-1 font-bold">Pick units of {pick.name}</h3>
            <p className="mb-3 text-xs text-slate-500">
              Tick every unit being sold. Each keeps its own serial number and
              warranty.
            </p>
            {free(pick).map((u) => {
              const on = sel.includes(u.id);
              return (
                <label
                  key={u.id}
                  className={`mb-2 flex cursor-pointer items-center gap-3 rounded-xl border p-3 font-mono text-sm transition ${on ? "border-orange-500 bg-orange-500/10" : "border-slate-400/30 hover:bg-orange-500/5"}`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setSel(
                        on ? sel.filter((x) => x !== u.id) : [...sel, u.id],
                      )
                    }
                  />
                  {u.serial}
                </label>
              );
            })}
            {!free(pick).length && (
              <p className="text-slate-500">No units in stock.</p>
            )}
            <div className="mt-3 flex gap-2">
              <Btn
                disabled={!sel.length}
                onClick={() =>
                  addMany(
                    pick,
                    free(pick).filter((u) => sel.includes(u.id)),
                  )
                }
              >
                Add {sel.length || ""} to cart
              </Btn>
              <Btn v="g" onClick={() => setPick(null)}>
                Cancel
              </Btn>
            </div>
          </Card>
        </div>
      )}
      {done && (
        <Gate
          title="Sale complete"
          sub={`${done.code} · ${mn(done.total)}`}
          slip={saleSlip(done)}
          onClose={() => setDone(null)}
        />
      )}
    </Page>
  );
}
