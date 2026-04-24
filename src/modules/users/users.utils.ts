import { normalizeWhitespace } from "@/shared/utils/text";

export { normalizeWhitespace } from "@/shared/utils/text";

export function toSkillSlug(name: string): string {
  return normalizeWhitespace(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
