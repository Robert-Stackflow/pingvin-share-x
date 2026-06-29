import { Type } from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from "class-validator";
import { AccessControlDTO } from "src/accessPolicy/dto/accessControl.dto";

export enum CreateShortLinkTargetType {
  URL = "URL",
  INTERNAL_PATH = "INTERNAL_PATH",
}

export class CreateShortLinkDTO {
  @IsEnum(CreateShortLinkTargetType)
  targetType: CreateShortLinkTargetType;

  @IsString()
  targetUrl: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{3,64}$/)
  code?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AccessControlDTO)
  accessControl?: AccessControlDTO;
}
