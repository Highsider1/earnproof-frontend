import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { PublicShell } from "@/components/layout/public-shell";
import { ContactForm } from "@/components/contact/contact-form";

export default function ContactPage() {
  return (
    <PublicShell>
      <div className={pageContainer}>
        <PageHeading
          title="Contact us"
          description="Send a message to the EarnProof team. We'll respond via email."
        />
        <ContactForm />
      </div>
    </PublicShell>
  );
}
