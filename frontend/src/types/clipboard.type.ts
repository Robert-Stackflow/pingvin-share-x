import { AccessControl } from "./accessControl.type";
import { Asset, CreateAsset } from "./asset.type";

export type ClipboardType = "PRIVATE" | "ROOM";

export type Clipboard = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  type: ClipboardType;
  ownerId?: string;
  roomId?: string;
  name?: string;
  hasPasscode?: boolean;
  assets: Asset[];
};

export type CreateClipboardRoom = {
  name?: string;
  passcode?: string;
  accessControl?: AccessControl;
};

export type UpdateClipboardRoom = {
  name?: string | null;
  passcode?: string | null;
  accessControl?: AccessControl;
};

export type CreateClipboardAsset = CreateAsset;
