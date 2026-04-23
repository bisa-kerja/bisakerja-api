import { prisma } from "@/shared/libs/prisma";
import type { PrismaTransaction } from "@/shared/libs/prisma";
import type {
  CurrentUserEducation,
  CurrentUserExperience,
  CurrentUserProfileRecord,
  CurrentUserRecord,
  CurrentUserSkill,
  ReplaceUserEducationInput,
  ReplaceUserExperienceInput,
  ReplaceUserSkillInput,
  UpdateCurrentUserRecordInput,
  UpsertProfilePhotoInput,
  UserOnboardingStatus,
  UsersRepository
} from "@/modules/users/users.types";

type PrismaClientLike = typeof prisma | PrismaTransaction;

export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly client: PrismaClientLike = prisma) {}

  async findCurrentUserById(userId: string): Promise<CurrentUserRecord | null> {
    const user = await this.client.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        userSkills: {
          include: { skill: true },
          orderBy: [{ createdAt: "asc" }]
        },
        experiences: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        educations: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        preference: {
          select: { id: true }
        }
      }
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      phoneNumber: user.phoneNumber,
      displayName: user.displayName,
      onboardingStatus: user.onboardingStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      hasPreference: user.preference !== null,
      profile: mapProfile(user.profile),
      skills: mapSkills(user.userSkills),
      experience: mapExperience(user.experiences),
      education: mapEducation(user.educations)
    };
  }

  async findUserByUsername(username: string): Promise<{ id: string } | null> {
    const user = await this.client.user.findUnique({
      where: { username },
      select: { id: true }
    });

    return user;
  }

  async updateCurrentUser(
    userId: string,
    input: UpdateCurrentUserRecordInput
  ): Promise<void> {
    await this.client.user.update({
      where: { id: userId },
      data: input
    });
  }

  async upsertProfilePhoto(
    userId: string,
    input: UpsertProfilePhotoInput
  ): Promise<void> {
    await this.client.userProfile.upsert({
      where: { userId },
      update: {
        profilePhotoStorageKey: input.storageKey,
        profilePhotoUrl: input.url ?? null,
        profilePhotoMimeType: input.mimeType,
        profilePhotoSizeBytes: input.sizeBytes
      },
      create: {
        userId,
        profilePhotoStorageKey: input.storageKey,
        profilePhotoUrl: input.url ?? null,
        profilePhotoMimeType: input.mimeType,
        profilePhotoSizeBytes: input.sizeBytes
      }
    });
  }

  async replaceSkills(
    userId: string,
    input: ReplaceUserSkillInput[]
  ): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.userSkill.deleteMany({
        where: { userId }
      });

      if (input.length === 0) {
        return;
      }

      const slugs = input.map((skill) => skill.slug);
      const existingSkills = await tx.skill.findMany({
        where: { slug: { in: slugs } },
        select: { slug: true }
      });
      const existingSlugs = new Set(existingSkills.map((skill) => skill.slug));
      const toCreate = input
        .filter((skill) => !existingSlugs.has(skill.slug))
        .map((skill) => ({
          name: skill.name,
          slug: skill.slug
        }));

      if (toCreate.length > 0) {
        await tx.skill.createMany({
          data: toCreate,
          skipDuplicates: true
        });
      }

      const persistedSkills = await tx.skill.findMany({
        where: { slug: { in: slugs } },
        select: { id: true, slug: true }
      });
      const skillIdBySlug = new Map(
        persistedSkills.map((skill) => [skill.slug, skill.id])
      );

      await tx.userSkill.createMany({
        data: input.flatMap((skill) => {
          const skillId = skillIdBySlug.get(skill.slug);
          if (!skillId) {
            return [];
          }
          return [
            {
              userId,
              skillId,
              level: skill.level
            }
          ];
        })
      });
    });
  }

  async replaceExperience(
    userId: string,
    input: ReplaceUserExperienceInput[]
  ): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.userExperience.deleteMany({
        where: { userId }
      });

      if (input.length === 0) {
        return;
      }

      await tx.userExperience.createMany({
        data: input.map((experience, index) => ({
          userId,
          title: experience.title,
          company: experience.company,
          employmentType: experience.employmentType,
          startDate: experience.startDate,
          endDate: experience.endDate,
          isCurrent: experience.isCurrent,
          description: experience.description,
          sortOrder: index
        }))
      });
    });
  }

  async replaceEducation(
    userId: string,
    input: ReplaceUserEducationInput[]
  ): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.userEducation.deleteMany({
        where: { userId }
      });

      if (input.length === 0) {
        return;
      }

      await tx.userEducation.createMany({
        data: input.map((education, index) => ({
          userId,
          institution: education.institution,
          degree: education.degree,
          fieldOfStudy: education.fieldOfStudy,
          startYear: education.startYear,
          endYear: education.endYear,
          sortOrder: index
        }))
      });
    });
  }

  async updateOnboardingStatus(
    userId: string,
    onboardingStatus: UserOnboardingStatus
  ): Promise<void> {
    await this.client.user.update({
      where: { id: userId },
      data: { onboardingStatus }
    });
  }
}

function mapProfile(
  profile: {
    careerStatus: CurrentUserProfileRecord["careerStatus"];
    latestRole: string | null;
    summary: string | null;
    profilePhotoStorageKey: string | null;
    profilePhotoUrl: string | null;
    profilePhotoMimeType: string | null;
    profilePhotoSizeBytes: number | null;
  } | null
): CurrentUserProfileRecord | null {
  if (!profile) {
    return null;
  }

  return {
    careerStatus: profile.careerStatus,
    latestRole: profile.latestRole,
    summary: profile.summary,
    profilePhotoStorageKey: profile.profilePhotoStorageKey,
    profilePhotoUrl: profile.profilePhotoUrl,
    profilePhotoMimeType: profile.profilePhotoMimeType,
    profilePhotoSizeBytes: profile.profilePhotoSizeBytes
  };
}

function mapSkills(
  userSkills: {
    skill: {
      id: string;
      name: string;
    };
    level: CurrentUserSkill["level"];
  }[]
): CurrentUserSkill[] {
  return userSkills.map((userSkill) => ({
    id: userSkill.skill.id,
    name: userSkill.skill.name,
    level: userSkill.level
  }));
}

function mapExperience(
  experiences: {
    id: string;
    title: string;
    company: string | null;
    employmentType: CurrentUserExperience["employmentType"];
    startDate: Date | null;
    endDate: Date | null;
    isCurrent: boolean;
    description: string | null;
  }[]
): CurrentUserExperience[] {
  return experiences.map((experience) => ({
    id: experience.id,
    title: experience.title,
    company: experience.company,
    employmentType: experience.employmentType,
    startDate: experience.startDate,
    endDate: experience.endDate,
    isCurrent: experience.isCurrent,
    description: experience.description
  }));
}

function mapEducation(
  educations: {
    id: string;
    institution: string;
    degree: string | null;
    fieldOfStudy: string | null;
    startYear: number | null;
    endYear: number | null;
  }[]
): CurrentUserEducation[] {
  return educations.map((education) => ({
    id: education.id,
    institution: education.institution,
    degree: education.degree,
    fieldOfStudy: education.fieldOfStudy,
    startYear: education.startYear,
    endYear: education.endYear
  }));
}
