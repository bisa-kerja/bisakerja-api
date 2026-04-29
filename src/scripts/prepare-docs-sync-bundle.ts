import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_DOCS_ROOT = path.join(process.cwd(), "docs");
const BUNDLE_ROOT = path.join(process.cwd(), ".tmp", "docs-sync");

const INTERNAL_MARKDOWN_LINK_PATTERN =
  /\]\((?!https?:\/\/|mailto:|#|\/|data:)([^)\s]+\.md(?:#[^)]+)?)\)/g;

const normalized = await buildDocsSyncBundle();

console.log(
  `Prepared docs sync bundle at .tmp/docs-sync (${String(normalized)} markdown file(s) normalized to .mdx)`
);

async function buildDocsSyncBundle() {
  await rm(BUNDLE_ROOT, { recursive: true, force: true });
  await mkdir(path.dirname(BUNDLE_ROOT), { recursive: true });
  await cp(SOURCE_DOCS_ROOT, BUNDLE_ROOT, { recursive: true });

  const markdownFiles = await listMarkdownFiles(BUNDLE_ROOT);

  for (const markdownPath of markdownFiles) {
    await convertMarkdownToMdx(markdownPath);
  }

  return markdownFiles.length;
}

async function listMarkdownFiles(rootPath: string) {
  const files: string[] = [];
  const queue: string[] = [rootPath];

  while (queue.length > 0) {
    const currentPath = queue.shift();

    if (!currentPath) {
      continue;
    }

    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        queue.push(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

async function convertMarkdownToMdx(sourcePath: string) {
  const targetPath = sourcePath.slice(0, -3) + ".mdx";
  const sourceContent = await readFile(sourcePath, "utf8");
  const normalizedContent = rewriteInternalMarkdownLinks(sourceContent);

  await writeFile(targetPath, normalizedContent, "utf8");
  await rm(sourcePath);
}

function rewriteInternalMarkdownLinks(content: string) {
  return content.replace(
    INTERNAL_MARKDOWN_LINK_PATTERN,
    (fullMatch: string, link: string) => fullMatch.replace(link, toMdxLink(link))
  );
}

function toMdxLink(link: string) {
  const [filePath = "", hash = ""] = link.split("#");

  if (!filePath.endsWith(".md")) {
    return link;
  }

  const filePathToMdx = filePath.slice(0, -3) + ".mdx";

  if (hash.length === 0) {
    return filePathToMdx;
  }

  return `${filePathToMdx}#${hash}`;
}
