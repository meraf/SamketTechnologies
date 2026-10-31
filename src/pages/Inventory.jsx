import { useRef, useState } from "react";
import { useDB, save, stock, mn, day, code, PFX } from "../db";
import {
  Card,
  Btn,
  In,
  Sel,
  Tag,
  Scan,
  useF,
  Page,
  ItemImg,
  shrink,
  CONDS,
  condLabel,
} from "../ui";
export default function Inventory() {
  const d = useDB(),
    [f, b, setF] = useF(),
    [rc, setRc] = useState(null),
    [ser, setSer] = useState([]),
    [q, setQ] = useState("");
  const seen = useRef(new Set()); // serials registered in this session (guards rapid double entry)
  const add = async (e) => {
    e.preventDefault();
    const cond = CONDS.includes(f.cond) ? f.cond : "";
    // Tracked items get condition / RAM / storage / cost per unit when received; untracked items need it here.
    if (f.ser === "no" && !cond)
      return alert("Choose the condition: Brand New, Refurbished or Used.");
    if (cond === "Used" && f.ser === "no" && !String(f.condNote || "").trim())
      return alert("Describe the degree of use / wear for a Used item.");
    const i = await save("item", {
      ...f,
      cond,
      condNote: cond === "Used" ? String(f.condNote || "").trim() : "",
      price: +f.price || 0,
      cost: +f.cost || 0,
      min: +f.min || 0,
      war: +f.war || 0,
      pub: f.pub !== "no",
      ser: f.ser === "yes",
    });
    if (!f.id && !i.ser && +f.qty)
      await save("move", { item: i.id, q: +f.qty, ref: "opening" });
    if (!f.id && i.ser) {
      // straight on to entering the individual units (each with its own cost, RAM, storage, condition and serial)
      setRc(i);
      setSer([]);
      seen.current = new Set();
      setF({
        ram: i.ram,
        storage: i.storage,
        cond: i.cond,
        condNote: i.condNote,
        ucost: i.cost || "",
      });
      return;
    }
    setF(null);
  };
  // Register ONE unit immediately with the current variant settings, then the serial field is cleared and refocused.
  // Returns false when something is missing so the typed serial stays in the box.
  const registerUnit = (s) => {
    if (seen.current.has(s) || d.unit.some((u) => u.serial === s))
      return alert("Serial already recorded: " + s), false;
    if (!CONDS.includes(f.cond))
      return alert("Choose the condition of this unit first."), false;
    const note = String(f.condNote || "").trim();
    if (f.cond === "Used" && !note)
      return alert("Describe the degree of use / wear for this Used unit."), false;
    const cost =
      f.ucost !== "" && f.ucost != null ? +f.ucost : rc.cost || 0;
    if (isNaN(cost) || cost < 0) return alert("Enter a valid cost."), false;
    seen.current.add(s);
    const u = {
      id: "u:" + s,
      itemId: rc.id,
      serial: s,
      status: "in_stock",
      cost,
      ram: String(f.ram || "").trim(),
      storage: String(f.storage || "").trim(),
      cond: f.cond,
      condNote: f.cond === "Used" ? note : "",
      receivedDate: Date.now(),
    };
    setSer((a) => [{ ...u, tag: "…" }, ...a]);
    code(PFX[rc.cat] || "I").then((tag) => save("unit", { ...u, tag }));
    return true;
  };
  const undoUnit = (u) => {
    seen.current.delete(u.serial);
    setSer((a) => a.filter((x) => x.id !== u.id));
    save("unit", { ...u, del: true });
  };
  const receive = async () => {
    await save("move", { item: rc.id, q: +f.rq || 0, ref: "receive" });
    setRc(null);
    setSer([]);
    setF(null);
  };
  const L = d.item.filter((i) =>
    (i.name + i.cat).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <Page
      title="Stock"
      right={
        <Btn
          onClick={() =>
            setF({ cat: "Phones", ser: "yes", pub: "yes", war: 0 })
          }
        >
          New item
        </Btn>
      }
    >
      {f && !rc && (
        <Card>
          <form
            onSubmit={add}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <In label="Name" required {...b("name")} />
            <Sel
              label="Category"
              o={[
                "Phones",
                "Laptops",
                "Desktops",
                "Modems",
                "Parts",
                "Accessories",
              ]}
              {...b("cat")}
            />
            <Sel
              label="Track serial / IMEI per unit"
              o={["yes", "no"]}
              {...b("ser")}
            />
            <In
              label="Listed price (editable at sale)"
              type="number"
              {...b("price")}
            />
            <In label="Default cost" type="number" {...b("cost")} />
            <In label="Low-stock limit" type="number" {...b("min")} />
            <In label="Default warranty (days)" type="number" {...b("war")} />
            <In label="Processor (optional)" {...b("cpu")} />
            <In label="RAM (optional)" placeholder="e.g. 8GB" {...b("ram")} />
            <In label="Storage (optional)" placeholder="e.g. 256GB" {...b("storage")} />
            <In label="Screen type (optional)" placeholder="e.g. 6.1 OLED" {...b("screen")} />
            <In label="Camera (optional)" {...b("camera")} />
            <Sel
              label={f.ser === "no" ? "Condition *" : "Default condition (each unit sets its own)"}
              o={["Select…", ...CONDS]}
              {...b("cond")}
            />
            {f.cond === "Used" && (
              <In
                label="Degree of use / wear *"
                placeholder="e.g. Grade B, light scratches, 1 year old"
                {...b("condNote")}
              />
            )}
            <Sel label="Show on website" o={["yes", "no"]} {...b("pub")} />
            {!f.id && f.ser === "no" && (
              <In label="Opening stock" type="number" {...b("qty")} />
            )}
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-500">
                Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const x = e.target.files[0];
                    x && setF({ ...f, img: await shrink(x) });
                  }}
                  className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-white"
                />
              </label>
              {f.img && (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={f.img}
                    alt=""
                    className="h-20 w-20 rounded-xl object-cover"
                  />
                  <Btn
                    v="g"
                    type="button"
                    onClick={() => setF({ ...f, img: "" })}
                  >
                    Remove
                  </Btn>
                </div>
              )}
            </div>
            <div className="flex gap-2 sm:col-span-3">
              <Btn>Save</Btn>
              <Btn v="g" type="button" onClick={() => setF(null)}>
                Cancel
              </Btn>
            </div>
          </form>
        </Card>
      )}
      {rc && (
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Receive: {rc.name}</h2>
          {rc.ser ? (
            <>
              <p className="text-sm text-slate-500">
                Set this variant (cost, RAM, storage, condition), then scan or type each
                serial / IMEI and press <b>Enter</b> or <b>Next / Add Another</b>. Every unit is saved
                straight away with these settings and the serial box clears for the next one. Change
                any setting (for example a different condition note for a Used unit) between entries.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <In label="Cost for this unit (ETB)" type="number" {...b("ucost")} />
                <In label="RAM" {...b("ram")} />
                <In label="Storage" {...b("storage")} />
                <Sel label="Condition *" o={["Select…", ...CONDS]} {...b("cond")} />
                {f.cond === "Used" && (
                  <In
                    label="Condition rating / wear *"
                    placeholder="e.g. Grade B, light scratches"
                    {...b("condNote")}
                  />
                )}
              </div>
              <Scan
                onScan={registerUnit}
                next="Next / Add Another"
                label="Serial / IMEI (scan or type, then Enter)"
              />
              {!!ser.length && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-500">
                    {ser.length} unit(s) added this session
                  </div>
                  {ser.map((u) => (
                    <div
                      key={u.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-500/10 px-3 py-1.5 text-sm"
                    >
                      <span className="font-mono">{u.serial}</span>
                      <span className="text-slate-500">
                        {[u.ram, u.storage].filter(Boolean).join(" / ") || "no specs"} ·{" "}
                        {condLabel(u)} · {u.cost} ETB
                      </span>
                      <button
                        className="ml-auto text-xs text-red-500 underline"
                        onClick={() => undoUnit(u)}
                      >
                        Undo
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <In label="Quantity" type="number" {...b("rq")} />
          )}
          <div className="flex gap-2">
            {!rc.ser && <Btn onClick={receive}>Add stock</Btn>}
            <Btn
              v={rc.ser ? undefined : "g"}
              onClick={() => {
                setRc(null);
                setSer([]);
                setF(null);
              }}
            >
              {rc.ser ? "Done" : "Cancel"}
            </Btn>
          </div>
        </Card>
      )}
      <In label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        {L.map((i) => {
          const n = stock(d, i),
            low = n <= i.min;
          return (
            <Card key={i.id}>
              <ItemImg i={i} cls="mb-3 h-28" />
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <b>{i.name}</b>
                  <div className="text-sm text-slate-500">
                    {i.cat} · {mn(i.price)} · {i.war || 0}d warranty
                    {i.cond ? " · " + condLabel(i) : ""}
                  </div>
                </div>
                <Tag c={low ? "bad" : "ok"}>
                  {n} {low ? "LOW" : ""}
                </Tag>
              </div>
              {i.ser && (
                <details className="mt-2 text-xs text-slate-500">
                  <summary className="cursor-pointer">Units</summary>
                  {d.unit
                    .filter((u) => u.itemId === i.id)
                    .map((u) => (
                      <div key={u.id} className="font-mono">
                        {u.tag && u.tag + " · "}
                        {u.serial} · {u.status}
                        {u.cond ? " · " + condLabel(u) : ""}
                        {u.ram || u.storage ? " · " + [u.ram, u.storage].filter(Boolean).join("/") : ""}
                        {u.until ? " · warranty " + u.until : ""}
                      </div>
                    ))}
                </details>
              )}
              <div className="mt-3 flex gap-2">
                <Btn
                  className="!py-1"
                  onClick={() => {
                    setRc(i);
                    setSer([]);
                    seen.current = new Set();
                    setF({
                      ucost: i.cost || "",
                      ram: i.ram,
                      storage: i.storage,
                      cond: i.cond,
                      condNote: i.condNote,
                    });
                  }}
                >
                  Receive
                </Btn>
                <Btn
                  v="g"
                  className="!py-1"
                  onClick={() =>
                    setF({
                      ...i,
                      ser: i.ser ? "yes" : "no",
                      pub: i.pub === false ? "no" : "yes",
                    })
                  }
                >
                  Edit
                </Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </Page>
  );
}
