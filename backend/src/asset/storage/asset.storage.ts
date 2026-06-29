import { Readable } from "stream";

export type AssetFileChunk = {
  index: number;
  total: number;
};

export interface AssetStorageService {
  saveChunk(
    assetId: string,
    data: string | Buffer,
    chunk: AssetFileChunk,
  ): Promise<void>;
  getSize(assetId: string): Promise<number>;
  getStream(assetId: string): Promise<Readable>;
  copy(sourceAssetId: string, targetAssetId: string): Promise<void>;
  remove(assetId: string): Promise<void>;
}
