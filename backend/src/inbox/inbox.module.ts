import { Module } from "@nestjs/common";
import { AccessPolicyModule } from "src/accessPolicy/accessPolicy.module";
import { ActivityModule } from "src/activity/activity.module";
import { AssetModule } from "src/asset/asset.module";
import { ReverseShareModule } from "src/reverseShare/reverseShare.module";
import { InboxController, InboxSubmissionController } from "./inbox.controller";
import { InboxService } from "./inbox.service";

@Module({
  imports: [ActivityModule, AssetModule, ReverseShareModule, AccessPolicyModule],
  controllers: [InboxController, InboxSubmissionController],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}
