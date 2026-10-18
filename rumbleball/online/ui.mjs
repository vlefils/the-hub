import { el, btn, field, select, money, metric, table, stats, statList, xpProgress, fatigue, comparison, portraitIdentity, equipmentSlots, pageHeading } from '../career-components.mjs';
import { CATALOGUE, compilePlayer, salary, recruitmentPrice } from '../progression.mjs';
import { mountMatch } from '../ui.mjs';
import { crestPicker, clubIdentity, matchBanner, equipmentArtwork } from '../broadcast-components.mjs';
import { mountTeamEditor, preparationDraft, leagueContext } from './team-ui.mjs';
import { mountReplay } from '../replay-ui.mjs';
import { workspaceHeader } from '../workspace-header.mjs';

const date = (value) => value ? new Date(value).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }) : 'Après le lancement de la ligue';
function input(type, label, value = '') { const node = el('input'); if (type === 'text') node.maxLength = 80; node.type = type; node.value = value; node.required = true; node.setAttribute('aria-label', label); return node; }

export async function mountOnline(root, config, connect) {
  root.replaceChildren();
  const top = el('div', 'rb-online-top'), back = el('a', 'rb-button', 'Carrière solo et exhibition'); back.href = './index.html';
  const identity = el('span', 'rb-muted'); top.append(back, identity);
  const accountSlot = document.querySelector('[data-online-account]');
  if (accountSlot) { const menu = el('details', 'rb-account-menu'), panel = el('div', 'rb-account-panel'); panel.append(identity); menu.append(el('summary', '', 'Compte'), panel); accountSlot.append(back, menu); top.hidden = true; }
  const notice = el('p', 'rb-error rb-online-notice'); notice.hidden = true; notice.setAttribute('role', 'alert');
  const content = el('div'), live = el('div', 'rb-online-live'); live.hidden = true;
  const replayArea = el('section', 'rb-replay-area'); replayArea.hidden = true;
  root.append(top, notice, content, live, replayArea);
  let teamDraft = null, shopPlayerId = null, replayView = null, replayOpen = false, replayLimit = 30;
  let client, user, league, tab = 'Équipe', busy = false, polling = false, stopped = false, timer, view, frameKey, offset = 0, revision = null, formDirty = false;
  function message(text, error = true) { notice.textContent = text; notice.className = error ? 'rb-error rb-online-notice' : 'rb-muted rb-online-notice'; notice.hidden = false; }
  async function attempt(action) { if (busy) return; busy = true; notice.hidden = true; try { return await action(); } catch (error) { message(error.message); } finally { busy = false; } }
  async function send(action, payload = {}, id = league?.id) {
    const result = await client.request(action, id, payload);
    if (result.league) {
      const next = result.league, changed = !league || league.id !== next.id || revision !== result.revision || league.locked !== next.locked || league.status !== next.status;
      const entered = !league || league.id !== next.id, justLocked = next.locked && !league?.locked;
      if (entered) shopPlayerId = null;
      const discarded = justLocked && teamDraft?.dirty;
      if (entered || justLocked || ['configure', 'cancel'].includes(action)) {
        const context = !entered && teamDraft ? { view: teamDraft.view, selected: teamDraft.selected, slotSelected: teamDraft.slotSelected, detailsOpen: teamDraft.detailsOpen, shopItem: teamDraft.shopItem } : null;
        teamDraft = context ? { ...preparationDraft(next.club), ...context } : null; formDirty = false;
      }
      league = next; revision = result.revision; offset = Date.parse(league.serverTime) - Date.now();
      if (action !== 'get' || changed || tab === 'Direct') renderLeague();
      if (discarded) message('Verrouillage de 20 h : les modifications non enregistrées n’ont pas été retenues. La dernière préparation enregistrée est utilisée.', false);
    }
    return result;
  }
  function form(title, controls, submitLabel, action) {
    const node = el('form', 'rb-online-form'); node.append(el('h3', '', title), ...controls);
    const submit = el('button', 'rb-button rb-button-primary', submitLabel); submit.type = 'submit'; node.append(submit);
    node.addEventListener('submit', (event) => { event.preventDefault(); return attempt(async () => { submit.disabled = true; try { await action(); } finally { submit.disabled = false; } }); });
    for (const event of ['input', 'change']) node.addEventListener(event, () => { formDirty = true; });
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
    workspaceHeader({ context: null, navigation: null });
    replayView?.stop(); replayOpen = false; replayArea.hidden = true; content.hidden = false;
    content.replaceChildren(); content.className = 'rb-online-auth'; live.hidden = true; identity.textContent = '';
    const introduction = el('section', 'rb-auth-intro'), panel = el('section', 'rb-auth-panel');
    introduction.append(el('p', 'rb-eyebrow', 'Rumbleball Manager'), el('h2', '', 'Votre club. Votre ligue.'), el('p', '', 'Préparez votre équipe pendant la journée. Retrouvez votre ligue à 20 h, heure de Paris, pour la soirée de matchs.'));
    content.append(introduction, panel);
    const email = input('email', 'Adresse e-mail'), password = input('password', 'Mot de passe'); password.minLength = 8; password.autocomplete = recovery ? 'new-password' : 'current-password'; email.autocomplete = 'email';
    const controls = recovery ? [field('Nouveau mot de passe', password)] : [field('Adresse e-mail', email), field('Mot de passe', password)];
    panel.append(form(recovery ? 'Choisir un nouveau mot de passe' : 'Se connecter', controls, recovery ? 'Enregistrer le mot de passe' : 'Connexion', async () => {
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
    panel.append(actions, el('p', 'rb-muted', 'Votre compte Riftbound Tracker fonctionne aussi ici. Votre club et votre session Rumbleball restent séparés.'));
  }
  async function renderLobby() {
    workspaceHeader({ context: null, navigation: null });
    replayView?.stop(); replayOpen = false; replayArea.hidden = true; content.hidden = false;
    content.className = 'rb-online-lobby';
    league = null; teamDraft = null; revision = null; frameKey = null; formDirty = false; live.hidden = true; view?.pause(); content.replaceChildren(); identity.replaceChildren(el('span', '', user.email ?? 'Connecté'), btn('Déconnexion', () => attempt(async () => { await client.auth.signOut(); user = null; renderAuth(); })));
    const { leagues } = await client.request('list');
    content.append(el('h2', '', 'Vos ligues'));
    const list = el('div', 'rb-online-actions');
    for (const item of leagues) list.append(btn(`${item.name} · ${item.members}/${item.capacity} clubs`, () => attempt(() => send('get', {}, item.id))));
    if (!leagues.length) list.append(el('p', 'rb-muted', 'Créez une ligue ou rejoignez celle de vos amis.'));
    content.append(list);
    const leagueName = input('text', 'Nom de la ligue'), clubName = input('text', 'Nom de votre club'), capacity = select({ 2: '2 clubs', 4: '4 clubs', 6: '6 clubs', 8: '8 clubs' }, 6), color = input('color', 'Couleur du club', '#35bdb3');
    const code = input('text', 'Code d’invitation'), joinName = input('text', 'Nom du club à inscrire'), joinColor = input('color', 'Couleur du club à inscrire', '#35bdb3');
    const createCrest = crestPicker('hound', color.value), joinCrest = crestPicker('helmet', joinColor.value);
    color.addEventListener('input', () => createCrest.updateColor(color.value)); joinColor.addEventListener('input', () => joinCrest.updateColor(joinColor.value));
    const columns = el('div', 'rb-online-columns');
    columns.append(form('Créer une ligue privée', [field('Nom de la ligue', leagueName), field('Votre club', clubName), field('Nombre de clubs', capacity), field('Maillots', color), createCrest.root, el('p', 'rb-muted', 'Votre club commence avec six recrues de niveau 1 et 600 chromas après leurs contrats.')], 'Créer la ligue', () => send('create', { name: leagueName.value, clubName: clubName.value, capacity: Number(capacity.value), color: color.value, crestId: createCrest.value })),
      form('Rejoindre sur invitation', [field('Code d’invitation', code), field('Votre club', joinName), field('Maillots', joinColor), joinCrest.root], 'Rejoindre', () => send('join', { code: code.value.trim(), clubName: joinName.value, color: joinColor.value, crestId: joinCrest.value })));
    content.append(columns);
  }
  function action(label, command, payload, primary = false) { const b = btn(label, () => attempt(() => send(command, payload)), primary); b.disabled = league.locked; return b; }
  function renderLeague() {
    if (replayOpen) return;
    content.className = 'rb-online-content';
    content.replaceChildren(); live.hidden = true;
    const c = league.club, heading = el('div', 'rb-online-identity'), copy = el('div');
    copy.append(el('p', 'rb-eyebrow', `${league.name} · saison ${league.season} · journée ${league.day + 1}`), clubIdentity(c));
    const actions = el('div', 'rb-online-actions'); actions.append(btn('Actualiser', () => attempt(() => send('get'))), btn('Changer de ligue', () => attempt(renderLobby)));
    heading.append(copy, actions); content.append(heading);
    const summary = el('div', 'rb-online-finances'); summary.append(metric('Solde prévu', money(c.balance)), metric('Prochains salaires', money(c.players.reduce((n, p) => n + salary(p), 0))), metric('Revenu / victoire', '210 / +100', 'chromas par journée'));
    heading.replaceChildren(copy, summary, actions);
    workspaceHeader({ context: heading });
    const lockMessage = league.locked ? 'Équipes verrouillées pour la soirée.' : league.nextLockAt ? `Modifiable jusqu’au ${date(league.nextLockAt)} · heure de Paris.` : 'Préparation libre jusqu’au lancement de la saison.';
    summary.setAttribute('aria-label', 'Finances en chromas');
    if (league.status === 'lobby') {
      content.append(el('p', 'rb-muted', `${league.members.length}/${league.capacity} participants. Partagez ce code avec vos amis :`), el('p', 'rb-online-code', league.inviteCode), btn('Copier le code', () => attempt(async () => {
        if (!globalThis.navigator?.clipboard?.writeText) { message('Sélectionnez le code affiché pour le copier.', false); return; }
        await navigator.clipboard.writeText(league.inviteCode); message('Code d’invitation copié.', false);
      })));
      if (league.ownerId === user.id) { const start = action('Lancer la saison', 'start', {}, true); start.disabled = league.members.length !== league.capacity; content.append(start); }
    }
    const fixture = league.upcoming.find(f => [f.homeId, f.awayId].includes(c.id));
    const otherId = fixture && (fixture.homeId === c.id ? fixture.awayId : fixture.homeId), opponent = league.members.find(m => m.userId === otherId);
    if (opponent) content.append(matchBanner(c, opponent, league.locked ? 'Soirée en cours' : league.nextLockAt ? '20 h · Paris' : 'Saison à préparer', lockMessage));
    else content.append(el('p', league.locked ? 'rb-online-lock' : 'rb-muted', lockMessage));
    const nav = el('nav', 'rb-online-nav'); nav.setAttribute('aria-label', 'Gestion de la ligue');
    for (const label of ['Équipe', 'Recrutement', 'Équipement', 'Ligue', 'Direct', 'Replays']) {
      const b = btn(label, () => { replayView?.stop(); replayOpen = false; replayArea.hidden = true; content.hidden = false; tab = label; frameKey = null; renderLeague(); }); b.setAttribute('aria-current', tab === label ? 'page' : 'false'); nav.append(b);
    }
    content.append(nav);
    workspaceHeader({ navigation: nav });
    const mobile = select(Object.fromEntries(['Équipe', 'Recrutement', 'Équipement', 'Ligue', 'Direct', 'Replays'].map(label => [label, label])), tab);
    mobile.addEventListener('change', () => { tab = mobile.value; frameKey = null; renderLeague(); });
    const mobileField = field('Menu de la ligue', mobile); mobileField.classList.add('rb-mobile-nav'); content.append(mobileField);
    const body = el('section', 'rb-online-body'); content.append(body);
    if (tab === 'Équipe') renderTeam(body, c);
    if (tab === 'Recrutement') renderMarket(body, c);
    if (tab === 'Équipement') renderShop(body, c);
    if (tab === 'Ligue') {
      body.append(table(['Club', 'J', 'V', 'N', 'D', 'Points'], league.table.map((r) => [clubIdentity(league.members.find(m => m.userId === r.id), { compact: true }), r.played, r.wins, r.draws, r.losses, r.points])));
      for (const f of league.upcoming) body.append(el('p', '', `${league.members.find((m) => m.userId === f.homeId)?.name} — ${league.members.find((m) => m.userId === f.awayId)?.name}`));
      for (const g of league.history.slice(-12).reverse()) body.append(el('p', 'rb-muted', `${date(g.endsAt)} · ${league.members.find((m) => m.userId === g.homeId)?.name} / ${league.members.find((m) => m.userId === g.awayId)?.name} · ${g.winnerId ? 'Victoire : ' + league.members.find((m) => m.userId === g.winnerId)?.name : 'Nul'}`));
    }
    if (tab === 'Direct') renderLive(body);
    if (tab === 'Replays') renderReplays(body);
    if (league.hasDraft) {
      const cancel = el('div', 'rb-preparation-cancel');
      cancel.append(action('Annuler la préparation', 'cancel', {}), el('p', 'rb-muted', 'Rétablit la composition, les recrutements, les achats et le blason précédents, avant le verrouillage.'));
      (body.querySelector('.rb-broadcast-save') ?? body).append(cancel);
    }
    // Read-only applies to forms as well as mutation buttons.
    if (league.locked) for (const tag of ['input', 'select', 'button']) for (const control of body.querySelectorAll(tag)) if (control.getAttribute('data-readonly-control') !== 'true') control.disabled = true;
  }
  function renderReplays(body) {
    body.append(pageHeading('Replays des rencontres', 'Revoir les matchs terminés de la ligue, sans modifier les résultats ni la progression.'));
    if (!league.history.length) { body.append(el('p', 'rb-empty-state', 'Les replays apparaîtront après la première rencontre terminée.')); return; }
    for (const game of league.history.slice(-replayLimit).reverse()) {
      const row = el('section', 'rb-replay-entry'), home = league.members.find(m => m.userId === game.homeId), away = league.members.find(m => m.userId === game.awayId);
      row.append(el('p', 'rb-eyebrow', `Saison ${game.season} · journée ${game.day + 1}`), clubIdentity(home, { compact: true }), clubIdentity(away, { compact: true }), el('p', 'rb-muted', `${date(game.endsAt)} · ${game.winnerId ? 'Victoire : ' + league.members.find(m => m.userId === game.winnerId)?.name : 'Match nul'}`));
      if (game.replayAvailable) {
        const watch = btn('Voir le replay', () => openReplay(game.id, watch)); watch.setAttribute('data-readonly-control', 'true'); row.append(watch);
      } else row.append(el('p', 'rb-muted', 'Images non conservées pour cette ancienne rencontre.'));
      body.append(row);
    }
    if (league.history.length > replayLimit) { const more = btn('Afficher les rencontres précédentes', () => { replayLimit += 30; renderLeague(); }); more.setAttribute('data-readonly-control', 'true'); body.append(more); }
  }
  async function openReplay(matchId, control) {
    if (busy) return;
    const leagueId = league.id;
    control.disabled = true; control.textContent = 'Chargement du replay…';
    try { return await attempt(async () => {
      const { replay } = await client.request('replay', leagueId, { matchId });
      if (league?.id !== leagueId || tab !== 'Replays' || stopped) return;
      replayView?.stop(); view?.pause(); replayOpen = true; content.hidden = true; live.hidden = true; replayArea.hidden = false;
      const back = btn('Retour aux replays', () => { replayView?.stop(); replayView = null; replayOpen = false; replayArea.hidden = true; content.hidden = false; tab = 'Replays'; renderLeague(); });
      const player = el('div'); replayArea.replaceChildren(back, pageHeading(`Replay · saison ${replay.season}, journée ${replay.day + 1}`), player);
      replayView = mountReplay(player, replay, mountMatch); replayArea.scrollIntoView({ block: 'start' }); back.focus();
    }); } finally { control.disabled = false; control.textContent = 'Voir le replay'; }
  }
  function renderTeam(body, c) {
    teamDraft ??= preparationDraft(c);
    const editor = mountTeamEditor({ club: c, league, draft: teamDraft, locked: league.locked, hasDraft: league.hasDraft,
      onDirty(dirty) { formDirty = dirty; }, onSave: payload => attempt(() => send('configure', payload)),
      onBuy: (itemId, playerId, replaceConfirmed) => attempt(() => send('buy', { itemId, playerId, replaceConfirmed })),
      onSell: playerId => attempt(() => send('sell', { playerId })) });
    body.append(editor.root);
  }
  function renderMarket(body, c) {
    body.append(el('h3', '', 'Recrutement'), el('p', 'rb-muted', 'Les contrats de la préparation sont annulables avant 20 h. Les offres changent après chaque rencontre.'));
    for (const p of c.market) {
      const row = el('div', 'rb-online-player'), copy = el('div'), price = recruitmentPrice(p);
      copy.append(portraitIdentity(compilePlayer(p), c.kitColor, el('strong', '', p.name)), el('small', 'rb-muted', stats(compilePlayer(p))), xpProgress(p), el('small', 'rb-muted', `${money(salary(p))} / journée`)); row.append(copy);
      const buy = action(`Recruter · ${money(price)}`, 'recruit', { playerId: p.id });
      const blocked = c.balance < 0 ? 'Salaires impayés : achats bloqués.' : c.players.length >= 8 ? 'Huit joueurs maximum.' : c.balance < price ? `Il manque ${price - c.balance} chromas.` : '';
      if (blocked) { buy.disabled = true; row.append(el('small', 'rb-muted', blocked)); } row.append(buy); body.append(row);
    }
  }
  function renderShop(body, c) {
    shopPlayerId = c.players.some(p => p.id === shopPlayerId) ? shopPlayerId : c.lineup[0];
    const player = select(Object.fromEntries(c.players.map((p) => [p.id, p.name])), shopPlayerId), catalog = el('div', 'rb-online-equipment');
    player.setAttribute('data-readonly-control', 'true');
    body.append(pageHeading('Équipement sportif', 'Le matériel porté, les protections du club, puis les achats pour ce joueur.'), field('Joueur à équiper', player), catalog);
    function draw() {
      catalog.replaceChildren(); const p = c.players.find((p) => p.id === player.value), compiled = compilePlayer(p, c.inventory);
      const identity = el('section', 'rb-equipment-player');
      identity.append(portraitIdentity(compiled, c.kitColor, el('h4', '', p.name), xpProgress(p)), equipmentSlots(p, c.inventory), statList(compiled)); catalog.append(identity);
      catalog.append(el('h4', '', 'Protections du club'), el('p', 'rb-muted', 'Les transferts sont gratuits. Une protection retirée reste disponible en réserve.'));
      const reserve = el('div', 'rb-club-inventory');
      if (!c.inventory.length) reserve.append(el('p', 'rb-empty-state', 'Votre réserve est vide. Les protections achetées pourront être réattribuées entre deux soirées.'));
      for (const gear of c.inventory) {
        const row = el('div', 'rb-inventory-row'), copy = el('div'), assignment = select({ '': 'Réserve', ...Object.fromEntries(c.players.map(p => [p.id, p.name])) }, gear.playerId ?? '');
        assignment.disabled = league.locked;
        assignment.addEventListener('change', () => attempt(() => send('equip', { itemId: gear.id, playerId: assignment.value || null })));
        copy.append(el('strong', '', CATALOGUE[gear.itemId].name), field('Attribuer à · transfert gratuit', assignment));
        row.append(equipmentArtwork(gear.itemId, CATALOGUE[gear.itemId].name), copy, action(`Revendre · ${money(CATALOGUE[gear.itemId].price / 2)}`, 'sellProtection', { itemId: gear.id })); reserve.append(row);
      }
      catalog.append(reserve, el('h4', '', 'Magasin'), el('p', 'rb-muted', `Les achats sont équipés sur ${p.name}. Le remplacement d’un implant détruit l’ancien.`));
      for (const slot of ['protection', 'implant']) {
        catalog.append(el('p', 'rb-eyebrow', slot === 'protection' ? 'Protections · transférables' : 'Implants · personnels'));
        const list = el('div', 'rb-shop');
        for (const [id, item] of Object.entries(CATALOGUE).filter(([, item]) => item.slot === slot)) {
          const row = el('section', 'rb-career-player'), replace = input('checkbox', `Détruire l’ancien implant pour ${item.name}`); replace.required = false;
          const after = { ...p, implant: item.slot === 'implant' ? id : p.implant }, inventory = item.slot === 'protection' ? [...c.inventory.filter((g) => g.playerId !== p.id), { itemId: id, playerId: p.id }] : c.inventory;
          const heading = el('div', 'rb-equipment-heading'); heading.append(equipmentArtwork(id, ''), el('h4', '', item.name));
          row.append(heading, el('p', 'rb-muted', item.effect), comparison(compiled, compilePlayer(after, inventory), p.implant, after.implant));
          if (item.slot === 'implant' && p.implant && p.implant !== id) row.append(field(`Détruire ${CATALOGUE[p.implant].name} pour remplacer l’implant`, replace));
          const buy = btn(`Acheter · ${money(item.price)}`, () => attempt(async () => {
            if (item.slot === 'implant' && p.implant && !replace.checked) throw new Error('Confirmez la destruction de l’ancien implant avant le remplacement.');
            await send('buy', { itemId: id, playerId: p.id, replaceConfirmed: replace.checked });
          }));
          const blocked = p.implant === id ? 'Cet implant est déjà équipé.' : c.balance < 0 ? 'Salaires impayés : achats bloqués.' : c.balance < item.price ? `Il manque ${item.price - c.balance} chromas.` : '';
          row.append(el('p', 'rb-purchase-projection', `Après achat : ${money(c.balance - item.price)}`));
          buy.disabled = league.locked || Boolean(blocked); row.append(buy); if (blocked) row.append(el('small', 'rb-muted', blocked)); list.append(row);
        }
        catalog.append(list);
      }
    }
    player.addEventListener('change', () => { shopPlayerId = player.value; draw(); }); draw();
  }
  function renderLive(body) {
    body.append(el('h3', '', 'La soirée en direct'));
    const schedule = el('details', 'rb-live-programme'); schedule.append(el('summary', '', 'Programme et classement'), leagueContext(league)); body.append(schedule);
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
      if (!document.hidden && user && league && !busy && (league.status === 'lobby' && !formDirty || tab === 'Direct' || league.status === 'broadcast' || league.nextLockAt && Date.now() + offset >= Date.parse(league.nextLockAt))) {
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
  const stop = () => { stopped = true; clearTimeout(timer); view?.pause(); replayView?.stop(); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !stopped) { frameKey = null; clearTimeout(timer); poll(); } });
  window.addEventListener?.('pagehide', stop);
  return { stop };
}
