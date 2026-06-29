import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AccessPolicyModule } from "src/accessPolicy/accessPolicy.module";
import { AssetModule } from "src/asset/asset.module";
import { ClipboardController } from "./clipboard.controller";
import { ClipboardService } from "./clipboard.service";

@Module({
  imports: [AssetModule, JwtModule.register({}), AccessPolicyModule],
  controllers: [ClipboardController],
  providers: [ClipboardService],
  exports: [ClipboardService],
})
export class ClipboardModule {}
