import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { AccessControlDTO } from "src/accessPolicy/dto/accessControl.dto";
import { CreateShortLinkTargetType } from "./createShortLink.dto";

export class UpdateShortLinkDTO {
  @IsOptional()
  @IsEnum(CreateShortLinkTargetType)
  targetType?: CreateShortLinkTargetType;

  @IsOptional()
  @IsString()
  targetUrl?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AccessControlDTO)
  accessControl?: AccessControlDTO;
}
