import { site } from '../data/site.js';

/**
 * Enquiry form. Fields are proposed, not final.
 * In WordPress this would become a Gravity Forms / WPForms / Contact Form 7 form styled with the same classes.
 */
export function renderEnquiry(host, { compact = false } = {}) {
  if (!host) return;
  const pills = (name, opts) => `<div class="pills" role="group" aria-label="${name}">${opts.map((o, i) => `<label class="pill"><input type="radio" name="${name}" value="${o}" class="sr-only" ${i === 0 ? '' : ''}>${o}</label>`).join('')}</div>`;
  host.innerHTML = `
    <form class="form" novalidate>
      <div class="form__row form__row--2">
        <div class="field"><label for="f-name">Name</label><input id="f-name" name="name" type="text" placeholder="Your name" required autocomplete="name"></div>
        <div class="field"><label for="f-phone">Phone</label><input id="f-phone" name="phone" type="tel" placeholder="+65" autocomplete="tel"></div>
      </div>
      <div class="field"><label for="f-email">Email</label><input id="f-email" name="email" type="email" placeholder="you@example.com" required autocomplete="email"></div>
      <div class="field"><span class="field__label">Property type</span>${pills('propertyType', site.homeTypes)}</div>
      <div class="field"><span class="field__label">Property status</span>${pills('propertyStatus', ['New / key collection soon', 'Resale', 'Currently living in it'])}</div>
      ${compact ? '' : `
      <div class="form__row form__row--2">
        <div class="field"><label for="f-budget">Approximate budget <span class="optional">(optional)</span></label>
          <select id="f-budget" name="budget"><option value="">Select a range</option><option>Under S$30k</option><option>S$30k – S$60k</option><option>S$60k – S$100k</option><option>S$100k – S$200k</option><option>Above S$200k</option></select></div>
        <div class="field"><label for="f-timeline">Renovation timeline <span class="optional">(optional)</span></label>
          <select id="f-timeline" name="timeline"><option value="">Select a timeline</option><option>Within 3 months</option><option>3 – 6 months</option><option>6 – 12 months</option><option>Just exploring</option></select></div>
      </div>`}
      <div class="field"><label for="f-msg">Tell us about your home <span class="optional">(optional)</span></label><textarea id="f-msg" name="message" rows="3" placeholder="Floor plan, moodboard links, what matters most to you…"></textarea></div>
      <div class="form__foot">
        <button class="btn" type="submit"><span class="btn__dot"></span>Send enquiry</button>
        <p class="form__note">We reply within two working days. No obligation, no hard sell.</p>
      </div>
      <div class="form__success">
        <p class="display display-sm">Thank you. We'll be in touch shortly.</p>
        <p class="muted" style="margin-top:.75rem">Prototype only — nothing was sent. The production form will connect to email / CRM.</p>
      </div>
    </form>`;

  const form = host.querySelector('form');
  form.querySelectorAll('.pill input').forEach((inp) => {
    inp.addEventListener('change', () => {
      form.querySelectorAll(`input[name="${inp.name}"]`).forEach((i) => i.closest('.pill').classList.toggle('is-active', i.checked));
    });
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    form.querySelectorAll('[required]').forEach((f) => { const bad = !f.value.trim(); f.style.borderBottomColor = bad ? 'var(--signal)' : ''; if (bad) ok = false; });
    if (!ok) return;
    form.classList.add('is-sent');
  });
}
