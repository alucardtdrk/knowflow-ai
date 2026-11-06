export type Actor = { userId: string };
export type Scope = { organizationId: string; teamId: string };
export type TeamRole = "manager" | "member";
export type Source = {
  chunkId: string;
  documentId: string;
  title: string;
  location: string;
  excerpt: string;
};
export type RequestStatus = "open" | "in_progress" | "resolved" | "closed";
