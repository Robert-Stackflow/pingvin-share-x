import {
  Clipboard,
  CreateClipboardAsset,
  CreateClipboardRoom,
  UpdateClipboardRoom,
} from "../types/clipboard.type";
import { FileUploadResponse } from "../types/File.type";
import { Asset } from "../types/asset.type";
import api from "./api.service";

const getMine = async (): Promise<Clipboard> => {
  return (await api.get("clipboards/me")).data;
};

const addMineAsset = async (
  asset: CreateClipboardAsset,
): Promise<Clipboard["assets"][number]> => {
  return (await api.post("clipboards/me/assets", asset)).data;
};

const uploadMineFile = async (
  chunk: Blob,
  file: {
    id?: string;
    name: string;
  },
  chunkIndex: number,
  totalChunks: number,
): Promise<FileUploadResponse & Partial<Asset>> => {
  return (
    await api.post("clipboards/me/assets", chunk, {
      headers: { "Content-Type": "application/octet-stream" },
      params: {
        type: "FILE",
        id: file.id,
        name: file.name,
        chunkIndex,
        totalChunks,
      },
    })
  ).data;
};

const downloadMineFileUrl = (assetId: string) => {
  return `${window.location.origin}/api/clipboards/me/assets/${assetId}/download`;
};

const removeMineAsset = async (assetId: string) => {
  await api.delete(`clipboards/me/assets/${assetId}`);
};

const listRooms = async (): Promise<Clipboard[]> => {
  return (await api.get("clipboards/rooms")).data;
};

const createRoom = async (room: CreateClipboardRoom): Promise<Clipboard> => {
  return (await api.post("clipboards/rooms", room)).data;
};

const updateRoom = async (
  roomId: string,
  room: UpdateClipboardRoom,
): Promise<Clipboard> => {
  return (await api.patch(`clipboards/rooms/${roomId}`, room)).data;
};

const removeRoom = async (roomId: string) => {
  await api.delete(`clipboards/rooms/${roomId}`);
};

const getRoom = async (roomId: string): Promise<Clipboard> => {
  return (await api.get(`clipboards/rooms/${roomId}`)).data;
};

const verifyRoom = async (roomId: string, passcode?: string) => {
  return (await api.post(`clipboards/rooms/${roomId}/verify`, { passcode }))
    .data;
};

const addRoomAsset = async (
  roomId: string,
  asset: CreateClipboardAsset,
): Promise<Clipboard["assets"][number]> => {
  return (await api.post(`clipboards/rooms/${roomId}/assets`, asset)).data;
};

const uploadRoomFile = async (
  roomId: string,
  chunk: Blob,
  file: {
    id?: string;
    name: string;
  },
  chunkIndex: number,
  totalChunks: number,
): Promise<FileUploadResponse & Partial<Asset>> => {
  return (
    await api.post(`clipboards/rooms/${roomId}/assets`, chunk, {
      headers: { "Content-Type": "application/octet-stream" },
      params: {
        type: "FILE",
        id: file.id,
        name: file.name,
        chunkIndex,
        totalChunks,
      },
    })
  ).data;
};

const downloadRoomFileUrl = (roomId: string, assetId: string) => {
  return `${window.location.origin}/api/clipboards/rooms/${roomId}/assets/${assetId}/download`;
};

const removeRoomAsset = async (roomId: string, assetId: string) => {
  await api.delete(`clipboards/rooms/${roomId}/assets/${assetId}`);
};

export default {
  getMine,
  addMineAsset,
  uploadMineFile,
  downloadMineFileUrl,
  removeMineAsset,
  listRooms,
  createRoom,
  updateRoom,
  removeRoom,
  getRoom,
  verifyRoom,
  addRoomAsset,
  uploadRoomFile,
  downloadRoomFileUrl,
  removeRoomAsset,
};
