import { site } from '../data/site.js';

export function renderFooter() {
  const host = document.getElementById('site-footer');
  if (!host) return;
  host.className = 'site-footer is-dark';
  host.setAttribute('data-header', 'dark');
  host.innerHTML = `
    <div class="container">
      <div class="foot-cta">
        <h2 class="foot-cta__title display display-lg" data-reveal="lines">Let's talk about <em>your home.</em></h2>
        <div class="foot-cta__side" data-reveal="fade">
          <p class="muted measure-narrow">Whether you have a floor plan and a moodboard or only a move-in date, the first conversation is free and without obligation.</p>
          <a class="btn" href="contact.html"><span class="btn__dot"></span>${site.cta.label}</a>
        </div>
      </div>
      <div class="foot-grid">
        <div class="foot-col">
          <h4>Studio</h4>
          <ul>
            <li><a href="${site.contact.mapUrl}" target="_blank" rel="noopener">${site.contact.address.join('<br>')}</a></li>
            <li class="muted" style="margin-top:.75rem">${site.contact.hours.map((h) => `${h.days} · ${h.time}`).join('<br>')}</li>
          </ul>
        </div>
        <div class="foot-col">
          <h4>Navigate</h4>
          <ul>${[{ label: 'Home', href: 'index.html' }, ...site.nav].map(n => `<li><a href="${n.href}">${n.label}</a></li>`).join('')}</ul>
        </div>
        <div class="foot-col">
          <h4>Homes</h4>
          <ul>${site.homeTypes.map(t => `<li><a href="projects.html?type=${t}">${t}</a></li>`).join('')}</ul>
        </div>
        <div class="foot-col">
          <h4>Contact</h4>
          <ul>
            <li><a href="mailto:${site.contact.email}">${site.contact.email}</a></li>
            <li><a href="${site.contact.phoneHref}">${site.contact.phone}</a></li>
            <li><a href="${site.contact.whatsapp}" target="_blank" rel="noopener">WhatsApp</a></li>
            <li style="margin-top:.75rem">${site.contact.socials.map(s => `<a href="${s.href}">${s.label}</a>`).join(' &nbsp;/&nbsp; ')}</li>
          </ul>
        </div>
      </div>
      <div class="foot-bottom">
        <span>© ${new Date().getFullYear()} ${site.legalName}. L.A.B is a brand of ${site.legalName}.</span>
        <span>Concept v0.1 — not for publication</span>
      </div>
      <div class="foot-wordmark" aria-hidden="true">L.A.B</div>
    </div>`;
}
