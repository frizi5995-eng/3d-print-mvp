import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { MATERIALS } from "@/lib/constants";

export interface AppSettings {
  quoteValidityDays: number;
  minMarginWarningPercent: number;
  defaultMaterial: (typeof MATERIALS)[number];
  supportEmail: string;
  companyDisplayName: string;
  /** Pricing engine (M28) — floor uses minMarginWarningPercent above. */
  targetMarginPercent: number;
  highMarginPercent: number;
  contingencyPercent: number;
  packagingCostPerOrder: number;
  otherOperationalCostPerOrder: number;
  paymentProcessingFeePercent: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  quoteValidityDays: 7,
  minMarginWarningPercent: 15,
  defaultMaterial: "PLA",
  supportEmail: "hello@fabrik.example",
  companyDisplayName: "Fabrik",
  targetMarginPercent: 30,
  highMarginPercent: 40,
  contingencyPercent: 5,
  packagingCostPerOrder: 2,
  otherOperationalCostPerOrder: 0,
  paymentProcessingFeePercent: 1.5,
};

const SETTINGS_KEYS: Record<keyof AppSettings, string> = {
  quoteValidityDays: "quote_validity_days",
  minMarginWarningPercent: "min_margin_warning_percent",
  defaultMaterial: "default_material",
  supportEmail: "support_email",
  companyDisplayName: "company_display_name",
  targetMarginPercent: "target_margin_percent",
  highMarginPercent: "high_margin_percent",
  contingencyPercent: "contingency_percent",
  packagingCostPerOrder: "packaging_cost_per_order",
  otherOperationalCostPerOrder: "other_operational_cost_per_order",
  paymentProcessingFeePercent: "payment_processing_fee_percent",
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
    targetMarginPercent:
      (stored.get(SETTINGS_KEYS.targetMarginPercent) as number | undefined) ??
      DEFAULT_SETTINGS.targetMarginPercent,
    highMarginPercent:
      (stored.get(SETTINGS_KEYS.highMarginPercent) as number | undefined) ??
      DEFAULT_SETTINGS.highMarginPercent,
    contingencyPercent:
      (stored.get(SETTINGS_KEYS.contingencyPercent) as number | undefined) ??
      DEFAULT_SETTINGS.contingencyPercent,
    packagingCostPerOrder:
      (stored.get(SETTINGS_KEYS.packagingCostPerOrder) as number | undefined) ??
      DEFAULT_SETTINGS.packagingCostPerOrder,
    otherOperationalCostPerOrder:
      (stored.get(SETTINGS_KEYS.otherOperationalCostPerOrder) as number | undefined) ??
      DEFAULT_SETTINGS.otherOperationalCostPerOrder,
    paymentProcessingFeePercent:
      (stored.get(SETTINGS_KEYS.paymentProcessingFeePercent) as number | undefined) ??
      DEFAULT_SETTINGS.paymentProcessingFeePercent,
  };
}

export interface SettingsUpdateInput {
  quoteValidityDays: number;
  minMarginWarningPercent: number;
  defaultMaterial: string;
  supportEmail: string;
  companyDisplayName: string;
  targetMarginPercent: number;
  highMarginPercent: number;
  contingencyPercent: number;
  packagingCostPerOrder: number;
  otherOperationalCostPerOrder: number;
  paymentProcessingFeePercent: number;
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

  const percentFields: [keyof SettingsUpdateInput, string][] = [
    ["targetMarginPercent", "Target margin"],
    ["highMarginPercent", "High margin"],
    ["contingencyPercent", "Contingency"],
    ["paymentProcessingFeePercent", "Payment processing allowance"],
  ];
  for (const [field, label] of percentFields) {
    const value = input[field] as number;
    if (!Number.isFinite(value) || value < 0 || value >= 100) {
      errors.push({ field, message: `${label} must be a percentage between 0 and 99.9.` });
    }
  }
  if (input.targetMarginPercent < input.minMarginWarningPercent) {
    errors.push({ field: "targetMarginPercent", message: "Target margin must be at or above the minimum margin warning." });
  }
  if (input.highMarginPercent < input.targetMarginPercent) {
    errors.push({ field: "highMarginPercent", message: "High margin must be at or above the target margin." });
  }
  const costFields: [keyof SettingsUpdateInput, string][] = [
    ["packagingCostPerOrder", "Packaging cost"],
    ["otherOperationalCostPerOrder", "Other operational cost"],
  ];
  for (const [field, label] of costFields) {
    const value = input[field] as number;
    if (!Number.isFinite(value) || value < 0) {
      errors.push({ field, message: `${label} must be a non-negative amount.` });
    }
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
    { key: SETTINGS_KEYS.targetMarginPercent, value: input.targetMarginPercent },
    { key: SETTINGS_KEYS.highMarginPercent, value: input.highMarginPercent },
    { key: SETTINGS_KEYS.contingencyPercent, value: input.contingencyPercent },
    { key: SETTINGS_KEYS.packagingCostPerOrder, value: input.packagingCostPerOrder },
    { key: SETTINGS_KEYS.otherOperationalCostPerOrder, value: input.otherOperationalCostPerOrder },
    { key: SETTINGS_KEYS.paymentProcessingFeePercent, value: input.paymentProcessingFeePercent },
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
    {
      name: "Stripe",
      configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
      description: "Invoicing and payment collection for accepted quotes.",
    },
    {
      name: "Sculpteo (API)",
      configured: Boolean(process.env.SCULPTEO_CLIENT_ID && process.env.SCULPTEO_CLIENT_SECRET),
      description: "Supplier API integration — scaffolding only, quoting not yet implemented.",
    },
  ];
}
