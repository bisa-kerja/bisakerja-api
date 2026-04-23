export const usersErrorCodes = {
  userNotFound: "USER_NOT_FOUND",
  usernameAlreadyRegistered: "USERNAME_ALREADY_REGISTERED"
} as const;

export const allowedProfilePhotoMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp"
] as const;

export const maxProfilePhotoBytes = 5 * 1024 * 1024;
export const maxExperienceDescriptionLength = 2000;
