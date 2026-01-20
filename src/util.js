export function normalize(text) {
  return text?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';
}

export function fnv1a64(str) {
  let hash = 0xcbf29ce484222325n; // offset basis
  const prime = 0x100000001b3n;

  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }

  return hash;
}
