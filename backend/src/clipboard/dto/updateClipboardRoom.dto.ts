import { Type } from "class-transformer";
import {
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { AccessControlDTO } from "src/accessPolicy/dto/accessControl.dto";

export class UpdateClipboardRoomDTO {
  @IsOptional()
  @IsString()
  name?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(4)
  passcode?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AccessControlDTO)
  accessControl?: AccessControlDTO;
}
