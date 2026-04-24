import { normalizeWhitespace } from "@/shared/utils/text";

export {
  normalizeOptionalWhitespace,
  normalizeWhitespace
} from "@/shared/utils/text";

export function toPreferenceRoleKey(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}
