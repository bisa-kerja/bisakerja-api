export type OnboardingStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

export type OnboardingStatusInput = {
  emailVerified: boolean;
  displayName: string | null;
  phoneNumber: string | null;
  hasPreference: boolean;
};

export function computeOnboardingStatus(
  input: OnboardingStatusInput
): OnboardingStatus {
  const hasDisplayName = hasValue(input.displayName);
  const hasPhoneNumber = hasValue(input.phoneNumber);

  if (
    input.emailVerified &&
    hasDisplayName &&
    hasPhoneNumber &&
    input.hasPreference
  ) {
    return "COMPLETED";
  }

  if (
    input.emailVerified ||
    hasDisplayName ||
    hasPhoneNumber ||
    input.hasPreference
  ) {
    return "IN_PROGRESS";
  }

  return "PENDING";
}

function hasValue(value: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
