import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "src/config/config.service";
import { Readable } from "stream";
import { AssetFileChunk, AssetStorageService } from "./asset.storage";

@Injectable()
export class AssetS3StorageService implements AssetStorageService {
  private readonly logger = new Logger(AssetS3StorageService.name);
  private multipartUploads: Record<
    string,
    {
      uploadId: string;
      parts: Array<{ ETag: string | undefined; PartNumber: number }>;
    }
  > = {};

  constructor(private config: ConfigService) {}

  async saveChunk(
    assetId: string,
    data: string | Buffer,
    chunk: AssetFileChunk,
  ) {
    const s3 = this.getS3Instance();
    const bucketName = this.config.get("s3.bucketName");
    const key = this.getAssetKey(assetId);

    try {
      if (chunk.index === 0) {
        const response = await s3.send(
          new CreateMultipartUploadCommand({
            Bucket: bucketName,
            Key: key,
          }),
        );

        if (!response.UploadId) {
          throw new InternalServerErrorException("S3 upload init failed");
        }

        this.multipartUploads[assetId] = {
          uploadId: response.UploadId,
          parts: [],
        };
      }

      const multipartUpload = this.multipartUploads[assetId];
      if (!multipartUpload) {
        throw new InternalServerErrorException("S3 upload session not found");
      }

      const partNumber = chunk.index + 1;
      const uploadPartResponse = await s3.send(
        new UploadPartCommand({
          Bucket: bucketName,
          Key: key,
          PartNumber: partNumber,
          UploadId: multipartUpload.uploadId,
          Body: this.toBuffer(data),
        }),
      );

      multipartUpload.parts.push({
        ETag: uploadPartResponse.ETag,
        PartNumber: partNumber,
      });

      if (chunk.index === chunk.total - 1) {
        await s3.send(
          new CompleteMultipartUploadCommand({
            Bucket: bucketName,
            Key: key,
            UploadId: multipartUpload.uploadId,
            MultipartUpload: {
              Parts: multipartUpload.parts.sort(
                (left, right) => left.PartNumber - right.PartNumber,
              ),
            },
          }),
        );

        delete this.multipartUploads[assetId];
      }
    } catch (error) {
      await this.abortUpload(assetId, bucketName, key);
      this.logger.error(error);
      throw error;
    }
  }

  async getSize(assetId: string): Promise<number> {
    const response = await this.getS3Instance().send(
      new HeadObjectCommand({
        Bucket: this.config.get("s3.bucketName"),
        Key: this.getAssetKey(assetId),
      }),
    );

    return response.ContentLength ?? 0;
  }

  async getStream(assetId: string): Promise<Readable> {
    const response = await this.getS3Instance().send(
      new GetObjectCommand({
        Bucket: this.config.get("s3.bucketName"),
        Key: this.getAssetKey(assetId),
      }),
    );

    return response.Body as Readable;
  }

  async copy(sourceAssetId: string, targetAssetId: string) {
    const bucketName = this.config.get("s3.bucketName");
    await this.getS3Instance().send(
      new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: `${bucketName}/${this.getAssetKey(sourceAssetId)}`,
        Key: this.getAssetKey(targetAssetId),
      }),
    );
  }

  async remove(assetId: string) {
    await this.abortUpload(
      assetId,
      this.config.get("s3.bucketName"),
      this.getAssetKey(assetId),
    );
    await this.getS3Instance().send(
      new DeleteObjectCommand({
        Bucket: this.config.get("s3.bucketName"),
        Key: this.getAssetKey(assetId),
      }),
    );
  }

  private async abortUpload(assetId: string, bucketName: string, key: string) {
    const upload = this.multipartUploads[assetId];
    if (!upload) return;

    try {
      await this.getS3Instance().send(
        new AbortMultipartUploadCommand({
          Bucket: bucketName,
          Key: key,
          UploadId: upload.uploadId,
        }),
      );
    } catch (error) {
      this.logger.warn(error);
    } finally {
      delete this.multipartUploads[assetId];
    }
  }

  private getS3Instance(): S3Client {
    const checksumCalculation =
      this.config.get("s3.useChecksum") === true ? null : "WHEN_REQUIRED";

    return new S3Client({
      endpoint: this.config.get("s3.endpoint"),
      region: this.config.get("s3.region"),
      credentials: {
        accessKeyId: this.config.get("s3.key"),
        secretAccessKey: this.config.get("s3.secret"),
      },
      forcePathStyle: this.config.get("s3.forcePathStyle"),
      requestChecksumCalculation: checksumCalculation,
      responseChecksumValidation: checksumCalculation,
    });
  }

  private getS3Path(): string {
    const configS3Path = this.config.get("s3.bucketPath");
    if (!configS3Path) return "";
    const normalized = `${configS3Path}`.replace(/^\/+|\/+$/g, "");
    return normalized ? `${normalized}/` : "";
  }

  private getAssetKey(assetId: string) {
    return `${this.getS3Path()}assets/${assetId}`;
  }

  private toBuffer(data: string | Buffer) {
    return Buffer.isBuffer(data) ? data : Buffer.from(data, "base64");
  }
}
