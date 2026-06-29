import { IsEnum, IsOptional, IsString, IsUrl } from "class-validator";

export enum CreateClipboardAssetType {
  FILE = "FILE",
  TEXT = "TEXT",
  LINK = "LINK",
}

export class CreateClipboardAssetDTO {
  @IsEnum(CreateClipboardAssetType)
  type: CreateClipboardAssetType;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string;
}
