export type ActivityEvent = {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  userAgent: string | null;
  createdAt: string;
};

export type ActivityFilters = {
  action?: string;
  targetType?: string;
  from?: string;
  to?: string;
  limit?: number;
};
