import { useRef, useState } from "react";
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
import {
  Card,
  Btn,
  In,
  Sel,
  Tag,
  Scan,
  Gate,
  saleSlip,
  Page,
  condTag,
} from "../ui";
import { BankPanel, bankFields, bankLabel } from "../bankpay";
const E = { n: "", p: "", d: 0, m: "Cash" },
  BK = { bank: "Telebirr", other: "", ref: "", verify: null };
// One cart, one receipt. A cart line is either
//  - a tracked unit (picked from stock, its serial is fixed, qty 1), or
//  - an untracked item with a quantity: Qty 3 shows "Serial Number #1..#3" so every unit gets its own serial.
const specOf = (u, i) =>
  [
    u.ram || i.ram,
    u.storage || i.storage,
    (u.cond || i.cond) === "Used" && (u.condNote || i.condNote)
      ? `Used: ${u.condNote || i.condNote}`
      : u.cond || i.cond,
  ]
    .filter(Boolean)
    .join(" / ");
const fit = (a, n) => Array.from({ length: n }, (_, i) => a[i] || "");
export default function Pos() {
  const d = useDB(),
    [q, setQ] = useState(""),
    [cart, setCart] = useState([]),
    [c, setC] = useState(E),
    [pick, setPick] = useState(null),
    [sel, setSel] = useState([]),
    [done, setDone] = useState(null),
    [busy, setBusy] = useState(false),
    [bk, setBk] = useState(BK),
    [sortBy, setSortBy] = useState(() => {
      try {
        return localStorage.posSort || "name";
      } catch {
        return "name";
      }
    }),
    [sortDir, setSortDir] = useState(() => {
      try {
        return localStorage.posDir || "asc";
      } catch {
        return "asc";
      }
    }),
    cartRef = useRef();
  const pickSort = (v) => {
    setSortBy(v);
    try {
      localStorage.posSort = v;
    } catch {}
  };
  const pickDir = (v) => {
    setSortDir(v);
    try {
      localStorage.posDir = v;
    } catch {}
  };
  // Sort by name / type (category) / amount (price). Items with 0 stock ALWAYS sit at the bottom, whatever the sort.
  const items = d.item
    .filter((i) => (i.name + i.cat).toLowerCase().includes(q.toLowerCase()))
    .map((i) => ({ i, n: stock(d, i) }))
    .sort((a, b) => {
      const za = a.n <= 0 ? 1 : 0,
        zb = b.n <= 0 ? 1 : 0;
      if (za !== zb) return za - zb;
      const dir = sortDir === "desc" ? -1 : 1,
        nm = String(a.i.name || "").localeCompare(String(b.i.name || ""), undefined, { numeric: true, sensitivity: "base" });
      let r;
      if (sortBy === "type")
        r = String(a.i.cat || "").localeCompare(String(b.i.cat || ""), undefined, { sensitivity: "base" }) || nm;
      else if (sortBy === "amount") r = (+a.i.price || 0) - (+b.i.price || 0) || nm;
      else r = nm;
      return r * dir;
    })
    .map((x) => x.i);
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
    unitId: u && u.id,
    ram: u ? u.ram || i.ram || "" : "",
    storage: u ? u.storage || i.storage || "" : "",
    cond: u ? u.cond || i.cond || "" : "",
    condNote: u ? u.condNote || i.condNote || "" : "",
    spec: u ? specOf(u, i) : "",
  });
  const addMany = (i, us) => {
    setCart((c) => [...c, ...(us.length ? us : [null]).map((u) => line(i, u))]);
    if (us.length) setTimeout(() => cartRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    setPick(null);
    setSel([]);
  };
  // Total quantity of an item in the cart (all tracked units + the single merged line of an untracked item).
  const inCart = (i) =>
    cart.filter((l) => l.itemId === i.id).reduce((a, l) => a + l.q, 0);
  // One click = one unit. Untracked items merge into ONE cart line whose quantity goes up;
  // tracked items open the variant picker so the exact serial / IMEI unit is chosen.
  const add = (i) => {
    if (i.ser) return setSel([]), setPick(i);
    const ex = cart.find((l) => l.itemId === i.id && !l.serial);
    if (stock(d, i) <= (ex ? ex.q : 0) && !confirm("No more stock recorded. Add anyway?"))
      return;
    ex ? setQty(ex, ex.q + 1) : addMany(i, []);
  };
  const remove = (i) => {
    const ls = cart.filter((l) => l.itemId === i.id);
    if (!ls.length) return;
    const l = ls[ls.length - 1];
    l.serial || l.q <= 1
      ? setCart(cart.filter((x) => x.k !== l.k))
      : setQty(l, l.q - 1);
  };
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
  const bank = c.m === "Bank transfer";
  const finish = async () => {
    if (busy) return;
    // Verification never blocks checkout, but the bank name must be known for the record.
    if (bank && !bankLabel(bk)) return alert("Type the bank name.");
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
        ...(bank ? bankFields(bk) : {}),
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
        `Sale ${s.code}: ${mn(total)} (${bank ? bankLabel(bk) + (s.verify.status === "verified" ? ", receipt verified" : s.verify.status === "failed" ? ", RECEIPT NOT VERIFIED" : ", not verified") : c.m}) · ${L.reduce((a, l) => a + l.q, 0)} item(s)${c.n ? " · " + c.n : ""}`,
      );
      setCart([]);
      setC(E);
      setBk(BK);
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
          <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
            <In
              label="Search items"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <label className="block text-xs font-semibold text-slate-500">
              Sort by
              <select
                value={sortBy}
                onChange={(e) => pickSort(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-400/30 bg-white/50 px-3 py-2 text-sm outline-none dark:bg-white/5"
              >
                <option value="name">Name</option>
                <option value="type">Type</option>
                <option value="amount">Amount</option>
              </select>
            </label>
            <button
              type="button"
              aria-label={sortDir === "asc" ? "Ascending, tap for descending" : "Descending, tap for ascending"}
              title={sortDir === "asc" ? "Ascending" : "Descending"}
              onClick={() => pickDir(sortDir === "asc" ? "desc" : "asc")}
              className="rounded-xl border border-slate-400/30 px-3 py-2 text-sm font-bold hover:bg-slate-500/10"
            >
              {sortDir === "asc" ? "↑ A–Z" : "↓ Z–A"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((i) => {
              const n = stock(d, i),
                c = inCart(i);
              return (
                <div
                  key={i.id}
                  className={`flex flex-col rounded-2xl border bg-white/60 p-3 shadow transition dark:bg-white/5 ${n <= 0 && !c ? "opacity-60" : ""} ${c ? "border-orange-500" : "border-white/30 dark:border-white/10"}`}
                >
                  <button
                    type="button"
                    onClick={() => add(i)}
                    className="flex-1 text-left transition active:scale-95"
                  >
                    <b className="block">{i.name}</b>
                    <span className="text-sm text-slate-500">{mn(i.price)}</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Tag c={n <= (i.min || 0) ? "bad" : "ok"}>{n} in stock</Tag>
                      {i.ser && <Tag>S/N</Tag>}
                      {i.cond && <Tag c={condTag(i.cond)}>{i.cond}</Tag>}
                    </div>
                  </button>
                  <div className="mt-3 flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Remove ${i.name} from cart`}
                      title="Remove from Cart"
                      disabled={!c}
                      onClick={() => remove(i)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-400/40 text-lg font-bold transition hover:bg-red-500/10 active:scale-90 disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="min-w-6 text-center font-bold">{c}</span>
                    <button
                      type="button"
                      aria-label={`Add ${i.name} to cart`}
                      onClick={() => add(i)}
                      className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-full bg-gradient-to-br from-orange-500 to-pink-600 px-2 text-xs font-bold text-white transition active:scale-95"
                    >
                      <span className="text-base leading-none">+</span>
                      <span className="truncate">Add to Cart</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Card className="h-fit space-y-3">
          <div ref={cartRef} className="flex items-center scroll-mt-20">
            <h2 className="flex-1 text-xl font-bold">🛒 Cart</h2>
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
                        {l.spec && <span className="font-sans"> · {l.spec}</span>}
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
                    <div>
                      <div className="text-xs font-semibold text-slate-500">
                        Qty
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Remove one"
                          onClick={() =>
                            l.q <= 1
                              ? setCart(cart.filter((x) => x.k !== l.k))
                              : setQty(l, l.q - 1)
                          }
                          className="grid h-9 w-9 place-items-center rounded-full border border-slate-400/40 font-bold"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={l.q}
                          onChange={(e) => setQty(l, e.target.value)}
                          className="w-14 rounded-xl border border-slate-400/30 bg-white/50 px-1 py-2 text-center text-sm dark:bg-white/5"
                        />
                        <button
                          type="button"
                          aria-label="Add one"
                          onClick={() => setQty(l, l.q + 1)}
                          className="grid h-9 w-9 place-items-center rounded-full border border-slate-400/40 font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
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
              o={["Cash", "Bank transfer"]}
              value={c.m}
              onChange={(e) => setC({ ...c, m: e.target.value })}
            />
          </div>
          {bank && (
            <BankPanel
              value={bk}
              onChange={setBk}
              total={total}
              phone={c.p}
              accts={d.bankacct}
            />
          )}
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl dark:bg-slate-900">
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <h3 className="mb-1 font-bold">Select variant: {pick.name}</h3>
              <p className="mb-3 text-xs text-slate-500">
                Choose the exact unit(s) being sold. Each keeps its own serial /
                IMEI and warranty. You can tick several different units.
              </p>
              {free(pick).map((u) => {
                const on = sel.includes(u.id),
                  cond = u.cond || pick.cond,
                  note = u.condNote || pick.condNote;
                return (
                  <label
                    key={u.id}
                    className={`mb-2 flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${on ? "border-orange-500 bg-orange-500/10" : "border-slate-400/30 hover:bg-orange-500/5"}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={on}
                      onChange={() =>
                        setSel(
                          on ? sel.filter((x) => x !== u.id) : [...sel, u.id],
                        )
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <b className="block">{pick.name}</b>
                      <span className="block break-all font-mono text-xs">
                        S/N · IMEI: {u.serial}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        <Tag>RAM {u.ram || pick.ram || "—"}</Tag>
                        <Tag>Storage {u.storage || pick.storage || "—"}</Tag>
                        <Tag c={condTag(cond)}>
                          {cond
                            ? cond === "Used" && note
                              ? `Used: ${note}`
                              : cond
                            : "Condition —"}
                        </Tag>
                      </span>
                    </span>
                  </label>
                );
              })}
              {!free(pick).length && (
                <p className="text-slate-500">No units in stock.</p>
              )}
            </div>
            {/* Sticky footer: OK / Cancel stay on screen however long the unit list is. */}
            <div className="flex shrink-0 gap-2 border-t border-slate-400/20 bg-white px-5 py-3 dark:bg-slate-900">
              <Btn
                className="flex-1"
                disabled={!sel.length}
                onClick={() =>
                  addMany(
                    pick,
                    free(pick).filter((u) => sel.includes(u.id)),
                  )
                }
              >
                OK{sel.length ? ` · add ${sel.length}` : ""}
              </Btn>
              <Btn v="g" onClick={() => setPick(null)}>
                Cancel
              </Btn>
            </div>
          </div>
        </div>
      )}
      {!!units && (
        <button
          type="button"
          aria-label={`Cart, ${units} items`}
          onClick={() =>
            cartRef.current?.scrollIntoView({ behavior: "smooth" })
          }
          className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-orange-500 to-pink-600 text-2xl text-white shadow-xl lg:hidden"
        >
          🛒
          <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-slate-900 px-1 text-xs font-bold text-white">
            {units}
          </span>
        </button>
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
