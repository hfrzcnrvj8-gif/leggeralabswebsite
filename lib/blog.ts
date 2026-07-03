import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import { i18n, type Locale } from "@/i18n/config";

const BLOG_DIR = path.join(process.cwd(), "content/blog");
const WORDS_PER_MINUTE = 200;

export type PostFrontmatter = {
  title: string;
  metaDescription: string;
  date: string;
  excerpt?: string;
};

export type PostMeta = PostFrontmatter & {
  slug: string;
  readingTime: number;
};

export type Post = PostMeta & {
  contentHtml: string;
};

function listSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function resolvePostFile(slug: string, locale: Locale): string | null {
  const localized = path.join(BLOG_DIR, slug, `${locale}.md`);
  if (fs.existsSync(localized)) return localized;
  const fallback = path.join(BLOG_DIR, slug, `${i18n.defaultLocale}.md`);
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

function readingTimeFor(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function getAllSlugs(): string[] {
  return listSlugs();
}

export function getPostMeta(slug: string, locale: Locale): PostMeta | null {
  const file = resolvePostFile(slug, locale);
  if (!file) return null;
  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  const fm = data as PostFrontmatter;
  return {
    ...fm,
    slug,
    readingTime: readingTimeFor(content),
  };
}

export function getAllPosts(locale: Locale): PostMeta[] {
  return listSlugs()
    .map((slug) => getPostMeta(slug, locale))
    .filter((post): post is PostMeta => post !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getPost(
  slug: string,
  locale: Locale
): Promise<Post | null> {
  const file = resolvePostFile(slug, locale);
  if (!file) return null;
  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  const fm = data as PostFrontmatter;

  const processed = await remark()
    .use(remarkGfm)
    .use(remarkHtml)
    .process(content);

  return {
    ...fm,
    slug,
    readingTime: readingTimeFor(content),
    contentHtml: processed.toString(),
  };
}
