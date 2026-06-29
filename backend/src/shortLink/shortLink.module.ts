import { Module } from "@nestjs/common";
import { AccessPolicyModule } from "src/accessPolicy/accessPolicy.module";
import { ActivityModule } from "src/activity/activity.module";
import { ShortLinkController } from "./shortLink.controller";
import { ShortLinkService } from "./shortLink.service";

@Module({
  imports: [ActivityModule, AccessPolicyModule],
  controllers: [ShortLinkController],
  providers: [ShortLinkService],
  exports: [ShortLinkService],
})
export class ShortLinkModule {}
