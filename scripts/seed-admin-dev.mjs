// Dev-only seed data for exercising the admin UI's status states.
// Never run this against production. Usage:
//   node --env-file=.env.local scripts/seed-admin-dev.mjs
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV=production.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run with: node --env-file=.env.local scripts/seed-admin-dev.mjs"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// These models point at storage paths that don't actually exist — the admin
// detail page's viewer/download will show "Preview unavailable" /
// "Download unavailable" for seeded rows, which is expected. This script
// only exercises the request list/detail/pricing/status UI, not real files.
async function makeFakeModel(filename) {
  const id = randomUUID();
  const { error } = await supabase.from("models").insert({
    id,
    filename,
    storage_path: `${id}/${filename}`,
    file_type: "stl",
    file_size: 512_000,
  });
  if (error) throw error;
  return id;
}

const sevenDaysFromNow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
};

const seeds = [
  { status: "new", name: "Alex Johnson", filename: "phone-holder.stl" },
  { status: "checking", name: "Maria Silva", filename: "bracket.stl" },
  {
    status: "waiting_for_partner",
    name: "Tom Becker",
    filename: "enclosure.stl",
  },
  {
    status: "quote_ready",
    name: "Priya Nair",
    filename: "gear.stl",
    pricing: { production_cost: 7.5, production_shipping_cost: 3, other_cost: 0, customer_manufacturing_price: 14.9, customer_shipping_price: 3 },
    quote: true,
  },
  {
    status: "accepted",
    name: "John Doe",
    filename: "hook.stl",
    pricing: { production_cost: 5.2, production_shipping_cost: 2.5, other_cost: 1, customer_manufacturing_price: 12, customer_shipping_price: 2.5 },
    quote: true,
  },
  {
    status: "manufacturing",
    name: "Elena Petrova",
    filename: "clip.stl",
    pricing: { production_cost: 9, production_shipping_cost: 4, other_cost: 0.5, customer_manufacturing_price: 19.9, customer_shipping_price: 4 },
    quote: true,
  },
  {
    status: "completed",
    name: "Sam Carter",
    filename: "stand.stl",
    pricing: { production_cost: 6, production_shipping_cost: 2, other_cost: 0, customer_manufacturing_price: 13.5, customer_shipping_price: 2 },
    quote: true,
  },
];

for (const seed of seeds) {
  const modelId = await makeFakeModel(seed.filename);

  const row = {
    status: seed.status,
    customer_name: seed.name,
    customer_email: `${seed.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    customer_phone: "+1 555 0100",
    country: "Latvia",
    postal_code: "LV-1001",
    quantity: 1,
    material: "PLA",
    color: "Black",
    model_id: modelId,
    ...(seed.pricing ?? {}),
    ...(seed.quote
      ? { quote_token: randomBytes(32).toString("base64url"), quote_expires_at: sevenDaysFromNow() }
      : {}),
  };

  const { error } = await supabase.from("manufacturing_requests").insert(row);
  if (error) throw error;
  console.log(`Seeded ${seed.status}: ${seed.name} / ${seed.filename}`);
}

console.log("Done.");
