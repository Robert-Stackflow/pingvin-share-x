import { ActivityEvent, ActivityFilters } from "../types/activity.type";
import api from "./api.service";

const buildParams = (filters?: ActivityFilters) => {
  if (!filters) return undefined;
  const params: Record<string, string | number> = {};
  if (filters.action) params.action = filters.action;
  if (filters.targetType) params.targetType = filters.targetType;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.limit) params.limit = filters.limit;
  return Object.keys(params).length > 0 ? params : undefined;
};

const list = async (filters?: ActivityFilters): Promise<ActivityEvent[]> => {
  return (await api.get("activities", { params: buildParams(filters) })).data;
};

const listAll = async (filters?: ActivityFilters): Promise<ActivityEvent[]> => {
  return (await api.get("activities/all", { params: buildParams(filters) }))
    .data;
};

export default {
  list,
  listAll,
};
