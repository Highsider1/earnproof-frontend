import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { PublicShell } from "@/components/layout/public-shell";
import { VerifyScan } from "@/components/verification/verify-scan";

export const metadata = {
    title: "Scan proof | EarnProof",
    description: "Scan or enter an EarnProof QR proof to verify it publicly.",
};

export default function VerifyScanPage() {
    return (
        <PublicShell>
            <section className={pageContainer}>
                <PageHeading
                    title="Scan proof QR"
                    description="Use your camera to open a verification link securely."
                />
                <VerifyScan />
            </section>
        </PublicShell>
    );
}
