import type { RequestHandler } from "express";

export type UserOnboardingStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";
export type UserSkillLevel = "BASIC" | "INTERMEDIATE" | "ADVANCED";
export type UserEmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "INTERNSHIP"
  | "CONTRACT"
  | "FREELANCE";
export type UserCareerStatus =
  | "FRESH_GRADUATE"
  | "EARLY_CAREER"
  | "CAREER_SWITCHER";

export type CurrentUserSkill = {
  id: string;
  name: string;
  level: UserSkillLevel | null;
};

export type CurrentUserExperience = {
  id: string;
  title: string;
  company: string | null;
  employmentType: UserEmploymentType | null;
  startDate: Date | null;
  endDate: Date | null;
  isCurrent: boolean;
  description: string | null;
};

export type CurrentUserEducation = {
  id: string;
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
};

export type CurrentUserProfileRecord = {
  careerStatus: UserCareerStatus | null;
  latestRole: string | null;
  summary: string | null;
  profilePhotoStorageKey: string | null;
  profilePhotoUrl: string | null;
  profilePhotoMimeType: string | null;
  profilePhotoSizeBytes: number | null;
};

export type CurrentUserRecord = {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: string | null;
  displayName: string | null;
  onboardingStatus: UserOnboardingStatus;
  createdAt: Date;
  updatedAt: Date;
  hasPreference: boolean;
  profile: CurrentUserProfileRecord | null;
  skills: CurrentUserSkill[];
  experience: CurrentUserExperience[];
  education: CurrentUserEducation[];
};

export type UpdateCurrentUserRecordInput = {
  username?: string;
  phoneNumber?: string;
  displayName?: string;
};

export type UpsertProfilePhotoInput = {
  storageKey: string;
  url?: string | null;
  mimeType: string;
  sizeBytes: number;
};

export type ReplaceUserSkillInput = {
  name: string;
  slug: string;
  level: UserSkillLevel | null;
};

export type ReplaceUserExperienceInput = {
  title: string;
  company: string | null;
  employmentType: UserEmploymentType | null;
  startDate: Date | null;
  endDate: Date | null;
  isCurrent: boolean;
  description: string | null;
};

export type ReplaceUserEducationInput = {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear: number | null;
  endYear: number | null;
};

export type UsersRepository = {
  findCurrentUserById(userId: string): Promise<CurrentUserRecord | null>;
  findUserByUsername(username: string): Promise<{ id: string } | null>;
  updateCurrentUser(
    userId: string,
    input: UpdateCurrentUserRecordInput
  ): Promise<void>;
  upsertProfilePhoto(
    userId: string,
    input: UpsertProfilePhotoInput
  ): Promise<void>;
  replaceSkills(userId: string, input: ReplaceUserSkillInput[]): Promise<void>;
  replaceExperience(
    userId: string,
    input: ReplaceUserExperienceInput[]
  ): Promise<void>;
  replaceEducation(
    userId: string,
    input: ReplaceUserEducationInput[]
  ): Promise<void>;
  updateOnboardingStatus(
    userId: string,
    onboardingStatus: UserOnboardingStatus
  ): Promise<void>;
};

export type UsersControllerDependencies = {
  repository: UsersRepository;
};

export type UsersRouterOptions = Partial<UsersControllerDependencies> & {
  authMiddleware?: RequestHandler;
};
