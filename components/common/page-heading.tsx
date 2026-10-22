type PageHeadingProps = {
  eyebrow?: string;
  title: string;
  description: string;
};

export function PageHeading({ eyebrow, title, description }: PageHeadingProps) {
  return (
    <div className="w-full">
      {eyebrow ? (
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-2xl font-semibold leading-8 text-white sm:text-4xl sm:font-bold sm:leading-10">
        {title}
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-5 text-slate-300 sm:max-w-none">{description}</p>
    </div>
  );
}
