export function normalize(text) {
  return text?.replace(/\s+/g, ' ').trim() ?? '';
}
