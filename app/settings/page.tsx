import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { SettingsNavigation } from "@/components/settings/settings-navigation";
import { DisplayPreferencesForm } from "@/components/settings/display-preferences-form";
import { PublicShell } from "@/components/layout/public-shell";

export default function SettingsPage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10`}>
        <PageHeading
          description="Manage your organization settings, user access, and administrative preferences."
          eyebrow="Administration"
          title="Settings"
        />
        <SettingsNavigation />
        <div>
          <h2 className="text-xl font-semibold text-white">Display preferences</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            These preferences are stored on this device and applied immediately.
          </p>
          <div className="mt-4">
            <DisplayPreferencesForm />
          </div>
        </div>
      </section>
    </PublicShell>
  );
}