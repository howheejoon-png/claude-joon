/** Enquiry form: pill selection and an AJAX submit that degrades gracefully. */
export function initEnquiry() {
  document.querySelectorAll('[data-lab-enquiry]').forEach((form) => {
    form.querySelectorAll('.pill input').forEach((input) => {
      input.addEventListener('change', () => {
        form.querySelectorAll(`input[name="${input.name}"]`).forEach((other) => {
          other.closest('.pill')?.classList.toggle('is-active', other.checked);
        });
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      let valid = true;
      form.querySelectorAll('[required]').forEach((field) => {
        const bad = !field.value.trim();
        field.style.borderBottomColor = bad ? 'var(--signal)' : '';
        if (bad) valid = false;
      });
      if (!valid) return;

      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;

      const body = new FormData(form);
      body.append('action', 'lab_enquiry');
      body.append('nonce', window.LAB?.nonce ?? '');

      try {
        const res = await fetch(window.LAB.ajax, { method: 'POST', body, credentials: 'same-origin' });
        const json = await res.json();
        if (!json.success) throw new Error(json.data?.message || 'Request failed');
        form.classList.add('is-sent');
      } catch (err) {
        if (button) button.disabled = false;
        const note = form.querySelector('.form__note');
        if (note) {
          note.textContent = 'Sorry, that did not send. Please email us instead.';
          note.style.color = 'var(--signal)';
        }
      }
    });
  });
}
