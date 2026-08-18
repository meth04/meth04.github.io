/**
 * Language support.
 *
 * The site is bilingual at the level of articles: each article declares a
 * `lang`, readers can filter the archive by language, and an article that has
 * a translation links to it. Article-scoped interface text is translated here;
 * the global navigation stays in English because it is shared by both indexes.
 */
export const LANGUAGES = ['en', 'vi'] as const;
export type Lang = (typeof LANGUAGES)[number];

export const DEFAULT_LANG: Lang = 'en';

export function isLang(value: string): value is Lang {
  return (LANGUAGES as readonly string[]).includes(value);
}

/** Name of a language, written in that language. */
export const LANGUAGE_NAME: Record<Lang, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
};

/** Short badge shown on article cards. */
export const LANGUAGE_BADGE: Record<Lang, string> = {
  en: 'EN',
  vi: 'VI',
};

/** BCP 47 tag used for `<html lang>` and `hreflang`. */
export const LANGUAGE_TAG: Record<Lang, string> = {
  en: 'en',
  vi: 'vi',
};

/** Locale used for date formatting. */
const DATE_LOCALE: Record<Lang, string> = {
  en: 'en-GB',
  vi: 'vi-VN',
};

export function formatDateIn(date: Date, lang: Lang): string {
  return date.toLocaleDateString(DATE_LOCALE[lang], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

type Dictionary = {
  minRead: (minutes: number) => string;
  updatedOn: string;
  tags: string;
  contents: string;
  sections: (count: number) => string;
  previous: string;
  next: string;
  related: string;
  moreToCome: string;
  moreToComeBody: string;
  followFeed: string;
  checkArchive: string;
  draft: string;
  availableIn: (language: string) => string;
  noscriptFigure: string;
};

const DICTIONARIES: Record<Lang, Dictionary> = {
  en: {
    minRead: (m) => `${m} min read`,
    updatedOn: 'Updated',
    tags: 'Tags',
    contents: 'Contents',
    sections: (n) => `${n} sections`,
    previous: 'Previous',
    next: 'Next',
    related: 'Related reading',
    moreToCome: 'More to come',
    moreToComeBody: 'New pieces appear every few weeks —',
    followFeed: 'follow the feed',
    checkArchive: 'check the archive',
    draft: 'Draft — not yet published',
    availableIn: (language) => `Also available in ${language}`,
    noscriptFigure:
      'This figure is interactive and needs JavaScript. The caption above states the result it demonstrates, and the surrounding text derives it in full, so nothing mathematical is lost.',
  },
  vi: {
    minRead: (m) => `${m} phút đọc`,
    updatedOn: 'Cập nhật',
    tags: 'Thẻ',
    contents: 'Mục lục',
    sections: (n) => `${n} phần`,
    previous: 'Bài trước',
    next: 'Bài sau',
    related: 'Bài liên quan',
    moreToCome: 'Sắp có thêm',
    moreToComeBody: 'Bài mới xuất hiện sau mỗi vài tuần —',
    followFeed: 'theo dõi RSS',
    checkArchive: 'xem toàn bộ bài viết',
    draft: 'Bản nháp — chưa xuất bản',
    availableIn: (language) => `Cũng có bản ${language}`,
    noscriptFigure:
      'Hình này có tương tác và cần JavaScript. Phần chú thích ngay bên trên đã nêu kết quả mà hình minh hoạ, và phần chữ xung quanh chứng minh đầy đủ, nên không mất mát gì về mặt toán học.',
  },
};

export function t(lang: Lang): Dictionary {
  return DICTIONARIES[lang];
}
