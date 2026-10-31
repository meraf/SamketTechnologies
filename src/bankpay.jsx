import { useState } from "react";
import { Btn, In } from "./ui";
import { mn, DEFAULT_SYNC_KEY } from "./db";

// Banks / wallets in the order most used in Ethiopia.
export const BANKS = [
  ["Telebirr", "Telebirr"],
  ["CBE", "CBE (Commercial Bank of Ethiopia)"],
  ["CBE Birr", "CBE Birr (mobile wallet)"],
  ["M-Pesa", "M-Pesa"],
  ["Bank of Abyssinia", "Bank of Abyssinia"],
  ["Awash Bank", "Awash Bank"],
  ["Dashen Bank", "Dashen Bank"],
  ["Nib International Bank", "Nib International Bank"],
  ["Hibret Bank", "Hibret Bank"],
  ["Other", "Other (type the bank name)"],
];
export const bankLabel = (v) => (v.bank === "Other" ? (v.other || "").trim() : v.bank);

// ---- receiver matching: the receiver on the receipt must be one of OUR configured accounts ----
const tok = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9ሀ-፿\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
export const nameMatch = (holder, receiver) => {
  const A = tok(holder),
    B = tok(receiver);
  if (!A.length || !B.length) return false;
  const hit = A.filter((t) =>
    B.some((u) => u === t || (t.length >= 3 && u.length >= 3 && (u.startsWith(t) || t.startsWith(u)))),
  ).length;
  return hit >= Math.min(2, A.length, B.length);
};
const acctOk = (a, recvAcct) => {
  const x = String(a.number || "").replace(/\D/g, ""),
    y = String(recvAcct || "").replace(/\D/g, "");
  return x.length < 4 || y.length < 4 || x.slice(-4) === y.slice(-4); // receipts often mask the middle digits
};

/** Turn the server answer into { status: 'verified' | 'failed', receiver, amount, note, raw ... }. */
export function judge(resp, accts, bank) {
  if (!resp || resp.configured === false)
    return { status: "failed", note: "Verification is not set up on the server (CHECK_ET_API_KEY is missing).", raw: resp || null };
  const r = resp.result || {},
    d = r.data || {},
    rc = d.receipt || {},
    base = {
      raw: resp,
      receiver: rc.receiver_name || "",
      receiverAccount: rc.receiver_account || "",
      payer: rc.payer_name || "",
      amount: +rc.amount || 0,
      txDate: rc.transaction_date || "",
      txRef: d.transaction_number || "",
    };
  if (!r.success)
    return {
      ...base,
      status: "failed",
      note:
        (r.message || `Transaction not verified (HTTP ${resp.http})`) +
        " Check the bank and reference, or upload the receipt image. You can still complete the sale.",
    };
  if (!accts.length)
    return { ...base, status: "failed", note: "No store bank account is saved on the Cash page, so the receiver cannot be matched." };
  const mine = accts.filter((a) => a.bank === bank),
    pool = mine.length ? mine : accts,
    hit = pool.find((a) => acctOk(a, rc.receiver_account) && nameMatch(a.holder, rc.receiver_name));
  return hit
    ? { ...base, status: "verified", match: hit.holder }
    : { ...base, status: "failed", note: `Receiver "${rc.receiver_name || "unknown"}" does not match a store account holder.` };
}

// ---- receipt image helpers ----
async function prep(f) {
  if (f.type === "application/pdf") {
    if (f.size > 3e6) throw new Error("PDF is too large (max 3 MB).");
    return { blob: f, type: f.type };
  }
  const b = await createImageBitmap(f),
    k = Math.min(1, 1800 / Math.max(b.width, b.height)),
    c = document.createElement("canvas");
  c.width = Math.round(b.width * k);
  c.height = Math.round(b.height * k);
  c.getContext("2d").drawImage(b, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
  if (blob.size > 3.2e6) throw new Error("Image is too large.");
  return { blob, type: "image/jpeg" };
}
const b64 = (blob) =>
  new Promise((ok) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(",")[1]);
    fr.readAsDataURL(blob);
  });
// Check.et needs the receipt text together with an image, so the screenshot is read in the browser (loaded only when used).
let ocr;
const readText = async (blob) => {
  ocr ||= import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js");
  const T = await ocr,
    rec = T.recognize || (T.default && T.default.recognize);
  return (await rec(blob, "eng")).data.text || "";
};

const sel =
  "mt-1 w-full rounded-xl border border-slate-400/30 bg-white/50 dark:bg-white/5 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-orange-500";

/** value: { bank, other, ref, verify }. accts: staff bank accounts (docs of type 'bankacct'). */
export function BankPanel({ value: v, onChange, total, phone, accts }) {
  const [file, setFile] = useState(null),
    [busy, setBusy] = useState(""),
    set = (p) => onChange({ ...v, ...p }),
    reset = (p) => onChange({ ...v, ...p, verify: null }),
    name = bankLabel(v),
    ver = v.verify;
  const run = async () => {
    setBusy("Checking…");
    let resp;
    try {
      let f = null,
        text = "";
      if (file) {
        setBusy("Reading receipt…");
        const { blob, type } = await prep(file);
        if (type !== "application/pdf") text = await readText(blob).catch(() => "");
        f = { b64: await b64(blob), type, name: file.name };
        setBusy("Verifying…");
      }
      // Every saved account for the chosen bank (falls back to all saved accounts) goes to the server, never just "the first".
      const mine = accts.filter((a) => a.bank === name),
        pool = (mine.length ? mine : accts).map((a) => a.number).filter(Boolean),
        r = await fetch((localStorage.surl || "") + "/api/verify-payment", {
          method: "POST",
          headers: { "content-type": "application/json", "x-key": localStorage.skey || DEFAULT_SYNC_KEY },
          body: JSON.stringify({ bank: name, ref: v.ref, account: pool[0] || "", accounts: pool, phone, file: f, text }),
        });
      resp = r.ok ? await r.json() : { configured: true, http: r.status, result: { success: false, message: "Server error " + r.status } };
    } catch (e) {
      resp = { configured: true, http: 0, result: { success: false, message: e.message || "Could not verify (offline?)" } };
    }
    const j = judge(resp, accts, name);
    onChange({ ...v, ref: v.ref || j.txRef || "", verify: { ...j, at: Date.now() } });
    setBusy("");
  };
  return (
    <div className="space-y-3 rounded-2xl border border-slate-400/30 p-3">
      <label className="block text-xs font-semibold text-slate-500">
        Bank / wallet
        <select className={sel} value={v.bank} onChange={(e) => reset({ bank: e.target.value })}>
          {BANKS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {v.bank === "Other" && (
        <In label="Bank name *" value={v.other || ""} onChange={(e) => reset({ other: e.target.value })} />
      )}
      <label className="block text-xs font-semibold text-slate-500">
        Receipt image or PDF (take a photo or upload)
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          onChange={(e) => {
            setFile(e.target.files[0] || null);
            reset({});
          }}
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-white"
        />
      </label>
      <In
        label={file ? "Transaction reference (optional, the receipt is used)" : "Transaction reference number"}
        value={v.ref || ""}
        onChange={(e) => reset({ ref: e.target.value })}
      />
      <Btn type="button" v="g" disabled={!!busy || (!file && !String(v.ref || "").trim())} onClick={run}>
        {busy || (ver ? "Verify again" : "Verify receipt")}
      </Btn>
      {!ver && !busy && (
        <p className="text-xs text-slate-500">Not verified yet. You can still complete the sale.</p>
      )}
      {ver && (
        <div
          className={`rounded-xl p-3 text-sm ${ver.status === "verified" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400"}`}
          role="status"
        >
          <b className="block text-base tracking-wide">
            {ver.status === "verified" ? "✔ RECEIPT VERIFIED" : "✖ RECEIPT VERIFICATION FAILED"}
          </b>
          {ver.receiver && <div>Receiver: {ver.receiver}</div>}
          {ver.payer && <div>Payer: {ver.payer}</div>}
          {!!ver.amount && <div>Amount on receipt: {mn(ver.amount)}</div>}
          {ver.note && <div className="mt-1">{ver.note}</div>}
          {ver.status === "verified" && !!ver.amount && !!total && Math.abs(ver.amount - total) > 0.5 && (
            <div className="mt-1 font-semibold text-amber-600 dark:text-amber-400">
              Check: receipt amount {mn(ver.amount)} differs from the sale total {mn(total)}.
            </div>
          )}
          {ver.status === "failed" && <div className="mt-1 text-xs opacity-80">You can still complete the sale.</div>}
        </div>
      )}
    </div>
  );
}
/** Fields saved on the sale record: reference, bank, verification status and the raw verification payload. */
export const bankFields = (v) => ({
  bank: bankLabel(v),
  txRef: String(v.ref || "").trim(),
  verify: v.verify
    ? {
        status: v.verify.status,
        receiver: v.verify.receiver || "",
        payer: v.verify.payer || "",
        amount: v.verify.amount || 0,
        txDate: v.verify.txDate || "",
        note: v.verify.note || "",
        at: v.verify.at,
        raw: v.verify.raw || null,
      }
    : { status: "unverified", raw: null },
});
