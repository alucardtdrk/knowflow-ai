import { describe, expect, it } from "vitest";
import {
  assertTeamAccess,
  assertInvitation,
  assertRequestAccess,
} from "@/lib/policy";

describe("team boundary", () => {
  const scope = { organizationId: "org-a", teamId: "team-a" };
  it("rejects a member of another organization or team", () => {
    expect(() =>
      assertTeamAccess(scope, {
        organizationId: "org-b",
        teamId: "team-a",
        role: "manager",
      }),
    ).toThrow();
    expect(() =>
      assertTeamAccess(scope, {
        organizationId: "org-a",
        teamId: "team-b",
        role: "manager",
      }),
    ).toThrow();
  });
  it("rejects a nonmember even when caller is an organization administrator", () => {
    expect(() => assertTeamAccess(scope, undefined)).toThrow();
  });
  it("allows members to read but only managers to manage", () => {
    const member = { ...scope, role: "member" as const };
    expect(() => assertTeamAccess(scope, member)).not.toThrow();
    expect(() => assertTeamAccess(scope, member, "manager")).toThrow();
    expect(() =>
      assertTeamAccess(scope, { ...scope, role: "manager" }, "manager"),
    ).not.toThrow();
  });
  it("revokes access when membership disappears", () => {
    expect(() => assertTeamAccess(scope, null)).toThrow();
  });
});

describe("invitations", () => {
  const invitation = {
    email: "maria@example.test",
    expiresAt: new Date("2030-01-02"),
    acceptedAt: null,
  };
  it("accepts only matching email, unused and unexpired invitations", () => {
    expect(() =>
      assertInvitation(
        invitation,
        "maria@example.test",
        new Date("2030-01-01"),
      ),
    ).not.toThrow();
    expect(() =>
      assertInvitation(
        invitation,
        "other@example.test",
        new Date("2030-01-01"),
      ),
    ).toThrow();
    expect(() =>
      assertInvitation(invitation, invitation.email, new Date("2030-01-02")),
    ).toThrow();
    expect(() =>
      assertInvitation(
        { ...invitation, acceptedAt: new Date() },
        invitation.email,
        new Date("2030-01-01"),
      ),
    ).toThrow();
  });
});

it("keeps requests private to their author and team managers", () => {
  expect(() => assertRequestAccess("alice", "bob", "member")).toThrow();
  expect(() => assertRequestAccess("alice", "alice", "member")).not.toThrow();
  expect(() => assertRequestAccess("alice", "bob", "manager")).not.toThrow();
});

it.each(["2020-01-01T00:00:00Z", "invalid-date"])(
  "rejects expired or invalid invitation dates returned as text: %s",
  (expiresAt) => {
    expect(() =>
      assertInvitation(
        { email: "test@example.test", expiresAt, acceptedAt: null },
        "test@example.test",
      ),
    ).toThrow();
  },
);
