import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { getArticles } from '../../lib/content';
import { SITE_TITLE, SITE_DESCRIPTION } from '../../consts';
import { formatDate } from '../../lib/text';

/**
 * Open Graph images, rasterized at build time from a hand-written SVG.
 * `sharp` is already present as Astro's image dependency and never reaches the
 * browser, so this costs nothing at runtime.
 */
const WIDTH = 1200;
const HEIGHT = 630;

interface Card {
  title: string;
  subtitle: string;
  footer: string;
}

export async function getStaticPaths() {
  const articles = await getArticles();
  return [
    {
      params: { slug: 'default' },
      props: {
        card: { title: SITE_TITLE, subtitle: SITE_DESCRIPTION, footer: 'meth04.github.io' },
      },
    },
    ...articles.map((article) => ({
      params: { slug: article.id },
      props: {
        card: {
          title: article.data.title,
          subtitle: article.data.description,
          footer: `${SITE_TITLE} · ${formatDate(article.data.pubDate)}`,
        } satisfies Card,
      },
    })),
  ];
}

export const GET: APIRoute = async ({ props }) => {
  const card = props.card as Card;
  const png = await sharp(Buffer.from(svgFor(card)))
    .png({ compressionLevel: 9 })
    .toBuffer();
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};

function svgFor(card: Card): string {
  const titleLines = wrap(card.title, 26).slice(0, 3);
  const subtitleLines = wrap(card.subtitle, 62).slice(0, 3);
  const titleSize = titleLines.length > 2 ? 62 : 72;
  // Keep the block vertically balanced whatever the title length.
  const titleY = titleLines.length >= 3 ? 250 : titleLines.length === 2 ? 275 : 320;

  const title = titleLines
    .map(
      (line, i) =>
        `<tspan x="80" dy="${i === 0 ? 0 : titleSize * 1.16}">${escapeXml(line)}</tspan>`,
    )
    .join('');
  const subtitle = subtitleLines
    .map((line, i) => `<tspan x="80" dy="${i === 0 ? 0 : 40}">${escapeXml(line)}</tspan>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#fbfaf7"/>
  <rect x="0" y="0" width="${WIDTH}" height="10" fill="#b4552b"/>
  <path d="M80 92h56l-28 48Z" fill="none" stroke="#b4552b" stroke-width="7" stroke-linejoin="round"/>
  <text x="160" y="132" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#6d675e" letter-spacing="1.5">MATH IN MOTION</text>
  <text x="80" y="${titleY}" font-family="Georgia, 'Times New Roman', serif" font-size="${titleSize}" font-weight="bold" fill="#211f1c">${title}</text>
  <text x="80" y="455" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#45413b">${subtitle}</text>
  <text x="80" y="585" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#928b80">${escapeXml(card.footer)}</text>
</svg>`;
}

/** Greedy word wrap by character budget. */
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line.length === 0) line = word;
    else if (line.length + word.length + 1 <= maxChars) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
