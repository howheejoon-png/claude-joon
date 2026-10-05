/** Hero video: play only when visible, and never for reduced-motion visitors. */
export function initHeroVideo() {
  const video = document.querySelector('[data-hero-video]');
  if (!video) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    video.remove();
    return;
  }

  const fail = () => video.remove();
  video.addEventListener('error', fail);
  video.lastElementChild?.addEventListener('error', fail);
  video.addEventListener('canplay', () => {
    video.classList.add('is-ready');
    video.play().catch(fail);
  }, { once: true });

  video.load();

  new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!video.isConnected) return;
      e.isIntersecting ? video.play().catch(() => {}) : video.pause();
    });
  }, { threshold: 0.05 }).observe(video);
}
