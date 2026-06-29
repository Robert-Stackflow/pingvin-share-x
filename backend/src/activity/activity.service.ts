import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";

type ActivityInput = {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

type ActivityFilters = {
  action?: string;
  targetType?: string;
  from?: Date;
  to?: Date;
  limit?: number;
};

const DEFAULT_ACTIVITY_LIMIT = 100;
const MAX_ACTIVITY_LIMIT = 500;

@Injectable()
export class ActivityService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async record(input: ActivityInput) {
    return this.prisma.activityEvent.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ipHash: this.hashIp(input.ip),
        userAgent: this.truncate(input.userAgent, 500),
      },
    });
  }

  async listForUser(actorId: string, filters: ActivityFilters = {}) {
    return this.findMany({ actorId, ...filters });
  }

  async listAll(filters: ActivityFilters = {}) {
    return this.findMany(filters);
  }

  private async findMany(filters: ActivityFilters & { actorId?: string }) {
    const { actorId, action, targetType, from, to, limit } = filters;

    const where: {
      actorId?: string;
      action?: string;
      targetType?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};
    if (actorId) where.actorId = actorId;
    if (action) where.action = action;
    if (targetType) where.targetType = targetType;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    return this.prisma.activityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: this.resolveLimit(limit),
    });
  }

  private resolveLimit(limit?: number) {
    if (!limit || !Number.isFinite(limit) || limit <= 0) {
      return DEFAULT_ACTIVITY_LIMIT;
    }
    return Math.min(Math.floor(limit), MAX_ACTIVITY_LIMIT);
  }

  private hashIp(ip?: string | null) {
    if (!ip) return null;
    return crypto
      .createHmac("sha256", this.config.get("internal.jwtSecret"))
      .update(ip)
      .digest("hex");
  }

  private truncate(value?: string | null, maxLength = 500) {
    if (!value) return null;
    return value.length > maxLength ? value.slice(0, maxLength) : value;
  }
}
