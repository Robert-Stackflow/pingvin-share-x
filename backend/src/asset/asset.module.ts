import { Module } from "@nestjs/common";
import { ActivityModule } from "src/activity/activity.module";
import { ShortLinkModule } from "src/shortLink/shortLink.module";
import { AssetController } from "./asset.controller";
import { AssetService } from "./asset.service";
import { AssetLocalStorageService } from "./storage/assetLocal.storage";
import { AssetS3StorageService } from "./storage/assetS3.storage";

@Module({
  imports: [ActivityModule, ShortLinkModule],
  controllers: [AssetController],
  providers: [AssetService, AssetLocalStorageService, AssetS3StorageService],
  exports: [AssetService],
})
export class AssetModule {}
