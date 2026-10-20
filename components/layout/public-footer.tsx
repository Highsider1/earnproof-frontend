import Link from "next/link";

const footerLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/developers", label: "Developers" },
  { href: "/verify", label: "Verify" },
  { href: "/status", label: "Status" },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
        <p>Veridatum Labs builds open infrastructure for verifiable financial data.</p>
        <nav className="flex flex-wrap gap-4">
          {footerLinks.map((link) => (
            <Link className="hover:text-white" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
