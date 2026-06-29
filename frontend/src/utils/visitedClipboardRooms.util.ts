import { Clipboard } from "../types/clipboard.type";

export type VisitedClipboardRoom = {
  hasPasscode?: boolean;
  lastVisitedAt: string;
  name?: string;
  roomId: string;
};

const visitedRoomsKey = "clipboard.visitedRooms";
const maxVisitedRooms = 12;

export const readVisitedClipboardRooms = (): VisitedClipboardRoom[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(visitedRoomsKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((room) => room?.roomId) : [];
  } catch {
    return [];
  }
};

export const rememberVisitedClipboardRoom = (room: Clipboard) => {
  if (typeof window === "undefined" || !room.roomId) return;

  const nextRoom: VisitedClipboardRoom = {
    roomId: room.roomId,
    name: room.name || undefined,
    hasPasscode: room.hasPasscode,
    lastVisitedAt: new Date().toISOString(),
  };
  const nextRooms = [
    nextRoom,
    ...readVisitedClipboardRooms().filter((item) => item.roomId !== room.roomId),
  ].slice(0, maxVisitedRooms);

  window.localStorage.setItem(visitedRoomsKey, JSON.stringify(nextRooms));
};
