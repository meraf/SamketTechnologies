import { Page, Card, Btn } from "../ui";
import { S } from "../catalogue";
// Google Maps embed. With VITE_GOOGLE_MAPS_KEY (Maps Embed API, restrict the key to your domain) the official embed is used;
// without a key Google's keyless embed of the same coordinates is used, so the map always works.
const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY,
  MAP = KEY
    ? `https://www.google.com/maps/embed/v1/place?key=${KEY}&q=${S.lat},${S.lng}&zoom=16`
    : `https://www.google.com/maps?q=${S.lat},${S.lng}&z=16&output=embed`;
const FAQ = [
  [
    "How long does a repair take?",
    "Screens and batteries are often same day. Board-level repairs take longer; you get a clear estimate after diagnosis.",
  ],
  [
    "Do I get a warranty?",
    "Yes, where it applies. The days are written on your receipt or repair ticket and tied to your IMEI or serial number.",
  ],
  [
    "What should I bring?",
    "The device, its charger if you have it, and your phone number. We record its condition before we start.",
  ],
  [
    "Can I track my repair?",
    "Yes. Use your ticket code on the Repairs page, or message us on Telegram.",
  ],
];
export default function Contact() {
  return (
    <Page title="Contact us">
      <p className="-mt-2 text-slate-500">
        Walk in, call, or message us. We reply fast.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["📞", "Call", S.phone, "tel:" + S.phone],
          ["💬", "Telegram", "Message us", S.tg],
          [
            "📍",
            "Visit",
            S.addr,
            `https://www.google.com/maps/dir/?api=1&destination=${S.lat},${S.lng}`,
          ],
          ["🕒", "Hours", S.hrs, null],
        ].map(([e, t, x, h]) => (
          <Card key={t} className="transition hover:-translate-y-1">
            <div className="text-3xl">{e}</div>
            <b className="block">{t}</b>
            {h ? (
              <a href={h} className="break-words text-sm text-orange-500">
                {x}
              </a>
            ) : (
              <p className="text-sm text-slate-500">{x}</p>
            )}
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-white/30 shadow-lg lg:col-span-2">
          <iframe
            title="Samket on Google Maps"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            className="h-72 w-full sm:h-96"
            src={MAP}
          />
        </div>
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Getting here</h2>
          <p className="text-sm text-slate-500">
            {S.addr}. Look for the Samket sign. Parking is available nearby.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${S.lat},${S.lng}`}
            >
              <Btn>Directions</Btn>
            </a>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${S.lat},${S.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              <Btn v="g">Open in Google Maps</Btn>
            </a>
            <a href={"tel:" + S.phone}>
              <Btn v="g">Call</Btn>
            </a>
          </div>
        </Card>
      </div>
      <Card>
        <h2 className="mb-3 text-xl font-bold">Common questions</h2>
        {FAQ.map(([q, a]) => (
          <details
            key={q}
            className="border-t border-slate-400/20 py-3 first:border-0"
          >
            <summary className="cursor-pointer font-semibold">{q}</summary>
            <p className="mt-2 text-sm text-slate-500">{a}</p>
          </details>
        ))}
      </Card>
    </Page>
  );
}
