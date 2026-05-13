import type { RequestHandler } from "express";

import type {
  allowedCareerStatuses,
  allowedJobSeekingStatuses,
  allowedSalaryPeriods,
  allowedWorkTypes
} from "@/modules/preferences/preferences.constants";
import type {
  PatchPreferencesInput,
  UpsertPreferencesInput
} from "@/modules/preferences/preferences.schema";
import type { UserOnboardingStatus } from "@/modules/users";

export type PreferenceCareerStatus = (typeof allowedCareerStatuses)[number];
export type PreferenceJobSeekingStatus =
  (typeof allowedJobSeekingStatuses)[number];
export type PreferenceWorkType = (typeof allowedWorkTypes)[number];
export type PreferenceSalaryPeriod = (typeof allowedSalaryPeriods)[number];

export type PreferenceLocation = {
  province: string;
  city: string | null;
};

export type PreferenceSalaryExpectation = {
  min: number | null;
  max: number | null;
  currency: string;
  period: PreferenceSalaryPeriod;
};

export type PreferenceRecord = {
  id: string;
  userId: string;
  careerStatus: PreferenceCareerStatus;
  jobSeekingStatus: PreferenceJobSeekingStatus;
  targetRoles: string[];
  locations: PreferenceLocation[];
  workTypes: PreferenceWorkType[];
  salaryExpectation: PreferenceSalaryExpectation;
  emailNotificationsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PreferenceContext = {
  targetRoles: string[];
  locations: PreferenceLocation[];
  workTypes: PreferenceWorkType[];
  salaryExpectation: PreferenceSalaryExpectation;
};

export type PreferenceOnboardingState = {
  emailVerified: boolean;
  displayName: string | null;
  phoneNumber: string | null;
  onboardingStatus: UserOnboardingStatus;
};

export type PreferencesRepository = {
  findByUserId(userId: string): Promise<PreferenceRecord | null>;
  upsertForUser(
    userId: string,
    input: UpsertPreferencesInput
  ): Promise<PreferenceRecord>;
  findUserOnboardingState(
    userId: string
  ): Promise<PreferenceOnboardingState | null>;
  updateUserOnboardingStatus(
    userId: string,
    onboardingStatus: UserOnboardingStatus
  ): Promise<void>;
};

export type PreferencesControllerDependencies = {
  repository: PreferencesRepository;
};

export type PreferencesRouterOptions =
  Partial<PreferencesControllerDependencies> & {
    authMiddleware?: RequestHandler;
  };

export type MergedPreferenceInput = UpsertPreferencesInput;
export type PreferencePatchInput = PatchPreferencesInput;
