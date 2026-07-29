import "server-only";
import { sculpteoProvider } from "./sculpteo";
import type { SupplierProvider } from "./types";

const PROVIDERS: Record<string, SupplierProvider> = {
  sculpteo: sculpteoProvider,
};

/** Returns null for "manual" suppliers or an unrecognized api_provider key — never throws. */
export function getSupplierProvider(apiProviderKey: string | null): SupplierProvider | null {
  if (!apiProviderKey) return null;
  return PROVIDERS[apiProviderKey] ?? null;
}

export function listProviderKeys(): string[] {
  return Object.keys(PROVIDERS);
}
