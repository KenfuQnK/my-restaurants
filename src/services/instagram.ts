const INSTAGRAM_EMBED_SCRIPT = 'https://www.instagram.com/embed.js';
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);
const RESERVED_PATHS = new Set([
  'about',
  'accounts',
  'direct',
  'explore',
  'legal',
  'p',
  'reel',
  'reels',
  'stories',
  'tv',
  'web',
]);

declare global {
  interface Window {
    instgrm?: {
      Embeds?: {
        process: () => void;
      };
    };
  }
}

let embedScriptPromise: Promise<void> | undefined;

export function preflightInstagramInput(input: string): string | undefined {
  let allowedHostError: string | undefined;
  let suspiciousDomain = false;

  for (const match of input.matchAll(/https?:\/\/[^\s<>"']+/giu)) {
    const candidate = cleanCandidate(match[0]);
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      continue;
    }

    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!INSTAGRAM_HOSTS.has(host)) {
      if (host.includes('instagram') || host.includes('instagr.am')) {
        suspiciousDomain = true;
      }
      continue;
    }

    const normalized = normalizeInstagramUrlForComparison(candidate);
    if (normalized) return undefined;
    allowedHostError =
      'El enlace de Instagram no corresponde a una publicación, Reel, vídeo o perfil compatible.';
  }

  if (allowedHostError) return allowedHostError;
  if (suspiciousDomain) {
    return 'El enlace parece imitar a Instagram, pero no pertenece a instagram.com.';
  }
  return undefined;
}

export function isTrustedInstagramEmbedHtml(
  html: string | undefined,
  normalizedUrl: string,
): html is string {
  if (!html || html.length > 120_000 || typeof document === 'undefined') return false;

  const template = document.createElement('template');
  template.innerHTML = html;
  const roots = Array.from(template.content.children);
  if (roots.length !== 1) return false;

  const root = roots[0];
  if (!(root instanceof HTMLElement) || !root.matches('blockquote.instagram-media')) {
    return false;
  }

  if (
    root.querySelector(
      'script, iframe, object, embed, form, input, button, link, meta, base, style',
    )
  ) {
    return false;
  }

  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('on') || /javascript\s*:|data\s*:\s*text\/html/i.test(value)) {
        return false;
      }
      if (name === 'src') return false;
      if (name === 'href' && !isAllowedEmbedLink(value)) return false;
    }
  }

  const permalink = root.getAttribute('data-instgrm-permalink');
  return (
    normalizeInstagramUrlForComparison(permalink ?? '') ===
    normalizeInstagramUrlForComparison(normalizedUrl)
  );
}

export async function processInstagramEmbeds(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  await loadInstagramEmbedScript();
  window.instgrm?.Embeds?.process();
}

function loadInstagramEmbedScript(): Promise<void> {
  if (window.instgrm?.Embeds?.process) return Promise.resolve();
  if (embedScriptPromise) return embedScriptPromise;

  embedScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${INSTAGRAM_EMBED_SCRIPT}"]`,
    );
    const script = existing ?? document.createElement('script');

    const complete = async () => {
      script.dataset.instagramEmbedLoaded = 'true';
      try {
        await waitForInstagramEmbedApi();
        resolve();
      } catch (error) {
        embedScriptPromise = undefined;
        reject(error);
      }
    };
    const fail = () => {
      embedScriptPromise = undefined;
      reject(new Error('No se ha podido cargar el script oficial de Instagram.'));
    };

    if (window.instgrm?.Embeds?.process || script.dataset.instagramEmbedLoaded === 'true') {
      void complete();
      return;
    }

    script.addEventListener('load', complete, { once: true });
    script.addEventListener('error', fail, { once: true });

    if (!existing) {
      script.async = true;
      script.defer = true;
      script.src = INSTAGRAM_EMBED_SCRIPT;
      script.dataset.instagramEmbedLoader = 'true';
      document.head.appendChild(script);
    }
  });

  return embedScriptPromise;
}

function waitForInstagramEmbedApi(): Promise<void> {
  if (window.instgrm?.Embeds?.process) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      if (window.instgrm?.Embeds?.process) {
        resolve();
        return;
      }
      attempts += 1;
      if (attempts >= 40) {
        reject(new Error('El script de Instagram no ha inicializado la API de embeds.'));
        return;
      }
      window.setTimeout(check, 100);
    };
    check();
  });
}

function normalizeInstagramUrlForComparison(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(cleanCandidate(value));
  } catch {
    return undefined;
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    !INSTAGRAM_HOSTS.has(host) ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  ) {
    return undefined;
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length === 2 && ['p', 'reel', 'tv'].includes(parts[0].toLowerCase())) {
    if (!/^[A-Za-z0-9_-]{3,80}$/.test(parts[1])) return undefined;
    return `https://www.instagram.com/${parts[0].toLowerCase()}/${parts[1]}/`;
  }

  if (
    parts.length === 1 &&
    !RESERVED_PATHS.has(parts[0].toLowerCase()) &&
    /^(?!.*\.\.)[A-Za-z0-9._]{1,30}$/.test(parts[0])
  ) {
    return `https://www.instagram.com/${parts[0]}/`;
  }

  return undefined;
}

function isAllowedEmbedLink(value: string): boolean {
  if (!value || value.startsWith('#')) return true;
  try {
    const url = new URL(value, 'https://www.instagram.com/');
    return url.protocol === 'https:' && INSTAGRAM_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function cleanCandidate(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/[)\]}>.,;!?¡¿]+$/u, '')
    .trim();
}
