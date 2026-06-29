import { Expose, plainToClass } from "class-transformer";

type ActivityEventEntity = {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export class ActivityEventDTO {
  @Expose()
  id: string;

  @Expose()
  actorId: string | null;

  @Expose()
  action: string;

  @Expose()
  targetType: string;

  @Expose()
  targetId: string;

  @Expose()
  metadata: Record<string, unknown> | null;

  @Expose()
  userAgent: string | null;

  @Expose()
  createdAt: Date;

  from(entity: ActivityEventEntity) {
    // ipHash is intentionally excluded and never exposed.
    return plainToClass(
      ActivityEventDTO,
      {
        id: entity.id,
        actorId: entity.actorId ?? null,
        action: entity.action,
        targetType: entity.targetType,
        targetId: entity.targetId,
        metadata: this.parseMetadata(entity.metadata),
        userAgent: entity.userAgent ?? null,
        createdAt: entity.createdAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  fromList(entities: ActivityEventEntity[]) {
    return entities.map((entity) => this.from(entity));
  }

  private parseMetadata(metadata: string | null): Record<string, unknown> | null {
    if (!metadata) return null;
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  }
}
