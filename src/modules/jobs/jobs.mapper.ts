export {
  isJobStale,
  serializeJobCard,
  serializeJobDetail
} from "@/shared/utils/job-presentation";
export { serializeProvidedFilters } from "@/shared/utils/filters";

export function hasSalaryOverlap(
  jobMin: number | null,
  jobMax: number | null,
  filterMin: number | undefined,
  filterMax: number | undefined
): boolean {
  if (filterMin === undefined && filterMax === undefined) {
    return true;
  }

  if (jobMin === null && jobMax === null) {
    return false;
  }

  const normalizedJobMin = jobMin ?? jobMax ?? 0;
  const normalizedJobMax = jobMax ?? jobMin ?? 0;

  if (filterMin !== undefined && normalizedJobMax < filterMin) {
    return false;
  }

  if (filterMax !== undefined && normalizedJobMin > filterMax) {
    return false;
  }

  return true;
}
