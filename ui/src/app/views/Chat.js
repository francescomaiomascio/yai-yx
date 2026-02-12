export function ChatView(state) {
  return `
    <section class="yx-chat-view">
      <div class="yx-chat-view__list">
        ${state.chat.messages.map((m) => `<div class="yx-chat-msg"><b>${m.role}</b><span>${escapeHtml(m.content)}</span></div>`).join("") || '<div class="yx-empty">No messages yet</div>'}
      </div>
      <div class="yx-input-row">
        <input id="yx-chat-input" placeholder="Type message" />
        <button id="yx-chat-send">Send</button>
      </div>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
