const SMALL_WORDS = new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','in','of','up','vs']);

export function toTitleCase(s) {
  if (!s) return s;
  return s.split(' ').map((w, i) =>
    (i === 0 || !SMALL_WORDS.has(w.toLowerCase()))
      ? w.charAt(0).toUpperCase() + w.slice(1)
      : w.toLowerCase()
  ).join(' ');
}
