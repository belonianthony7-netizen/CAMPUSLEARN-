/** Only allow standard 11-character YouTube video IDs and known YouTube hosts. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);

export function youtubeVideoId(input: string | null | undefined): string | null {
  const text = input?.trim() ?? '';
  if (YOUTUBE_ID.test(text)) return text;
  if (!text || text.length > 1000) return null;
  try {
    const url = new URL(text);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    let candidate: string | null = null;
    if (SHORT_HOSTS.has(url.hostname) && parts.length === 1) candidate = parts[0];
    else if (YOUTUBE_HOSTS.has(url.hostname) && parts.length === 1 && parts[0] === 'watch') {
      const values = url.searchParams.getAll('v');
      candidate = values.length === 1 ? values[0] : null;
    } else if (YOUTUBE_HOSTS.has(url.hostname) && parts.length === 2 && ['embed','shorts','live','v'].includes(parts[0])) {
      candidate = parts[1];
    }
    return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
  } catch {return null;}
}

export function canonicalYoutubeUrl(url: string | null | undefined): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}
