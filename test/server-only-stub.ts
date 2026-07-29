// Test-only stub for the "server-only" package. Real Next.js build/runtime
// still uses the real package (which throws if imported client-side) — this
// alias only applies under vitest, so server-only modules with mocked deps
// (e.g. src/lib/auth/claim-requests.ts) can be unit tested in a plain node
// environment.
export {};
