import { Type } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { AccessControlDTO } from "src/accessPolicy/dto/accessControl.dto";

export class CreateReverseShareDTO {
  @IsBoolean()
  sendEmailNotification: boolean;

  @IsString()
  maxShareSize: string;

  @IsString()
  shareExpiration: string;

  @Min(1)
  @Max(1000)
  maxUseCount: number;

  @IsBoolean()
  simplified: boolean;

  @IsBoolean()
  publicAccess: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AccessControlDTO)
  accessControl?: AccessControlDTO;
}
