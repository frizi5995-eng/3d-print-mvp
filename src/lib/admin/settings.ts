import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { MATERIALS } from "@/lib/constants";

export interface AppSettings {
  quoteValidityDays: number;
  minMarginWarningPercent: number;
  defaultMaterial: (typeof MATERIALS)[number];
  supportEmail: string;
  companyDisplayName: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  quoteValidityDays: 7,
  minMarginWarningPercent: 15,
  defaultMaterial: "PLA",
  supportEmail: "hello@fabrik.example",
  companyDisplayName: "Fabrik",
};

const SETTINGS_KEYS: Record<keyof AppSettings, string> = {
  quoteValidityDays: "quote_validity_days",
  minMarginWarningPercent: "min_margin_warning_percent",
  defaultMaterial: "default_material",
  supportEmail: "support_email",
  companyDisplayName: "company_display_name",
};

/** Falls back to DEFAULT_SETTINGS for any key not yet stored (or the table being empty). */
export async function getSettings(): Promise<AppSettings> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("app_settings").select("key, value");
  const stored = new Map((data ?? []).map((row) => [row.key as string, row.value]));

  return {
    quoteValidityDays:
      (stored.get(SETTINGS_KEYS.quoteValidityDays) as number | undefined) ??
      DEFAULT_SETTINGS.quoteValidityDays,
    minMarginWarningPercent:
      (stored.get(SETTINGS_KEYS.minMarginWarningPercent) as number | undefined) ??
      DEFAULT_SETTINGS.minMarginWarningPercent,
    defaultMaterial:
      (stored.get(SETTINGS_KEYS.defaultMaterial) as AppSettings["defaultMaterial"] | undefined) ??
      DEFAULT_SETTINGS.defaultMaterial,
    supportEmail:
      (stored.get(SETTINGS_KEYS.supportEmail) as string | undefined) ?? DEFAULT_SETTINGS.supportEmail,
    companyDisplayName:
      (stored.get(SETTINGS_KEYS.companyDisplayName) as string | undefined) ??
      DEFAULT_SETTINGS.companyDisplayName,
  };
}

export interface SettingsUpdateInput {
  quoteValidityDays: number;
  minMarginWarningPercent: number;
  defaultMaterial: string;
  supportEmail: string;
  companyDisplayName: string;
}

export interface SettingsValidationError {
  field: string;
  message: string;
}

/** Never validates or stores secrets/API keys — those stay in environment variables only. */
export function validateSettings(input: SettingsUpdateInput): SettingsValidationError[] {
  const errors: SettingsValidationError[] = [];

  if (!Number.isInteger(input.quoteValidityDays) || input.quoteValidityDays < 1 || input.quoteValidityDays > 90) {
    errors.push({ field: "quoteValidityDays", message: "Quote validity must be a whole number of days between 1 and 90." });
  }
  if (
    !Number.isFinite(input.minMarginWarningPercent) ||
    input.minMarginWarningPercent < 0 ||
    input.minMarginWarningPercent > 100
  ) {
    errors.push({ field: "minMarginWarningPercent", message: "Minimum margin warning must be a percentage between 0 and 100." });
  }
  if (!MATERIALS.includes(input.defaultMaterial as (typeof MATERIALS)[number])) {
    errors.push({ field: "defaultMaterial", message: "Default material must be one of the supported materials." });
  }
  const email = input.supportEmail.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: "supportEmail", message: "Support email must be a valid email address." });
  }
  const name = input.companyDisplayName.trim();
  if (!name || name.length > 100) {
    errors.push({ field: "companyDisplayName", message: "Company display name must be 1-100 characters." });
  }

  return errors;
}

export async function updateSettings(input: SettingsUpdateInput): Promise<void> {
  const supabase = createServiceClient();
  const rows = [
    { key: SETTINGS_KEYS.quoteValidityDays, value: input.quoteValidityDays },
    { key: SETTINGS_KEYS.minMarginWarningPercent, value: input.minMarginWarningPercent },
    { key: SETTINGS_KEYS.defaultMaterial, value: input.defaultMaterial },
    { key: SETTINGS_KEYS.supportEmail, value: input.supportEmail.trim() },
    { key: SETTINGS_KEYS.companyDisplayName, value: input.companyDisplayName.trim() },
  ];
  const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
  if (error) throw error;
}

export interface IntegrationStatus {
  name: string;
  configured: boolean;
  description: string;
}

/** Never returns key values — presence-only, derived from env vars. */
export function getIntegrationStatuses(): IntegrationStatus[] {
  return [
    { name: "Supabase", configured: true, description: "Database, auth, and storage (required)." },
    {
      name: "Resend",
      configured: Boolean(process.env.RESEND_API_KEY),
      description: "Outbound quote-ready emails. Without it, use the copyable quote link instead.",
    },
    {
      name: "Cloudflare Turnstile",
      configured: Boolean(process.env.TURNSTILE_SECRET_KEY),
      description: "Bot verification on the public quote form.",
    },
  ];
}
