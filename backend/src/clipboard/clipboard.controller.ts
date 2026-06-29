import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { User } from "@prisma/client";
import * as contentDisposition from "content-disposition";
import { Request, Response } from "express";
import { GetUser } from "src/auth/decorator/getUser.decorator";
import { ClipboardService } from "./clipboard.service";
import {
  CreateClipboardAssetDTO,
  CreateClipboardAssetType,
} from "./dto/createClipboardAsset.dto";
import { CreateClipboardRoomDTO } from "./dto/createClipboardRoom.dto";
import { UpdateClipboardRoomDTO } from "./dto/updateClipboardRoom.dto";
import { VerifyClipboardRoomDTO } from "./dto/verifyClipboardRoom.dto";

type CreateClipboardAssetQuery = {
  type?: string;
  id?: string;
  name?: string;
  chunkIndex?: string;
  totalChunks?: string;
};

@Controller("clipboards")
export class ClipboardController {
  constructor(private clipboardService: ClipboardService) {}

  @Get("me")
  @UseGuards(AuthGuard("jwt"))
  async getMine(@GetUser() user: User) {
    return this.sanitize(await this.clipboardService.getOrCreatePrivate(user));
  }

  @Post("me/assets")
  @UseGuards(AuthGuard("jwt"))
  async addMineAsset(
    @Query() query: CreateClipboardAssetQuery,
    @Body() body: CreateClipboardAssetDTO | string,
    @GetUser() user: User,
  ) {
    if (query.type === CreateClipboardAssetType.FILE) {
      if (!query.name || !query.chunkIndex || !query.totalChunks) {
        throw new BadRequestException("File asset upload metadata is required");
      }

      return this.clipboardService.addFileAsset(
        body as unknown as string,
        {
          index: parseInt(query.chunkIndex),
          total: parseInt(query.totalChunks),
        },
        { id: query.id, name: query.name },
        user,
      );
    }

    return this.clipboardService.addAsset(
      body as { type: "TEXT" | "LINK"; content?: string; url?: string },
      user,
    );
  }

  @Get("me/assets/:assetId/download")
  @UseGuards(AuthGuard("jwt"))
  async downloadMineAsset(
    @Res({ passthrough: true }) response: Response,
    @Param("assetId") assetId: string,
    @GetUser() user: User,
  ) {
    const file = await this.clipboardService.getPrivateAssetDownloadStream(
      assetId,
      user,
    );
    this.setFileHeaders(response, file.metaData);
    return new StreamableFile(file.file);
  }

  @Delete("me/assets/:assetId")
  @UseGuards(AuthGuard("jwt"))
  async removeMineAsset(
    @Param("assetId") assetId: string,
    @GetUser() user: User,
  ) {
    await this.clipboardService.removePrivateAsset(assetId, user);
  }

  @Get("rooms")
  @UseGuards(AuthGuard("jwt"))
  async listRooms(@GetUser() user: User) {
    return this.sanitizeMany(
      await this.clipboardService.listRoomsByOwner(user.id),
    );
  }

  @Post("rooms")
  @UseGuards(AuthGuard("jwt"))
  async createRoom(
    @Body() body: CreateClipboardRoomDTO,
    @GetUser() user: User,
  ) {
    return this.sanitize(await this.clipboardService.createRoom(body, user));
  }

  @Patch("rooms/:roomId")
  @UseGuards(AuthGuard("jwt"))
  async updateRoom(
    @Param("roomId") roomId: string,
    @Body() body: UpdateClipboardRoomDTO,
    @GetUser() user: User,
  ) {
    return this.sanitize(
      await this.clipboardService.updateRoom(roomId, body, user),
    );
  }

  @Delete("rooms/:roomId")
  @UseGuards(AuthGuard("jwt"))
  async removeRoom(@Param("roomId") roomId: string, @GetUser() user: User) {
    await this.clipboardService.removeRoom(roomId, user);
  }

  @Post("rooms/:roomId/assets")
  @UseGuards(AuthGuard("jwt"))
  async addRoomAsset(
    @Param("roomId") roomId: string,
    @Query() query: CreateClipboardAssetQuery,
    @Body() body: CreateClipboardAssetDTO | string,
    @GetUser() user: User,
  ) {
    if (query.type === CreateClipboardAssetType.FILE) {
      if (!query.name || !query.chunkIndex || !query.totalChunks) {
        throw new BadRequestException("File asset upload metadata is required");
      }

      return this.clipboardService.addRoomFileAsset(
        roomId,
        body as unknown as string,
        {
          index: parseInt(query.chunkIndex),
          total: parseInt(query.totalChunks),
        },
        { id: query.id, name: query.name },
        user,
      );
    }

    return this.clipboardService.addRoomAsset(
      roomId,
      body as { type: "TEXT" | "LINK"; content?: string; url?: string },
      user,
    );
  }

  @Get("rooms/:roomId/assets/:assetId/download")
  async downloadRoomAsset(
    @Res({ passthrough: true }) response: Response,
    @Param("roomId") roomId: string,
    @Param("assetId") assetId: string,
    @Req() request: Request,
  ) {
    const file = await this.clipboardService.getRoomAssetDownloadStream(
      roomId,
      assetId,
      request.cookies?.[this.getRoomTokenCookieName(roomId)],
    );
    this.setFileHeaders(response, file.metaData);
    return new StreamableFile(file.file);
  }

  @Delete("rooms/:roomId/assets/:assetId")
  @UseGuards(AuthGuard("jwt"))
  async removeRoomAsset(
    @Param("roomId") roomId: string,
    @Param("assetId") assetId: string,
    @GetUser() user: User,
  ) {
    await this.clipboardService.removeRoomAsset(roomId, assetId, user);
  }

  @Get("rooms/:roomId")
  async getRoom(@Param("roomId") roomId: string, @Req() request: Request) {
    return this.sanitize(
      await this.clipboardService.getRoomForRead(
        roomId,
        request.cookies?.[this.getRoomTokenCookieName(roomId)],
      ),
    );
  }

  @Post("rooms/:roomId/verify")
  async verifyRoom(
    @Param("roomId") roomId: string,
    @Body() body: VerifyClipboardRoomDTO,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = await this.clipboardService.verifyRoomPasscode(
      roomId,
      body.passcode,
    );
    response.cookie(this.getRoomTokenCookieName(roomId), token, {
      path: "/",
      httpOnly: true,
    });

    return { valid: true, token };
  }

  private sanitize<T extends object>(clipboard: T) {
    const { passcodeHash: _passcodeHash, ...response } = clipboard as T & {
      passcodeHash?: string | null;
      hasPasscode?: boolean;
    };
    return {
      ...response,
      hasPasscode: Boolean(_passcodeHash) || Boolean(response.hasPasscode),
    };
  }

  private sanitizeMany<T extends object>(clipboards: T[]) {
    return clipboards.map((clipboard) => this.sanitize(clipboard));
  }

  private getRoomTokenCookieName(roomId: string) {
    return `clipboard_room_${roomId}_token`;
  }

  private setFileHeaders(
    response: Response,
    file: {
      mimeType: string;
      name: string;
      size: string;
    },
  ) {
    response.set({
      "Content-Type": file.mimeType,
      "Content-Length": file.size,
      "Content-Security-Policy": "sandbox",
      "Content-Disposition": contentDisposition(file.name),
    });
  }
}
