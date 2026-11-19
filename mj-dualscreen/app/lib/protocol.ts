import type { Scene } from "./model.ts";

export const CHANNEL_NAME = "the-hub-mj-dualscreen-v1";
export const PROTOCOL_VERSION = 1;

export type PlayerScreenSize = { width: number; height: number };

// Optional for compatibility with a player window opened before this update.
export function readPlayerScreenSize(value: unknown): PlayerScreenSize | null {
  if (!value || typeof value !== "object") return null;
  const { width, height } = value as Partial<PlayerScreenSize>;
  if (typeof width !== "number" || typeof height !== "number" ||
    !Number.isFinite(width) || !Number.isFinite(height) ||
    width < 1 || height < 1 || width > 16384 || height > 16384) return null;
  return { width, height };
}

export type ProtocolMessage =
  | { version: 1; type: "PLAYER_READY"; screenSize?: PlayerScreenSize }
  | { version: 1; type: "PING"; sentAt: number }
  | { version: 1; type: "PONG"; sentAt: number; screenSize?: PlayerScreenSize }
  | { version: 1; type: "STATE_SNAPSHOT"; scene: Scene | null }
  | { version: 1; type: "STATE_PATCH"; scene: Scene | null };

export function isProtocolMessage(value: unknown): value is ProtocolMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { version?: unknown; type?: unknown };
  if (candidate.version !== PROTOCOL_VERSION) return false;
  return [
    "PLAYER_READY",
    "PING",
    "PONG",
    "STATE_SNAPSHOT",
    "STATE_PATCH",
  ].includes(String(candidate.type));
}
