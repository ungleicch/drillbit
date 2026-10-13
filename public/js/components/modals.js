/* ─── Modal System ────────────────────────────────────────────────────────── */
const Modal = {
  open(contentHTML, title = '') {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = (title ? `<h2 class="modal-title">${title}</h2>` : '') + contentHTML;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    // Focus first input
    setTimeout(() => {
      const first = content.querySelector('input, select, textarea');
      if (first) first.focus();
    }, 50);
  },

  isOpen() {
    const overlay = document.getElementById('modal-overlay');
    return overlay && !overlay.classList.contains('hidden');
  },

  close() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('hidden');
    document.getElementById('modal-content').innerHTML = '';
    document.body.style.overflow = '';
  },

  confirm(message, onConfirm, opts = {}) {
    const { confirmText = 'Delete', confirmClass = 'btn-danger', cancelText = 'Cancel' } = opts;
    Modal.open(`
      <p style="color:var(--text-secondary);margin-bottom:var(--sp-lg)">${message}</p>
      <div style="display:flex;gap:var(--sp-sm);justify-content:flex-end">
        <button class="btn btn-ghost" id="modal-cancel-btn">${cancelText}</button>
        <button class="btn ${confirmClass}" id="modal-confirm-btn">${confirmText}</button>
      </div>
    `, opts.title || 'Are you sure?');
    document.getElementById('modal-cancel-btn').onclick = Modal.close;
    document.getElementById('modal-confirm-btn').onclick = () => { Modal.close(); onConfirm(); };
  }
};

// Wire up close button and overlay click
document.getElementById('modal-close').addEventListener('click', Modal.close);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) Modal.close();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') Modal.close();
});
