export function Card({ title, subtitle = "", body = "", className = "" }) {
  return `
    <section class="yx-card ${className}">
      <header class="yx-card__header">
        <h3>${title}</h3>
        ${subtitle ? `<p>${subtitle}</p>` : ""}
      </header>
      <div class="yx-card__body">${body}</div>
    </section>
  `;
}
