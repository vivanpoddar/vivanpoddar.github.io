// Travel bookings for /travel.
//
//   GET  /api/travel                      -> { booked: [{ windowId, leave, back }] }   (public, no contact info)
//   POST /api/travel  { name, email, phone, where, note, leave, back }   -> { ok, booking }
//   GET  /api/travel?all=1      + header x-admin-key   -> { bookings: [...] }       (everything)
//   POST /api/travel  { action: "cancel", id }  + header x-admin-key -> { ok }
//
// Storage: an Upstash Redis database connected to this Vercel project
// (Vercel dashboard -> Storage). Admin access: ADMIN_KEY environment variable.

const { windows } = require("../travel-windows.json");

const KEY = "travel:bookings";
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_KEY = process.env.ADMIN_KEY;

const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function redis(command) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error(`storage ${r.status}`);
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function allBookings() {
  const flat = (await redis(["HGETALL", KEY])) || [];
  const out = [];
  for (let i = 1; i < flat.length; i += 2) {
    try { out.push(JSON.parse(flat[i])); } catch {}
  }
  return out.sort((a, b) => (a.leave < b.leave ? -1 : 1));
}

function isAdmin(req) {
  return Boolean(ADMIN_KEY) && req.headers["x-admin-key"] === ADMIN_KEY;
}

function clean(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

module.exports = async (req, res) => {
  if (!URL_ || !TOKEN) {
    return send(res, 503, { error: "Booking isn't switched on yet. Check back soon." });
  }

  try {
    if (req.method === "GET") {
      const bookings = await allBookings();
      if (req.query.all) {
        if (!isAdmin(req)) return send(res, 401, { error: "That admin key isn't right." });
        return send(res, 200, { bookings });
      }
      return send(res, 200, {
        booked: bookings.map(({ windowId, leave, back }) => ({ windowId, leave, back })),
      });
    }

    if (req.method !== "POST") return send(res, 405, { error: "Use GET or POST." });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    if (body.action === "cancel") {
      if (!isAdmin(req)) return send(res, 401, { error: "That admin key isn't right." });
      await redis(["HDEL", KEY, clean(body.id, 40)]);
      return send(res, 200, { ok: true });
    }

    // Honeypot: real people never fill this hidden field.
    if (clean(body.website, 200)) return send(res, 200, { ok: true });

    const name = clean(body.name, 80);
    const email = clean(body.email, 120);
    const phone = clean(body.phone, 40);
    const where = clean(body.where, 120);
    const note = clean(body.note, 1000);
    const leave = clean(body.leave, 16);
    const back = clean(body.back, 16);

    if (!name) return send(res, 400, { error: "Add your name." });
    if (!EMAIL.test(email)) return send(res, 400, { error: "Add an email address that works." });
    if (phone.replace(/\D/g, "").length < 7) return send(res, 400, { error: "Add a phone number with the area code." });
    if (!STAMP.test(leave) || !STAMP.test(back)) return send(res, 400, { error: "Pick both a leave and a return time." });
    if (back <= leave) return send(res, 400, { error: "The return has to be after the departure." });

    const win = windows.find((w) => leave >= w.start && leave <= w.end && (w.open || back <= w.end));
    if (!win) return send(res, 400, { error: "Those times fall outside the windows when I'm free." });

    const bookings = await allBookings();
    const clash = bookings.find((b) => leave < b.back && b.leave < back);
    if (clash) return send(res, 409, { error: "Someone already booked part of that time. Pick different times." });

    const booking = {
      id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      windowId: win.id,
      leave, back, name, email, phone, where, note,
      createdAt: new Date().toISOString(),
    };
    await redis(["HSET", KEY, booking.id, JSON.stringify(booking)]);
    return send(res, 200, { ok: true, booking: { id: booking.id, leave, back } });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "Something went wrong saving that. Try again in a minute." });
  }
};
