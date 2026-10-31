import { useState } from "react";
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
  const add = async (e) => {
    e.preventDefault();
    if (!CONDS.includes(f.cond))
      return alert("Choose the condition: Brand New, Refurbished or Used.");
    if (f.cond === "Used" && !String(f.condNote || "").trim())
      return alert("Describe the degree of use / wear for a Used item.");
    const i = await save("item", {
      ...f,
      condNote: f.cond === "Used" ? f.condNote.trim() : "",
      price: +f.price || 0,
      cost: +f.cost || 0,
      min: +f.min || 0,
      war: +f.war || 0,
      pub: f.pub !== "no",
      ser: f.ser === "yes",
    });
    if (!f.id && !i.ser && +f.qty)
      await save("move", { item: i.id, q: +f.qty, ref: "opening" });
    setF(null);
  };
  const addSerial = (s) => {
    if (ser.includes(s) || d.unit.some((u) => u.serial === s))
      return alert("Serial already recorded: " + s);
    setSer([...ser, s]);
  };
  const receive = async () => {
    if (rc.ser && !CONDS.includes(f.cond))
      return alert("Choose the condition of these units.");
    if (rc.ser && f.cond === "Used" && !String(f.condNote || "").trim())
      return alert("Describe the degree of use / wear for Used units.");
    if (rc.ser)
      for (const s of ser)
        await save("unit", {
          id: "u:" + s,
          itemId: rc.id,
          tag: await code(PFX[rc.cat] || "I"),
          serial: s,
          status: "in_stock",
          cost: +f.ucost || rc.cost || 0,
          ram: (f.ram || "").trim(),
          storage: (f.storage || "").trim(),
          cond: f.cond,
          condNote: f.cond === "Used" ? f.condNote.trim() : "",
          receivedDate: Date.now(),
        });
    else await save("move", { item: rc.id, q: +f.rq || 0, ref: "receive" });
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
            <Sel label="Condition *" o={["Select…", ...CONDS]} {...b("cond")} />
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
              <In label="Cost per unit" type="number" {...b("ucost")} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <In label="RAM (this batch)" {...b("ram")} />
                <In label="Storage (this batch)" {...b("storage")} />
                <Sel label="Condition *" o={["Select…", ...CONDS]} {...b("cond")} />
                {f.cond === "Used" && (
                  <In label="Degree of use / wear *" {...b("condNote")} />
                )}
              </div>
              <Scan
                onScan={addSerial}
                label="Scan or type each IMEI / serial, press Enter"
              />
              <div className="flex flex-wrap gap-2">
                {ser.map((s) => (
                  <Tag key={s}>
                    {s}{" "}
                    <button onClick={() => setSer(ser.filter((x) => x !== s))}>
                      ✕
                    </button>
                  </Tag>
                ))}
              </div>
            </>
          ) : (
            <In label="Quantity" type="number" {...b("rq")} />
          )}
          <div className="flex gap-2">
            <Btn onClick={receive} disabled={rc.ser && !ser.length}>
              Add {rc.ser ? ser.length + " unit(s)" : "stock"}
            </Btn>
            <Btn
              v="g"
              onClick={() => {
                setRc(null);
                setSer([]);
              }}
            >
              Cancel
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
                    setF({
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
