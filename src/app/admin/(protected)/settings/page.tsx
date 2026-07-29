import { getSettings, getIntegrationStatuses } from "@/lib/admin/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export default async function AdminSettingsPage() {
  const [settings, integrations] = await Promise.all([
    getSettings(),
    Promise.resolve(getIntegrationStatuses()),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operational configuration. Integration keys and other secrets are never shown or edited
          here — they live in environment variables only.
        </p>
      </div>

      <section className="flex max-w-xl flex-col gap-5 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Business settings</h2>
        <SettingsForm settings={settings} />
      </section>

      <section className="flex max-w-xl flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Integrations</h2>
        <ul className="flex flex-col divide-y divide-border">
          {integrations.map((integration) => (
            <li key={integration.name} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <div>
                <p className="font-medium">{integration.name}</p>
                <p className="text-xs text-muted-foreground">{integration.description}</p>
              </div>
              <span
                className={
                  integration.configured
                    ? "shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
                    : "shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground"
                }
              >
                {integration.configured ? "Configured" : "Not configured"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex max-w-xl flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Timezone</h2>
        <p className="text-sm">Europe/Riga</p>
        <p className="text-xs text-muted-foreground">
          Fixed for all admin and email timestamps — not user-editable, to avoid inconsistent
          date/time display across the app.
        </p>
      </section>
    </div>
  );
}
