import React from "react";

export function Card({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="yx-card">
      <header className="yx-card__header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </header>
      <div className="yx-card__body">{children}</div>
    </section>
  );
}
