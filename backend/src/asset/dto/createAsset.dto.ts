import { IsEnum, IsOptional, IsString, IsUrl } from "class-validator";

export enum CreateAssetType {
  FILE = "FILE",
  TEXT = "TEXT",
  LINK = "LINK",
}

export class CreateAssetDTO {
  @IsEnum(CreateAssetType)
  type: CreateAssetType;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string;
}
