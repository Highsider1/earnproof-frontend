export type TermsSection = {
  id: string;
  heading: string;
  body: string;
};

export const termsSections: TermsSection[] = [
  {
    id: "acceptance",
    heading: "1. Acceptance of Terms",
    body: "By accessing or using EarnProof (the \"Service\"), you agree to be bound by these Terms of Use (\"Terms\"). If you do not agree to all of these Terms, do not access or use the Service. These Terms constitute a legally binding agreement between you and Veridatum Labs (\"we\", \"us\", or \"our\"). Your continued use of the Service after any modifications to these Terms constitutes your acceptance of the revised Terms.",
  },
  {
    id: "eligibility",
    heading: "2. Eligibility",
    body: "You must be at least 18 years of age and have the legal capacity to enter into a binding contract to use the Service. By using EarnProof you represent and warrant that you meet these requirements. If you are using the Service on behalf of an organisation, you represent that you have the authority to bind that organisation to these Terms, and references to \"you\" include both you personally and that organisation.",
  },
  {
    id: "user-obligations",
    heading: "3. User Obligations",
    body: "You agree to (a) provide accurate, current, and complete information when connecting your wallet or generating proofs; (b) maintain the confidentiality of any credentials or cryptographic keys associated with your account; (c) promptly notify us if you become aware of any unauthorised use of your wallet or account; (d) use the Service only for lawful purposes and in accordance with these Terms; and (e) comply with all applicable laws and regulations in your jurisdiction, including those relating to privacy, data protection, and financial services.",
  },
  {
    id: "prohibited-use",
    heading: "4. Prohibited Use",
    body: "You must not use the Service to: (a) submit false, misleading, or fraudulent attestations or proofs; (b) impersonate any person or entity, or misrepresent your affiliation with any person or entity; (c) interfere with or disrupt the integrity or performance of the Service or its underlying infrastructure; (d) attempt to gain unauthorised access to any part of the Service or its related systems; (e) use automated tools (bots, scrapers, crawlers) to access the Service without our prior written consent; (f) engage in any activity that violates applicable law, including sanctions regulations, anti-money-laundering requirements, or securities laws; or (g) reverse-engineer, decompile, or disassemble any component of the Service.",
  },
  {
    id: "liability",
    heading: "5. Disclaimers and Limitation of Liability",
    body: "THE SERVICE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. We do not warrant that the Service will be uninterrupted, error-free, or free of harmful components. Proofs generated through EarnProof are cryptographic attestations of on-chain data at a specific point in time; they do not constitute financial, legal, or investment advice. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, VERIDATUM LABS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.",
  },
  {
    id: "termination",
    heading: "6. Termination",
    body: "We reserve the right to suspend or terminate your access to the Service at any time, with or without cause, and with or without notice. You may stop using the Service at any time. Upon termination, all licences and rights granted to you under these Terms will immediately cease. Sections 5, 7, and 8 of these Terms will survive any termination.",
  },
  {
    id: "governing-law",
    heading: "7. Governing Law",
    body: "These Terms are governed by and construed in accordance with the laws of the jurisdiction in which Veridatum Labs is incorporated, without regard to its conflict-of-law provisions. Any dispute arising out of or relating to these Terms or the Service shall be subject to the exclusive jurisdiction of the courts located in that jurisdiction. If any provision of these Terms is held to be invalid or unenforceable, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.",
  },
  {
    id: "changes",
    heading: "8. Changes to These Terms",
    body: "We may update these Terms from time to time. When we do, we will revise the effective date shown on this page. For material changes we will make reasonable efforts to provide notice — for example, by posting a notice on the Service. Your continued use of the Service after the effective date of revised Terms constitutes your acceptance of those changes. If you do not agree to the updated Terms, you must stop using the Service.",
  },
];
