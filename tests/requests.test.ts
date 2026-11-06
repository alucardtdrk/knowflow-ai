import { it, expect } from "vitest";
import { assertTransition } from "@/lib/policy";
it("reserves closure and reopen for author, proposed resolution for managers", () => {
  expect(() => assertTransition("alice", "bob", "manager", "closed")).toThrow();
  expect(() =>
    assertTransition("alice", "alice", "member", "closed"),
  ).not.toThrow();
  expect(() =>
    assertTransition("alice", "alice", "member", "resolved"),
  ).toThrow();
  expect(() =>
    assertTransition("alice", "bob", "manager", "resolved"),
  ).not.toThrow();
  expect(() => assertTransition("alice", "bob", "manager", "open")).toThrow();
});
