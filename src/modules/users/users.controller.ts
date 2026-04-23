import type { Request, Response } from "express";

import { successResponse } from "@/core/responses/response.formatter";
import type { UsersControllerDependencies } from "@/modules/users/users.types";
import { UsersService } from "@/modules/users/users.service";
import type {
  ReplaceEducationInput,
  ReplaceExperienceInput,
  ReplaceSkillsInput,
  UpdateCurrentUserInput,
  UpsertProfilePhotoInput
} from "@/modules/users/users.schema";
import type { CurrentUserRecord } from "@/modules/users/users.types";
import { toSkillSlug } from "@/modules/users/users.utils";
import { emitAuditEvent } from "@/shared/observability/audit-event";

export class UsersController {
  private readonly service: UsersService;

  constructor(private readonly dependencies: UsersControllerDependencies) {
    this.service = new UsersService(dependencies.repository);
  }

  getCurrentUser = async (req: Request, res: Response) => {
    const user = await this.service.getCurrentUser(req.auth?.userId ?? "");

    emitAuditEvent({
      action: "users.profile_viewed",
      requestId: req.requestId,
      actorId: user.id,
      resourceType: "user",
      resourceId: user.id,
      result: "success"
    });

    res.json(
      successResponse(
        serializeCurrentUser(user),
        "Profile retrieved successfully"
      )
    );
  };

  patchCurrentUser = async (req: Request, res: Response) => {
    const user = await this.service.updateCurrentUser(
      req.auth?.userId ?? "",
      req.body as UpdateCurrentUserInput
    );

    emitAuditEvent({
      action: "users.profile_updated",
      requestId: req.requestId,
      actorId: user.id,
      resourceType: "user",
      resourceId: user.id,
      result: "success"
    });

    res.json(
      successResponse(
        serializeCurrentUser(user),
        "Profile updated successfully"
      )
    );
  };

  upsertProfilePhoto = async (req: Request, res: Response) => {
    const user = await this.service.upsertProfilePhoto(
      req.auth?.userId ?? "",
      req.body as UpsertProfilePhotoInput
    );

    emitAuditEvent({
      action: "users.profile_photo_updated",
      requestId: req.requestId,
      actorId: user.id,
      resourceType: "user",
      resourceId: user.id,
      result: "success"
    });

    res.json(
      successResponse(
        serializeCurrentUser(user),
        "Profile photo updated successfully"
      )
    );
  };

  replaceSkills = async (req: Request, res: Response) => {
    const input = req.body as ReplaceSkillsInput;
    const user = await this.service.replaceSkills(
      req.auth?.userId ?? "",
      input.skills.map((skill) => ({
        name: skill.name,
        slug: toSkillSlug(skill.name),
        level: skill.level ?? null
      }))
    );

    emitAuditEvent({
      action: "users.skills_replaced",
      requestId: req.requestId,
      actorId: user.id,
      resourceType: "user",
      resourceId: user.id,
      result: "success",
      metadata: { totalSkills: user.skills.length }
    });

    res.json(
      successResponse(serializeCurrentUser(user), "Skills updated successfully")
    );
  };

  replaceExperience = async (req: Request, res: Response) => {
    const input = req.body as ReplaceExperienceInput;
    const user = await this.service.replaceExperience(
      req.auth?.userId ?? "",
      input.experience.map((experience) => ({
        title: experience.title,
        company: experience.company ?? null,
        employmentType: experience.employmentType ?? null,
        startDate: experience.startDate ? new Date(experience.startDate) : null,
        endDate: experience.endDate ? new Date(experience.endDate) : null,
        isCurrent: experience.isCurrent,
        description: experience.description ?? null
      }))
    );

    emitAuditEvent({
      action: "users.experience_replaced",
      requestId: req.requestId,
      actorId: user.id,
      resourceType: "user",
      resourceId: user.id,
      result: "success",
      metadata: { totalExperience: user.experience.length }
    });

    res.json(
      successResponse(
        serializeCurrentUser(user),
        "Experience updated successfully"
      )
    );
  };

  replaceEducation = async (req: Request, res: Response) => {
    const input = req.body as ReplaceEducationInput;
    const user = await this.service.replaceEducation(
      req.auth?.userId ?? "",
      input.education.map((education) => ({
        institution: education.institution,
        degree: education.degree,
        fieldOfStudy: education.fieldOfStudy,
        startYear: education.startYear ?? null,
        endYear: education.endYear ?? null
      }))
    );

    emitAuditEvent({
      action: "users.education_replaced",
      requestId: req.requestId,
      actorId: user.id,
      resourceType: "user",
      resourceId: user.id,
      result: "success",
      metadata: { totalEducation: user.education.length }
    });

    res.json(
      successResponse(
        serializeCurrentUser(user),
        "Education updated successfully"
      )
    );
  };
}

export function serializeCurrentUser(user: CurrentUserRecord) {
  const profilePhoto =
    user.profile &&
    (user.profile.profilePhotoStorageKey ||
      user.profile.profilePhotoUrl ||
      user.profile.profilePhotoMimeType ||
      user.profile.profilePhotoSizeBytes !== null)
      ? {
          url: user.profile.profilePhotoUrl,
          mimeType: user.profile.profilePhotoMimeType,
          sizeBytes: user.profile.profilePhotoSizeBytes
        }
      : null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    phoneNumber: user.phoneNumber,
    displayName: user.displayName,
    profilePhoto,
    onboardingStatus: user.onboardingStatus,
    profile: {
      careerStatus: user.profile?.careerStatus ?? null,
      latestRole: user.profile?.latestRole ?? null,
      summary: user.profile?.summary ?? null
    },
    skills: user.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      level: skill.level
    })),
    experience: user.experience.map((experience) => ({
      id: experience.id,
      title: experience.title,
      company: experience.company,
      employmentType: experience.employmentType,
      startDate: experience.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: experience.endDate?.toISOString().slice(0, 10) ?? null,
      isCurrent: experience.isCurrent,
      description: experience.description
    })),
    education: user.education.map((education) => ({
      id: education.id,
      institution: education.institution,
      degree: education.degree,
      fieldOfStudy: education.fieldOfStudy,
      startYear: education.startYear,
      endYear: education.endYear
    })),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}
