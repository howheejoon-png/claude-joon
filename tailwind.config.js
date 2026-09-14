/** @type {import('tailwindcss').Config} */
module.exports = {
  // Mirrors what the Play CDN did at runtime: scan the document, default theme,
  // Preflight on. No customisation — the page's own <style> owns the palette.
  content: {
    files: ['./index.html'],
    // The scanner is a plain text match, so without this it also reads the
    // page's inline <style> and emits utilities for any word that happens to
    // look like a class name — `.visible`, `.grid`, `.border`. Those would sit
    // after the page's own rules and quietly win against a custom class of the
    // same name. Strip the stylesheet so only real markup is scanned.
    transform: {
      html: (content) => content.replace(/<style[\s\S]*?<\/style>/g, ''),
    },
  },
  theme: { extend: {} },
  plugins: [],
}
