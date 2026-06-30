import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AssetType, ClipboardType, User } from "@prisma/client";
import * as argon from "argon2";
import * as crypto from "crypto";
import { customAlphabet } from "nanoid";
import { AccessControlDTO } from "src/accessPolicy/dto/accessControl.dto";
import { AccessPolicyService } from "src/accessPolicy/accessPolicy.service";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { AssetService } from "src/asset/asset.service";

const createRoomId = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-",
  8,
);

@Injectable()
export class ClipboardService {
  constructor(
    private prisma: PrismaService,
    private assetService: AssetService,
    private jwtService?: JwtService,
    private config?: ConfigService,
    private accessPolicyService?: AccessPolicyService,
  ) {}

  async getOrCreatePrivate(user: User) {
    const clipboard = await this.prisma.clipboard.findFirst({
      where: { ownerId: user.id, type: ClipboardType.PRIVATE },
      include: { assets: true },
    });

    if (clipboard) return clipboard;

    return this.prisma.clipboard.create({
      data: {
        type: ClipboardType.PRIVATE,
        owner: { connect: { id: user.id } },
      },
      include: { assets: true },
    });
  }

  async createRoom(
    data: {
      name?: string;
      passcode?: string;
      accessControl?: AccessControlDTO;
    },
    owner: User,
  ) {
    const room = await this.prisma.clipboard.create({
      data: {
        type: ClipboardType.ROOM,
        roomId: createRoomId(),
        name: data.name || null,
        passcodeHash: data.passcode ? await argon.hash(data.passcode) : null,
        owner: { connect: { id: owner.id } },
      },
      include: { assets: true },
    });

    if (data.accessControl) {
      await this.accessPolicyService?.upsertForRelation(
        { clipboardId: room.id },
        data.accessControl,
      );
    }

    return room;
  }

  async updateRoom(
    roomId: string,
    data: {
      name?: string | null;
      passcode?: string | null;
      accessControl?: AccessControlDTO;
    },
    owner: User,
  ) {
    await this.getOwnedRoom(roomId, owner.id);

    const room = await this.prisma.clipboard.update({
      where: { roomId },
      data: {
        ...(data.name !== undefined ? { name: data.name?.trim() || null } : {}),
        ...(data.passcode !== undefined
          ? {
              passcodeHash: data.passcode
                ? await argon.hash(data.passcode)
                : null,
            }
          : {}),
      },
      include: { assets: true },
    });

    if (data.accessControl) {
      await this.accessPolicyService?.upsertForRelation(
        { clipboardId: room.id },
        data.accessControl,
      );
    }

    return room;
  }

  async removeRoom(roomId: string, owner: User) {
    const room = await this.getOwnedRoom(roomId, owner.id);

    for (const asset of room.assets) {
      await this.assetService.remove(asset);
    }

    await this.prisma.clipboard.delete({ where: { roomId } });
  }

  async listRoomsByOwner(ownerId: string) {
    return this.prisma.clipboard.findMany({
      where: { ownerId, type: ClipboardType.ROOM },
      include: { assets: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getOwnedRoom(roomId: string, ownerId: string) {
    const room = await this.prisma.clipboard.findFirst({
      where: { roomId, ownerId, type: ClipboardType.ROOM },
      include: { assets: true },
    });

    if (!room) throw new NotFoundException("Clipboard room not found");
    return room;
  }

  async getRoom(roomId: string) {
    const room = await this.prisma.clipboard.findFirst({
      where: { roomId, type: ClipboardType.ROOM },
      include: { assets: true },
    });

    if (!room) throw new NotFoundException("Clipboard room not found");
    return room;
  }

  async getRoomForRead(roomId: string, token?: string) {
    const room = await this.getRoom(roomId);
    if (room.passcodeHash && !this.verifyRoomToken(room, token)) {
      throw new ForbiddenException("Room passcode required");
    }

    return this.toResponse(room);
  }

  async verifyRoomPasscode(roomId: string, passcode?: string) {
    const room = await this.getRoom(roomId);
    if (!room.passcodeHash) return this.generateRoomToken(room);
    if (!passcode) throw new ForbiddenException("Room passcode required");

    const isValid = await argon.verify(room.passcodeHash, passcode);
    if (!isValid) throw new ForbiddenException("Invalid room passcode");

    return this.generateRoomToken(room);
  }

  async addTextAsset(data: { content: string }, user: User) {
    const clipboard = await this.getOrCreatePrivate(user);
    return this.assetService.createText(data, user, clipboard);
  }

  async addLinkAsset(data: { url: string }, user: User) {
    const clipboard = await this.getOrCreatePrivate(user);
    return this.assetService.createLink(data, user, clipboard);
  }

  async addFileAsset(
    data: string,
    chunk: { index: number; total: number },
    file: { id?: string; name: string },
    user: User,
  ) {
    const clipboard = await this.getOrCreatePrivate(user);
    return this.assetService.createFile(data, chunk, file, user, clipboard);
  }

  async addAsset(
    data: { type: "TEXT" | "LINK"; content?: string; url?: string },
    user: User,
  ) {
    if (data.type === "TEXT") {
      return this.addTextAsset({ content: data.content }, user);
    }
    if (data.type === "LINK") {
      return this.addLinkAsset({ url: data.url }, user);
    }
    throw new BadRequestException("Unsupported clipboard asset type");
  }

  async addRoomAsset(
    roomId: string,
    data: { type: "TEXT" | "LINK"; content?: string; url?: string },
    user: User,
  ) {
    // Rooms are collaborative: any authenticated user who can reach the room
    // may contribute assets (deletion stays owner-only via getOwnedRoom).
    const room = await this.getRoom(roomId);
    if (data.type === "TEXT") {
      return this.assetService.createText(
        { content: data.content },
        user,
        room,
      );
    }
    if (data.type === "LINK") {
      return this.assetService.createLink({ url: data.url }, user, room);
    }
    throw new BadRequestException("Unsupported clipboard asset type");
  }

  async addRoomFileAsset(
    roomId: string,
    data: string,
    chunk: { index: number; total: number },
    file: { id?: string; name: string },
    user: User,
  ) {
    // Collaborative: any authenticated user may upload files to the room.
    const room = await this.getRoom(roomId);
    return this.assetService.createFile(data, chunk, file, user, room);
  }

  async getPrivateAssetDownloadStream(assetId: string, user: User) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        ownerId: user.id,
        type: AssetType.FILE,
        shareId: null,
      },
    });
    if (!asset?.clipboardId) throw new NotFoundException("Asset not found");

    const clipboard = await this.prisma.clipboard.findFirst({
      where: {
        id: asset.clipboardId,
        ownerId: user.id,
        type: ClipboardType.PRIVATE,
      },
    });
    if (!clipboard) throw new NotFoundException("Asset not found");

    return this.assetService.getDownloadStream(asset);
  }

  async removePrivateAsset(assetId: string, user: User) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        ownerId: user.id,
        shareId: null,
      },
    });
    if (!asset?.clipboardId) throw new NotFoundException("Asset not found");

    const clipboard = await this.prisma.clipboard.findFirst({
      where: {
        id: asset.clipboardId,
        ownerId: user.id,
        type: ClipboardType.PRIVATE,
      },
    });
    if (!clipboard) throw new NotFoundException("Asset not found");

    await this.assetService.remove(asset);
  }

  async getRoomAssetDownloadStream(
    roomId: string,
    assetId: string,
    token?: string,
  ) {
    const room = await this.getRoomForRead(roomId, token);
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        type: AssetType.FILE,
        clipboardId: room.id,
        shareId: null,
      },
    });
    if (!asset) throw new NotFoundException("Asset not found");

    return this.assetService.getDownloadStream(asset);
  }

  async removeRoomAsset(roomId: string, assetId: string, user: User) {
    const room = await this.getOwnedRoom(roomId, user.id);
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        clipboardId: room.id,
        shareId: null,
      },
    });
    if (!asset) throw new NotFoundException("Asset not found");

    await this.assetService.remove(asset);
  }

  toResponse<T extends { passcodeHash?: string | null }>(clipboard: T) {
    const { passcodeHash, ...response } = clipboard;
    return {
      ...response,
      hasPasscode: Boolean(passcodeHash),
    };
  }

  private generateRoomToken(room: {
    roomId: string;
    createdAt: Date;
    passcodeHash?: string | null;
  }) {
    const { jwtService, config } = this.getTokenDeps();
    return jwtService.sign(
      {
        clipboardRoomId: room.roomId,
        clipboardRoomCreatedAt: this.toUnixSeconds(room.createdAt),
        clipboardPasscodeSignature: this.getPasscodeSignature(
          room.passcodeHash,
        ),
      },
      {
        expiresIn: "24h",
        secret: config.get("internal.jwtSecret"),
      },
    );
  }

  private verifyRoomToken(
    room: {
      roomId: string;
      createdAt: Date;
      passcodeHash?: string | null;
    },
    token?: string,
  ) {
    if (!token) return false;

    try {
      const { jwtService, config } = this.getTokenDeps();
      const claims = jwtService.verify(token, {
        secret: config.get("internal.jwtSecret"),
      });

      return (
        claims.clipboardRoomId === room.roomId &&
        claims.clipboardRoomCreatedAt === this.toUnixSeconds(room.createdAt) &&
        claims.clipboardPasscodeSignature ===
          this.getPasscodeSignature(room.passcodeHash)
      );
    } catch {
      return false;
    }
  }

  private getPasscodeSignature(passcodeHash?: string | null) {
    const secret = this.config?.get("internal.jwtSecret") ?? "";
    return crypto
      .createHmac("sha512", secret)
      .update(passcodeHash ?? "")
      .digest("hex");
  }

  private toUnixSeconds(date: Date) {
    return Math.floor(new Date(date).getTime() / 1000);
  }

  private getTokenDeps() {
    if (!this.jwtService || !this.config) {
      throw new Error("Clipboard room token dependencies are not configured");
    }
    return { jwtService: this.jwtService, config: this.config };
  }
}
