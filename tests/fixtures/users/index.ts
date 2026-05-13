export type UserFixture = {
  id: string;
  email: string;
  emailVerifiedAt: string;
  name: string;
  role: "USER";
};

export const userFixtures = {
  testUser: {
    id: "user_test_001",
    email: "test.user@example.test",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    name: "Test User",
    role: "USER"
  },
  secondUser: {
    id: "user_test_002",
    email: "second.user@example.test",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    name: "Second User",
    role: "USER"
  },
  profileCompleteUser: {
    id: "user_test_003",
    email: "profile.complete@example.test",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    name: "Profile Complete User",
    role: "USER"
  }
} satisfies Record<string, UserFixture>;
