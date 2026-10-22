import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { FormattingPreferences } from "@/components/settings/formatting-preferences";
import { PublicShell } from "@/components/layout/public-shell";

export default function PreferencesPage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10`}>
        <PageHeading
          description="Choose your language and time zone for how EarnProof displays dates, times, and numbers."
          eyebrow="Settings"
          title="Preferences"
        />
        <FormattingPreferences />
      </section>
    </PublicShell>
  );
}
