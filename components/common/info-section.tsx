type InfoSectionProps = {
  title: string;
  items: string[];
};

export function InfoSection({ title, items }: InfoSectionProps) {
  return (
    <section className="border-t border-white/10 py-10">
      <h2 className="text-2xl font-semibold text-white">{title}</h2>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div
            className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-200"
            key={item}
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
