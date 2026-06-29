import { Type } from "class-transformer";
import {
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { AccessControlDTO } from "src/accessPolicy/dto/accessControl.dto";

export class CreateClipboardRoomDTO {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  passcode?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AccessControlDTO)
  accessControl?: AccessControlDTO;
}
