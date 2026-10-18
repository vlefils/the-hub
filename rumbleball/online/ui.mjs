import { el, btn, field, select, money, metric, table, stats, xpProgress, fatigue, comparison } from '../career-components.mjs';
import { STRATEGIES, ROLES, INSTRUCTIONS } from '../data.mjs';
import { CATALOGUE, compilePlayer, salary, recruitmentPrice } from '../progression.mjs';
import { OPENINGS, openingDeployment } from '../openings.mjs';
import { deploymentEditor } from '../deployment-ui.mjs';
import { mountMatch } from '../ui.mjs';

const date = (value) => value ? new Date(value).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }) : 'Après le lancement de la ligue';
function input(type, label, value = '') { const node = el('input'); node.type = type; node.value = value; node.required = true; node.setAttribute('aria-label', label); return node; }

export async function mountOnline(root, config, connect) {
  root.replaceChildren();
  const top = el('div', 'rb-online-top'), back = el('a', 'rb-button', 'Carrière solo et exhibition'); back.href = './index.html';
  const identity = el('span', 'rb-muted'); top.append(back, identity);
  const notice = el('p', 'rb-error rb-online-notice'); notice.hidden = true; notice.setAttribute('role', 'alert');
  const content = el('div'), live = el('div', 'rb-online-live'); live.hidden = true;
  root.append(top, notice, content, live);
  let client, user, league, tab = 'Équipe', busy = false, polling = false, stopped = false, timer, view, frameKey, offset = 0;
  function message(text, error = true) { notice.textContent = text; notice.className = error ? 'rb-error rb-online-notice' : 'rb-muted rb-online-notice'; notice.hidden = false; }
  async function attempt(action) { if (busy) return; busy = true; notice.hidden = true; try { await action(); } catch (error) { message(error.message); } finally { busy = false; } }
  async function send(action, payload = {}, id = league?.id) {
    const result = await client.request(action, id, payload);
    if (result.league) { league = result.league; offset = Date.parse(league.serverTime) - Date.now(); renderLeague(); }
    return result;
  }
  function form(title, controls, submitLabel, action) {
    const node = el('form', 'rb-online-form'); node.append(el('h3', '', title), ...controls);
    const submit = el('button', 'rb-button rb-button-primary', submitLabel); submit.type = 'submit'; node.append(submit);
    node.addEventListener('submit', (event) => { event.preventDefault(); return attempt(async () => { submit.disabled = true; try { await action(); } finally { submit.disabled = false; } }); });
    return node;
  }
  if (!config.enabled) {
    content.append(el('section', 'rb-online-intro'));
    const intro = content.children[0];
    intro.append(el('p', 'rb-eyebrow', 'Ligues en ligne'), el('h2', '', 'Votre club. Une ligue. Rendez-vous à 20 h.'),
      el('p', '', 'Préparez votre équipe pendant la journée. À 20 h, heure de Paris, les compositions sont figées et les matchs s’enchaînent en direct, avec deux minutes de pause.'),
      el('p', '', 'La préparation peut être modifiée ou annulée jusqu’au verrouillage. Chaque journée verse 210 chromas, plus 100 en cas de victoire.'),
      el('p', 'rb-online-lock', 'Le multijoueur est en préparation. La connexion aux ligues ouvrira après l’activation du serveur.'));
    return { stop() {} };
  }
  function renderAuth(recovery = false) {
    content.replaceChildren(); live.hidden = true; identity.textContent = '';
    const email = input('email', 'Adresse e-mail'), password = input('password', 'Mot de passe'); password.minLength = 8; password.autocomplete = recovery ? 'new-password' : 'current-password'; email.autocomplete = 'email';
    const controls = recovery ? [field('Nouveau mot de passe', password)] : [field('Adresse e-mail', email), field('Mot de passe', password)];
    content.append(form(recovery ? 'Choisir un nouveau mot de passe' : 'Se connecter', controls, recovery ? 'Enregistrer le mot de passe' : 'Connexion', async () => {
      const result = recovery ? await client.auth.updateUser({ password: password.value }) : await client.auth.signInWithPassword({ email: email.value, password: password.value });
      if (result.error) throw result.error;
      user = result.data.user; await renderLobby();
    }));
    if (recovery) return;
    const actions = el('div', 'rb-online-actions');
    actions.append(btn('Créer un compte', () => attempt(async () => {
      if (!email.value || password.value.length < 8) throw new Error('Renseignez votre e-mail et un mot de passe d’au moins huit caractères.');
      const { data, error } = await client.auth.signUp({ email: email.value, password: password.value, options: { emailRedirectTo: new URL('./multi.html', location.href).href } });
      if (error) throw error;
      if (data.session) { user = data.user; await renderLobby(); } else message('Consultez votre e-mail pour confirmer le compte, puis connectez-vous ici.', false);
    })), btn('Mot de passe oublié', () => attempt(async () => {
      if (!email.value) throw new Error('Renseignez votre adresse e-mail.');
      const { error } = await client.auth.resetPasswordForEmail(email.value, { redirectTo: new URL('./multi.html?recovery=1', location.href).href });
      if (error) throw error; message('Si ce compte existe, un lien de récupération vous a été envoyé.', false);
    })));
    content.append(actions, el('p', 'rb-muted', 'Les comptes utilisent le même service Supabase que Riftbound Tracker. La session Rumbleball et les clubs sont séparés.'));
  }
  async function renderLobby() {
    league = null; live.hidden = true; view?.pause(); content.replaceChildren(); identity.replaceChildren(el('span', '', user.email ?? 'Connecté'), btn('Déconnexion', () => attempt(async () => { await client.auth.signOut(); user = null; renderAuth(); })));
    const { leagues } = await client.request('list');
    content.append(el('h2', '', 'Vos ligues'));
    const list = el('div', 'rb-online-actions');
    for (const item of leagues) list.append(btn(`${item.name} · ${item.members}/${item.capacity} clubs`, () => attempt(() => send('get', {}, item.id))));
    if (!leagues.length) list.append(el('p', 'rb-muted', 'Créez une ligue ou rejoignez celle de vos amis.'));
    content.append(list);
    const leagueName = input('text', 'Nom de la ligue'), clubName = input('text', 'Nom de votre club'), capacity = select({ 2: '2 clubs', 4: '4 clubs', 6: '6 clubs', 8: '8 clubs' }, 6), color = input('color', 'Couleur du club', '#35bdb3');
    const code = input('text', 'Code d’invitation'), joinName = input('text', 'Nom du club à inscrire'), joinColor = input('color', 'Couleur du club à inscrire', '#35bdb3');
    const columns = el('div', 'rb-online-columns');
    columns.append(form('Créer une ligue privée', [field('Nom de la ligue', leagueName), field('Votre club', clubName), field('Nombre de clubs', capacity), field('Maillots', color), el('p', 'rb-muted', 'Votre club commence avec six recrues de niveau 1 et 600 chromas après leurs contrats.')], 'Créer la ligue', () => send('create', { name: leagueName.value, clubName: clubName.value, capacity: Number(capacity.value), color: color.value })),
      form('Rejoindre sur invitation', [field('Code d’invitation', code), field('Votre club', joinName), field('Maillots', joinColor)], 'Rejoindre', () => send('join', { code: code.value.trim(), clubName: joinName.value, color: joinColor.value })));
    content.append(columns);
  }
  function action(label, command, payload, primary = false) { const b = btn(label, () => attempt(() => send(command, payload)), primary); b.disabled = league.locked; return b; }
  function renderLeague() {
    content.replaceChildren(); live.hidden = true;
    const c = league.club, heading = el('div', 'rb-online-identity'), copy = el('div');
    copy.append(el('p', 'rb-eyebrow', `${league.name} · saison ${league.season} · journée ${league.day + 1}`), el('h2', '', c.name));
    heading.append(copy, btn('Changer de ligue', () => attempt(renderLobby))); content.append(heading);
    const summary = el('div', 'rb-online-actions'); summary.append(metric('Solde prévu', money(c.balance)), metric('Prochains salaires', money(c.players.reduce((n, p) => n + salary(p), 0))), metric('Revenu / victoire', '210 / +100', 'chromas par journée'));
    content.append(summary, el('p', league.locked ? 'rb-online-lock' : 'rb-muted', league.locked ? 'Équipes verrouillées pour la soirée. La gestion rouvrira après la dernière rencontre.' : `Modifiable jusqu’au ${date(league.nextLockAt)} · heure de Paris.`));
    if (league.hasDraft) content.append(el('p', 'rb-muted', 'Préparation enregistrée. Vous pouvez encore la modifier ou annuler tous ses changements avant le verrouillage.'), action('Annuler la préparation', 'cancel', {}));
    if (league.status === 'lobby') {
      content.append(el('p', 'rb-muted', `${league.members.length}/${league.capacity} participants. Partagez ce code avec vos amis :`), el('p', 'rb-online-code', league.inviteCode));
      if (league.ownerId === user.id) { const start = action('Lancer la saison', 'start', {}, true); start.disabled = league.members.length !== league.capacity; content.append(start); }
    }
    const nav = el('nav', 'rb-online-nav'); nav.setAttribute('aria-label', 'Gestion de la ligue');
    for (const label of ['Équipe', 'Recrutement', 'Équipement', 'Ligue', 'Direct']) {
      const b = btn(label, () => { tab = label; frameKey = null; renderLeague(); }); b.setAttribute('aria-current', tab === label ? 'page' : 'false'); nav.append(b);
    }
    content.append(nav);
    const body = el('section'); content.append(body);
    if (tab === 'Équipe') renderTeam(body, c);
    if (tab === 'Recrutement') renderMarket(body, c);
    if (tab === 'Équipement') renderShop(body, c);
    if (tab === 'Ligue') {
      body.append(table(['Club', 'J', 'V', 'N', 'D', 'Points'], league.table.map((r) => [r.name, r.played, r.wins, r.draws, r.losses, r.points])));
      for (const f of league.upcoming) body.append(el('p', '', `${league.members.find((m) => m.userId === f.homeId)?.name} — ${league.members.find((m) => m.userId === f.awayId)?.name}`));
      for (const g of league.history.slice(-12).reverse()) body.append(el('p', 'rb-muted', `${date(g.endsAt)} · ${league.members.find((m) => m.userId === g.homeId)?.name} / ${league.members.find((m) => m.userId === g.awayId)?.name} · ${g.winnerId ? 'Victoire : ' + league.members.find((m) => m.userId === g.winnerId)?.name : 'Nul'}`));
    }
    if (tab === 'Direct') renderLive(body);
    // Read-only applies to forms as well as mutation buttons.
    if (league.locked) for (const tag of ['input', 'select', 'button']) for (const control of body.querySelectorAll(tag)) control.disabled = true;
  }
  function renderTeam(body, c) {
    const plans = select(STRATEGIES, c.strategy), opening = select(Object.fromEntries(Object.entries(OPENINGS).map(([id, v]) => [id, v.name])), c.opening), color = input('color', 'Maillots', c.kitColor);
    const lineup = [], assignments = {};
    const editor = deploymentEditor({ players: c.lineup.map((id, i) => ({ ...compilePlayer(c.players.find((p) => p.id === id), c.inventory), id, number: i + 1 })), positions: c.deployment, color: c.kitColor, disabled: league.locked });
    const controls = [field('Plan collectif', plans), field('Ouverture', opening), field('Maillots', color)];
    for (const [i, id] of c.lineup.entries()) {
      const row = el('div', 'rb-online-lineup'), choice = select(Object.fromEntries(c.players.map((p) => [p.id, p.name])), id), p = c.players.find((p) => p.id === id);
      const role = select(ROLES, p.role), instruction = select(INSTRUCTIONS, p.instruction);
      lineup.push(choice); assignments[i] = { role, instruction };
      row.append(field(`Titulaire ${i + 1}`, choice), field('Rôle', role), field('Consigne', instruction)); controls.push(row);
      choice.addEventListener('change', () => { const player = c.players.find((p) => p.id === choice.value); role.value = player.role; instruction.value = player.instruction;
        editor.update({ players: lineup.map((control, n) => ({ ...compilePlayer(c.players.find((p) => p.id === control.value), c.inventory), id: control.value, number: n + 1 })) }); });
    }
    opening.addEventListener('change', () => editor.update({ positions: openingDeployment(opening.value) }));
    controls.push(editor.root);
    body.append(form('Préparer les cinq titulaires', controls, 'Enregistrer la préparation', async () => {
      await send('configure', { lineup: lineup.map((s) => s.value), assignments: Object.fromEntries(lineup.map((s, i) => [s.value, { role: assignments[i].role.value, instruction: assignments[i].instruction.value }])), strategy: plans.value, opening: opening.value, deployment: editor.value, color: color.value });
    }));
    const roster = el('div', 'rb-online-roster');
    for (const p of c.players) {
      const row = el('div', 'rb-online-player'), copy = el('div'); copy.append(el('strong', '', p.name), el('small', 'rb-muted', stats(compilePlayer(p, c.inventory))), xpProgress(p), fatigue(p), el('small', 'rb-muted', `${salary(p)} chromas / journée · ${c.lineup.includes(p.id) ? 'Titulaire' : 'Remplaçant'}`));
      row.append(copy); if (c.players.length > 5) row.append(action(`Céder · ${money(recruitmentPrice(p) / 2)}`, 'sell', { playerId: p.id })); roster.append(row);
    }
    body.append(roster);
  }
  function renderMarket(body, c) {
    body.append(el('h3', '', 'Recrutement'), el('p', 'rb-muted', 'Les contrats de la préparation sont annulables avant 20 h. Les offres changent après chaque rencontre.'));
    for (const p of c.market) {
      const row = el('div', 'rb-online-player'), copy = el('div'), price = recruitmentPrice(p);
      copy.append(el('strong', '', p.name), el('small', 'rb-muted', stats(compilePlayer(p))), xpProgress(p)); row.append(copy);
      const buy = action(`Recruter · ${money(price)}`, 'recruit', { playerId: p.id });
      const blocked = c.balance < 0 ? 'Salaires impayés : achats bloqués.' : c.players.length >= 8 ? 'Huit joueurs maximum.' : c.balance < price ? `Il manque ${price - c.balance} chromas.` : '';
      if (blocked) { buy.disabled = true; row.append(el('small', 'rb-muted', blocked)); } row.append(buy); body.append(row);
    }
  }
  function renderShop(body, c) {
    const player = select(Object.fromEntries(c.players.map((p) => [p.id, p.name])), c.lineup[0]), catalog = el('div');
    body.append(field('Joueur à équiper', player), catalog);
    function draw() {
      catalog.replaceChildren(); const p = c.players.find((p) => p.id === player.value);
      catalog.append(el('p', '', `Protection : ${CATALOGUE[c.inventory.find((g) => g.playerId === p.id)?.itemId]?.name ?? 'Aucune'} · Implant : ${CATALOGUE[p.implant]?.name ?? 'Aucun'}`));
      for (const gear of c.inventory) catalog.append(action(`${CATALOGUE[gear.itemId].name} : attribuer`, 'equip', { itemId: gear.id, playerId: p.id }), action('Retirer', 'equip', { itemId: gear.id, playerId: null }), action(`Revendre · ${money(CATALOGUE[gear.itemId].price / 2)}`, 'sellProtection', { itemId: gear.id }));
      for (const [id, item] of Object.entries(CATALOGUE)) {
        const row = el('div', 'rb-online-player'), copy = el('div'), replace = input('checkbox', `Détruire l’ancien implant pour ${item.name}`); replace.required = false;
        const after = { ...p, implant: item.slot === 'implant' ? id : p.implant }, inventory = item.slot === 'protection' ? [...c.inventory.filter((g) => g.playerId !== p.id), { itemId: id, playerId: p.id }] : c.inventory;
        copy.append(el('strong', '', item.name), comparison(compilePlayer(p, c.inventory), compilePlayer(after, inventory), p.implant, after.implant)); row.append(copy);
        if (item.slot === 'implant' && p.implant) row.append(field('Remplacer détruit l’ancien implant', replace));
        const buy = btn(`Acheter · ${money(item.price)}`, () => attempt(async () => {
          if (item.slot === 'implant' && p.implant && !replace.checked) throw new Error('Confirmez la destruction de l’ancien implant avant le remplacement.');
          await send('buy', { itemId: id, playerId: p.id, replaceConfirmed: replace.checked });
        }));
        const blocked = c.balance < 0 ? 'Salaires impayés : achats bloqués.' : c.balance < item.price ? `Il manque ${item.price - c.balance} chromas.` : '';
        buy.disabled = league.locked || Boolean(blocked); if (blocked) copy.append(el('small', 'rb-muted', blocked)); row.append(buy); catalog.append(row);
      }
    }
    player.addEventListener('change', draw); draw();
  }
  function renderLive(body) {
    body.append(el('h3', '', 'La soirée en direct'));
    for (const g of league.games) body.append(el('p', '', `${g.startsAt ? date(g.startsAt) : 'Après le match précédent + 2 min'} · ${g.homeName} — ${g.awayName} · ${g.status === 'live' ? 'En direct' : g.status === 'finished' ? 'Terminé' : 'À suivre'}`));
    const frame = league.broadcast;
    if (!frame) { view?.pause(); body.append(el('p', 'rb-muted', league.waitingForServer ? 'Diffusion retardée : attente du serveur. Reconnexion automatique en cours.' : league.status === 'broadcast' ? 'Pause entre deux rencontres. Prochain coup d’envoi indiqué ci-dessus.' : `Prochaine soirée : ${date(league.nextLockAt)}.`)); return; }
    live.hidden = false; if (!view) view = mountMatch(live);
    const key = `${frame.id}:${frame.roundStartsAt}:${frame.turns.length}`;
    if (key !== frameKey) { frameKey = key; view.broadcast(frame, Math.max(0, Date.now() + offset - Date.parse(frame.roundStartsAt))); }
    if (!frame.turns.length) body.append(el('p', 'rb-online-lock', 'Coup d’envoi imminent…'));
  }
  async function poll() {
    if (stopped || polling) return;
    polling = true;
    try {
      if (!document.hidden && user && league && !busy && (tab === 'Direct' || league.status === 'broadcast' || league.nextLockAt && Date.now() + offset >= Date.parse(league.nextLockAt))) {
        await send('get');
      }
    } catch (error) { message(`Connexion interrompue. Nouvelle tentative automatique : ${error.message}`); }
    finally { polling = false; if (!stopped) timer = setTimeout(poll, 4000); }
  }
  try {
    client = await connect(config);
    const { data, error } = await client.auth.getSession(); if (error) throw error;
    user = data.session?.user;
    client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') renderAuth(true);
      if (event === 'SIGNED_OUT') { user = null; league = null; view?.pause(); renderAuth(); }
    });
    if (new URLSearchParams(location.search).has('recovery') && user) renderAuth(true);
    else if (user) await renderLobby(); else renderAuth();
    timer = setTimeout(poll, 4000);
  } catch (error) { message(error.message); content.append(el('p', 'rb-muted', 'La carrière solo reste disponible.')); }
  const stop = () => { stopped = true; clearTimeout(timer); view?.pause(); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !stopped) { frameKey = null; clearTimeout(timer); poll(); } });
  window.addEventListener?.('pagehide', stop);
  return { stop };
}
