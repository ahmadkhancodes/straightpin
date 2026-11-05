import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex max-w-2xl flex-col gap-2">
        <h1 className="heading-5 text-text">{title}</h1>
        {description ? <p className="body-6 text-text-subtle">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Titled block inside a page: a bordered panel with a header row and a body. */
export function Panel({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-lg border border-border bg-surface">
      <div className="flex flex-col gap-2 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex max-w-xl flex-col gap-1">
          <h2 className="title-2 text-text">{title}</h2>
          {description ? <p className="body-6 text-text-subtle">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="h-px bg-border" aria-hidden />
      <div className="p-6">{children}</div>
    </section>
  );
}
