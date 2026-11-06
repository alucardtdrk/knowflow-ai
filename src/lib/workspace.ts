import type { Scope, Source, TeamRole, RequestStatus } from "./types";
export type DocumentItem = {
  id: string;
  title: string;
  format: string;
  size: number;
  status: string;
  error: string | null;
  createdAt: string;
};
export type MessageItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  unavailableCount?: number;
};
export type ConversationItem = {
  preview?: string;
  id: string;
  title: string;
  messages: MessageItem[];
  steps: { id: string; instruction: string; result: string | null }[];
};
export type RequestItem = {
  id: string;
  title: string;
  summary: string;
  status: RequestStatus;
  authorId: string;
  authorName: string;
  assigneeId: string | null;
  createdAt: string;
  comments: { id: string; author: string; content: string }[];
};
export type WorkspaceData = {
  conversationPage?: number;
  conversationTotal?: number;
  invitations?: PendingInvitation[];
  scope: Scope;
  user: { id: string; name: string; email: string };
  role: TeamRole;
  isAdmin: boolean;
  organizationName: string;
  teamName: string;
  teamDescription: string;
  organizationTeams?: { id: string; name: string; joined: boolean }[];
  teams: (Scope & { name: string; organizationName: string })[];
  documents: DocumentItem[];
  conversations: ConversationItem[];
  requests: RequestItem[];
  members: { id: string; name: string; email: string; role: TeamRole }[];
};

export type PendingInvitation = {
  id: string;
  teamId: string;
  teamName: string;
  organizationName: string;
  role: TeamRole;
};
