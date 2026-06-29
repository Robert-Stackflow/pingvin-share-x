import { IsOptional, IsString } from "class-validator";

export class VerifyClipboardRoomDTO {
  @IsOptional()
  @IsString()
  passcode?: string;
}
