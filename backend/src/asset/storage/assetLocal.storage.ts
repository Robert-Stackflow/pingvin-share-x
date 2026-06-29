import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "src/config/config.service";
import { ASSET_DIRECTORY } from "src/constants";
import { createReadStream } from "fs";
import * as fs from "fs/promises";
import { Readable } from "stream";
import { AssetFileChunk, AssetStorageService } from "./asset.storage";

@Injectable()
export class AssetLocalStorageService implements AssetStorageService {
  constructor(private config: ConfigService) {}

  async saveChunk(
    assetId: string,
    data: string | Buffer,
    chunk: AssetFileChunk,
  ) {
    await fs.mkdir(ASSET_DIRECTORY, { recursive: true });

    const tmpPath = this.getTmpPath(assetId);
    let diskFileSize = 0;
    try {
      diskFileSize = (await fs.stat(tmpPath)).size;
    } catch {
      diskFileSize = 0;
    }

    const chunkSize = this.config.get("share.chunkSize");
    const expectedChunkIndex = Math.ceil(diskFileSize / chunkSize);
    if (expectedChunkIndex != chunk.index) {
      throw new BadRequestException({
        message: "Unexpected chunk index",
        error: "unexpected_chunk_index",
        expectedChunkIndex,
      });
    }

    await fs.appendFile(
      tmpPath,
      Buffer.isBuffer(data) ? data : Buffer.from(data, "base64"),
    );

    if (chunk.index === chunk.total - 1) {
      await fs.rename(tmpPath, this.getPath(assetId));
    }
  }

  async getSize(assetId: string): Promise<number> {
    return (await fs.stat(this.getPath(assetId))).size;
  }

  async getStream(assetId: string): Promise<Readable> {
    return createReadStream(this.getPath(assetId));
  }

  async copy(sourceAssetId: string, targetAssetId: string) {
    await fs.mkdir(ASSET_DIRECTORY, { recursive: true });
    await fs.copyFile(this.getPath(sourceAssetId), this.getPath(targetAssetId));
  }

  async remove(assetId: string) {
    await fs.rm(this.getPath(assetId), { force: true });
    await fs.rm(this.getTmpPath(assetId), { force: true });
  }

  private getPath(assetId: string) {
    return `${ASSET_DIRECTORY}/${assetId}`;
  }

  private getTmpPath(assetId: string) {
    return `${ASSET_DIRECTORY}/${assetId}.tmp-chunk`;
  }
}
