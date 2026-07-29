"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/admin";
import { logAdminActivity } from "@/lib/admin/activity-log";
import {
  getSettings,
  updateSettings,
  validateSettings,
  type SettingsUpdateInput,
} from "@/lib/admin/settings";

export interface SettingsFormState {
  status: "idle" | "success" | "error";
  error?: string;
}

export async function saveSettings(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const admin = await requireAdminUser();

  const input: SettingsUpdateInput = {
    quoteValidityDays: Number(formData.get("quoteValidityDays")),
    minMarginWarningPercent: Number(formData.get("minMarginWarningPercent")),
    defaultMaterial: String(formData.get("defaultMaterial") ?? ""),
    supportEmail: String(formData.get("supportEmail") ?? ""),
    companyDisplayName: String(formData.get("companyDisplayName") ?? ""),
  };

  const errors = validateSettings(input);
  if (errors.length > 0) {
    return { status: "error", error: errors.map((e) => e.message).join(" ") };
  }

  const before = await getSettings();
  await updateSettings(input);

  const changedFields = (Object.keys(input) as (keyof SettingsUpdateInput)[]).filter(
    (key) => String(before[key]) !== String(input[key])
  );

  if (changedFields.length > 0) {
    await logAdminActivity(admin.email!, "settings_updated", null, { changedFields });
  }

  revalidatePath("/admin/settings");
  return { status: "success" };
}
