import type { Request, Response } from "express";

import { successResponse } from "@/core/responses/response.formatter";
import type {
  PatchPreferencesInput,
  UpsertPreferencesInput
} from "@/modules/preferences/preferences.schema";
import { PreferencesService } from "@/modules/preferences/preferences.service";
import type {
  PreferenceRecord,
  PreferencesControllerDependencies
} from "@/modules/preferences/preferences.types";
import { emitAuditEvent } from "@/shared/observability/audit-event";

export class PreferencesController {
  private readonly service: PreferencesService;

  constructor(
    private readonly dependencies: PreferencesControllerDependencies
  ) {
    this.service = new PreferencesService(dependencies.repository);
  }

  getPreferences = async (req: Request, res: Response) => {
    const preference = await this.service.getPreferences(
      req.auth?.userId ?? ""
    );

    emitAuditEvent({
      action: "preferences.viewed",
      requestId: req.requestId,
      actorId: preference.userId,
      resourceType: "user_preference",
      resourceId: preference.id,
      result: "success"
    });

    res.json(
      successResponse(
        serializePreference(preference),
        "Preferences retrieved successfully"
      )
    );
  };

  upsertPreferences = async (req: Request, res: Response) => {
    const input = req.body as UpsertPreferencesInput;
    const existing = await this.service.getPreferenceContext(
      req.auth?.userId ?? ""
    );
    const preference = await this.service.upsertPreferences(
      req.auth?.userId ?? "",
      input
    );

    emitAuditEvent({
      action: existing ? "preferences.updated" : "preferences.created",
      requestId: req.requestId,
      actorId: preference.userId,
      resourceType: "user_preference",
      resourceId: preference.id,
      result: "success",
      metadata: {
        changedFields: [
          "careerStatus",
          "jobSeekingStatus",
          "targetRoles",
          "locations",
          "workTypes",
          "salaryExpectation",
          "emailNotificationsEnabled"
        ]
      }
    });

    res.json(
      successResponse(
        serializePreference(preference),
        "Preferences saved successfully"
      )
    );
  };

  patchPreferences = async (req: Request, res: Response) => {
    const input = req.body as PatchPreferencesInput;
    const preference = await this.service.patchPreferences(
      req.auth?.userId ?? "",
      input
    );

    emitAuditEvent({
      action:
        Object.keys(input).length === 1 &&
        Object.hasOwn(input, "emailNotificationsEnabled")
          ? "preferences.notification_toggle_updated"
          : "preferences.updated",
      requestId: req.requestId,
      actorId: preference.userId,
      resourceType: "user_preference",
      resourceId: preference.id,
      result: "success",
      metadata: { changedFields: Object.keys(input) }
    });

    res.json(
      successResponse(
        serializePreference(preference),
        "Preferences updated successfully"
      )
    );
  };
}

export function serializePreference(preference: PreferenceRecord) {
  return {
    id: preference.id,
    careerStatus: preference.careerStatus,
    jobSeekingStatus: preference.jobSeekingStatus,
    targetRoles: preference.targetRoles,
    locations: preference.locations,
    workTypes: preference.workTypes,
    salaryExpectation: preference.salaryExpectation,
    emailNotificationsEnabled: preference.emailNotificationsEnabled,
    createdAt: preference.createdAt.toISOString(),
    updatedAt: preference.updatedAt.toISOString()
  };
}
