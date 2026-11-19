import assert from "node:assert/strict";
import test from "node:test";
import {
  PROTOCOL_VERSION,
  isProtocolMessage,
  readPlayerScreenSize,
} from "../app/lib/protocol.ts";

test("le protocole accepte les messages de synchronisation connus", () => {
  assert.equal(
    isProtocolMessage({
      version: PROTOCOL_VERSION,
      type: "STATE_SNAPSHOT",
      scene: null,
    }),
    true,
  );
  assert.equal(
    isProtocolMessage({ version: PROTOCOL_VERSION, type: "PLAYER_READY" }),
    true,
  );
});

test("le retour joueurs accepte un écran paysage ou portrait et les anciens messages", () => {
  assert.deepEqual(readPlayerScreenSize({ width: 1920, height: 1080 }), { width: 1920, height: 1080 });
  assert.deepEqual(readPlayerScreenSize({ width: 900, height: 1440 }), { width: 900, height: 1440 });
  assert.equal(readPlayerScreenSize(undefined), null);
  assert.equal(isProtocolMessage({ version: 1, type: "PONG", sentAt: 1 }), true);
});

test("un format d’écran invalide ne corrompt pas le cadrage du retour joueurs", () => {
  for (const size of [null, {}, { width: 0, height: 1080 }, { width: 1920, height: -1 },
    { width: Infinity, height: 1080 }, { width: NaN, height: 1080 }, { width: 1920, height: "1080" },
    { width: 1920, height: 20000 }]) assert.equal(readPlayerScreenSize(size), null);
});

test("le protocole rejette les versions ou événements inconnus", () => {
  assert.equal(isProtocolMessage({ version: 2, type: "PLAYER_READY" }), false);
  assert.equal(isProtocolMessage({ version: 1, type: "DELETE_ALL" }), false);
  assert.equal(isProtocolMessage(null), false);
});
