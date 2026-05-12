import { ConflictError, NotFoundError } from "@/core/errors/app.error";
import { usersErrorCodes } from "@/modules/users/users.constants";
import type {
  CurrentUserRecord,
  ReplaceUserEducationInput,
  ReplaceUserExperienceInput,
  ReplaceUserSkillInput,
  UpdateCurrentUserRecordInput,
  UpsertProfilePhotoInput,
  UsersRepository
} from "@/modules/users/users.types";
import { computeOnboardingStatus } from "@/shared/utils/onboarding-status";

export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  async getCurrentUser(userId: string): Promise<CurrentUserRecord> {
    return this.refreshAndSyncOnboardingStatus(userId);
  }

  async updateCurrentUser(
    userId: string,
    input: UpdateCurrentUserRecordInput
  ): Promise<CurrentUserRecord> {
    const existing = await this.requireCurrentUser(userId);

    if (input.username && input.username !== existing.username) {
      const duplicate = await this.repository.findUserByUsername(
        input.username
      );

      if (duplicate && duplicate.id !== userId) {
        throw new ConflictError(
          "Username sudah terdaftar",
          usersErrorCodes.usernameAlreadyRegistered
        );
      }
    }

    await this.repository.updateCurrentUser(userId, input);
    return this.refreshAndSyncOnboardingStatus(userId);
  }

  async upsertProfilePhoto(
    userId: string,
    input: UpsertProfilePhotoInput
  ): Promise<CurrentUserRecord> {
    await this.requireCurrentUser(userId);
    await this.repository.upsertProfilePhoto(userId, {
      storageKey: input.storageKey,
      url: input.url ?? null,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes
    });
    return this.refreshAndSyncOnboardingStatus(userId);
  }

  async replaceSkills(
    userId: string,
    input: ReplaceUserSkillInput[]
  ): Promise<CurrentUserRecord> {
    await this.requireCurrentUser(userId);
    await this.repository.replaceSkills(userId, input);
    return this.refreshAndSyncOnboardingStatus(userId);
  }

  async replaceExperience(
    userId: string,
    input: ReplaceUserExperienceInput[]
  ): Promise<CurrentUserRecord> {
    await this.requireCurrentUser(userId);
    await this.repository.replaceExperience(userId, input);
    return this.refreshAndSyncOnboardingStatus(userId);
  }

  async replaceEducation(
    userId: string,
    input: ReplaceUserEducationInput[]
  ): Promise<CurrentUserRecord> {
    await this.requireCurrentUser(userId);
    await this.repository.replaceEducation(userId, input);
    return this.refreshAndSyncOnboardingStatus(userId);
  }

  private async requireCurrentUser(userId: string): Promise<CurrentUserRecord> {
    const user = await this.repository.findCurrentUserById(userId);

    if (!user) {
      throw new NotFoundError(
        "User tidak ditemukan",
        usersErrorCodes.userNotFound
      );
    }

    return user;
  }

  private async refreshAndSyncOnboardingStatus(
    userId: string
  ): Promise<CurrentUserRecord> {
    const user = await this.requireCurrentUser(userId);
    const onboardingStatus = computeOnboardingStatus({
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      phoneNumber: user.phoneNumber,
      hasPreference: user.hasPreference
    });

    if (user.onboardingStatus !== onboardingStatus) {
      await this.repository.updateOnboardingStatus(userId, onboardingStatus);
      user.onboardingStatus = onboardingStatus;
    }

    return user;
  }
}
