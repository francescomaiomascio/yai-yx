import "./skin/index.css";

export function bootstrapYX(root: HTMLElement): void {
  root.innerHTML = `
    <main style="padding: var(--space-4, 16px); background: var(--surface-bg, #0b0f14); color: var(--text-primary, #e6edf3); min-height: 100vh;">
      <h1 style="font-size: var(--font-size-xl, 1.5rem); margin: 0 0 var(--space-2, 8px) 0;">YX</h1>
      <p style="margin: 0; color: var(--text-muted, #9aa4af);">Skin pack loaded from canonical tokens.</p>
    </main>
  `;
}
