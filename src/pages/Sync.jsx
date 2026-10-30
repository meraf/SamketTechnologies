import { useState } from "react";
import { Navigate } from "react-router-dom";
import {
  useDB,
  useSync,
  sync,
  resync,
  resolve,
  setCfg,
  broadcastKey,
  DEFAULT_SYNC_KEY,
} from "../db";
import { Card, Btn, In, Sel, Tag, Page, useUser, can } from "../ui";
const diff = (c) =>
  Object.keys({ ...c.mine, ...c.theirs }).filter(
    (k) =>
      !["ts", "dev", "seq", "dirty"].includes(k) &&
      JSON.stringify(c.mine[k]) !== JSON.stringify(c.theirs[k]),
  );
function KeyCard() {
  const [k, setK] = useState(localStorage.skey || DEFAULT_SYNC_KEY),
    [m, setM] = useState(""),
    [b, setB] = useState(false);
  const run = async (all) => {
    setB(true);
    setM("");
    try {
      if (all) await broadcastKey(k);
      else {
        setCfg("skey", k.trim());
        localStorage.removeItem("syncErr");
        sync();
      }
      setM(
        all
          ? "Done. Every device switches to the new key the next time it syncs."
          : "Saved on this device. Syncing now.",
      );
    } catch (e) {
      setM(e.message);
    }
    setB(false);
  };
  return (
    <Card className="space-y-3">
      <h2 className="font-bold">Sync key</h2>
      <In
        label="Sync key"
        value={k}
        onChange={(e) => setK(e.target.value)}
        onFocus={(e) => e.target.select()}
      />
      <p className="text-sm text-slate-500">
        Click to change the sync key. If sync is not working, use this default
        key.
      </p>
      <div className="flex flex-wrap gap-2">
        <Btn v="g" disabled={b} onClick={() => setK(DEFAULT_SYNC_KEY)}>
          Use default key
        </Btn>
        <Btn v="g" disabled={b || !k.trim()} onClick={() => run(false)}>
          Use on this device only
        </Btn>
        <Btn
          disabled={b || k.trim().length < 16}
          onClick={() =>
            confirm("Change the sync key for ALL devices?") && run(true)
          }
        >
          Change for all devices
        </Btn>
      </div>
      {m && <p className="text-sm">{m}</p>}
    </Card>
  );
}
export default function SyncPage() {
  const d = useDB(),
    s = useSync(),
    u = useUser();
  if (!can(u, "sync")) return <Navigate to="/staff/pos" replace />; // cashiers never see sync controls; sync runs silently
  const set = (k) => ({
    defaultValue: localStorage[k] || "",
    onChange: (e) => setCfg(k, e.target.value),
  });
  return (
    <Page
      title="Sync"
      right={
        <>
          <Btn v="g" onClick={resync}>
            Re-download all
          </Btn>{" "}
          <Btn onClick={sync}>Sync now</Btn>
        </>
      }
    >
      <Card>
        <div className="flex gap-2">
          <Tag c={s.on ? "ok" : "bad"}>{s.on ? "Online" : "Offline"}</Tag>
          <Tag c={s.p ? "warn" : "ok"}>{s.p} waiting to upload</Tag>
          <Tag c={s.c ? "bad" : "ok"}>{s.c} conflicts</Tag>
          <Tag c={s.o ? "warn" : "ok"}>{s.o} queued calls</Tag>
          {s.e && (
            <Tag c="bad">
              Sync error:{" "}
              {s.e === "401"
                ? "wrong sync key"
                : s.e === "net"
                  ? "cannot reach server"
                  : s.e}
            </Tag>
          )}
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Everything is saved on this device first and uploaded automatically
          when the connection returns (records via sync, other actions via the
          offline queue).
        </p>
      </Card>
      {d.conflict.map((c) => (
        <Card key={c.id} className="space-y-2">
          <b>
            Edited on two devices:{" "}
            {c.mine.name || c.mine.code || c.mine.serial || c.doc}
          </b>
          {diff(c).map((k) => (
            <div key={k} className="grid grid-cols-3 gap-2 text-sm">
              <b>{k}</b>
              <span className="rounded bg-orange-500/10 p-1">
                Mine: {JSON.stringify(c.mine[k])}
              </span>
              <span className="rounded bg-violet-500/10 p-1">
                Theirs: {JSON.stringify(c.theirs[k])}
              </span>
            </div>
          ))}
          <div className="flex gap-2">
            <Btn onClick={() => resolve(c, "mine")}>Keep mine</Btn>
            <Btn v="g" onClick={() => resolve(c, "theirs")}>
              Take theirs
            </Btn>
          </div>
        </Card>
      ))}
      <KeyCard />
      <Card className="grid gap-3 sm:grid-cols-2">
        <In label="Server URL (blank = this site)" {...set("surl")} />
        <Sel
          label="Receipt paper"
          o={["80", "58"]}
          defaultValue={localStorage.rw || "80"}
          onChange={(e) => {
            localStorage.rw = e.target.value;
          }}
        />
        {["cashier", "admin"].map((r) => (
          <In key={r} label={r + " PIN"} {...set("pin_" + r)} />
        ))}
        {["SL", "R", "P", "L"].map((p) => (
          <In
            key={p}
            label={`Last used ${p}- number (next is +1)`}
            type="number"
            {...set("no_" + p)}
          />
        ))}
      </Card>
    </Page>
  );
}
