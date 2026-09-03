export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col justify-between gap-4 border-b pb-5 lg:flex-row lg:items-end">
      <div className="max-w-3xl">
        <p className="mb-1.5 font-extrabold text-primary text-xs uppercase tracking-[0.14em]">{eyebrow}</p>
        <h1 className="font-extrabold text-3xl leading-tight tracking-[-0.035em] md:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-[0.93rem] text-muted-foreground leading-6">{description}</p>
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </header>
  );
}
