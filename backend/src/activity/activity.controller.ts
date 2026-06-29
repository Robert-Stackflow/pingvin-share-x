import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { User } from "@prisma/client";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { AdministratorGuard } from "src/auth/guard/isAdmin.guard";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { ActivityService } from "./activity.service";
import { ActivityEventDTO } from "./dto/activityEvent.dto";

type ActivityQuery = {
  action?: string;
  targetType?: string;
  from?: string;
  to?: string;
  limit?: string;
};

@Controller("activities")
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Get()
  @UseGuards(JwtGuard)
  async list(@Query() query: ActivityQuery, @GetUser() user: User) {
    return new ActivityEventDTO().fromList(
      await this.activityService.listForUser(user.id, this.parseFilters(query)),
    );
  }

  @Get("all")
  @UseGuards(JwtGuard, AdministratorGuard)
  async listAll(@Query() query: ActivityQuery) {
    return new ActivityEventDTO().fromList(
      await this.activityService.listAll(this.parseFilters(query)),
    );
  }

  private parseFilters(query: ActivityQuery) {
    const filters: {
      action?: string;
      targetType?: string;
      from?: Date;
      to?: Date;
      limit?: number;
    } = {};

    if (query.action) filters.action = query.action;
    if (query.targetType) filters.targetType = query.targetType;

    const from = this.parseDate(query.from);
    if (from) filters.from = from;

    const to = this.parseDate(query.to);
    if (to) filters.to = to;

    const limit = this.parseLimit(query.limit);
    if (limit !== undefined) filters.limit = limit;

    return filters;
  }

  private parseDate(value?: string) {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private parseLimit(value?: string) {
    if (value === undefined) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
}
