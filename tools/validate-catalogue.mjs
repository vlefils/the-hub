import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const items = JSON.parse(readFileSync(resolve(root, 'data/catalogue.json'), 'utf8'));
const expected = { distance: 25, melee: 10, module: 16, gadget: 12, implant: 36, mutation: 18 };

assert.equal(items.length, 117, 'Le catalogue doit couvrir les 117 références recensées.');
assert.equal(new Set(items.map((item) => item.id)).size, items.length, 'Les identifiants doivent être uniques.');
for (const [family, count] of Object.entries(expected)) {
  assert.equal(items.filter((item) => item.family === family).length, count, `Nombre inattendu pour ${family}.`);
}
for (const item of items) {
  assert.ok(item.id && item.name && item.summary && item.rules && item.price > 0, `Fiche incomplète : ${item.id}`);
  assert.ok(item.tier === 1 || item.tier === 2, `Tier invalide : ${item.id}`);
  assert.ok(item.image && existsSync(resolve(root, item.image)), `Illustration absente : ${item.id}`);
  if (item.archive) assert.ok(existsSync(resolve(root, item.archive)), `Archive absente : ${item.id}`);
  if (item.family === 'mutation') assert.ok(item.drawback, `Contrepartie absente : ${item.id}`);
  if (item.family === 'implant') assert.ok(Number.isInteger(item.charge), `Charge absente : ${item.id}`);
  if (item.family === 'distance') assert.ok(item.charger && item.reload, `Chargeur ou rechargement absent : ${item.id}`);
}

const named = (name) => items.find((item) => item.name === name);
assert.equal(named('Black Tip').price, 400);
assert.equal(named('Peau écailleuse').price, 500);
assert.equal(named('Corps sans seuil').price, 1500);
assert.match(named('Œil tactique').rules, /\+1/);
assert.match(named('Nerfs de prédation').rules, /\+5 initiative/);
assert.match(named('Volk HMG-8').rules, /\+2d6/);
assert.match(named('Queue préhenseuse de colonne').rules, /action bonus supplémentaire/);
assert.match(named('Doorbreaker D-2').rules, /repoussée de 1,50 m/);

console.log('Catalogue valide : 117 fiches, 117 illustrations, archives et décisions contrôlées.');
