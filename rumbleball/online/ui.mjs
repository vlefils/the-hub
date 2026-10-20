import { el, btn, field, money, metric, table, statList, portraitIdentity, pageHeading } from '../career-components.mjs';
import { compilePlayer, salary, recruitmentPrice, MAX_SQUAD_SIZE } from '../progression.mjs';
import { mountMatch } from '../ui.mjs';
import { crestPicker, clubIdentity, matchBanner } from '../broadcast-components.mjs';
import { mountTeamEditor, preparationDraft } from './team-ui.mjs';
import { mountReplay } from '../replay-ui.mjs';
import { workspaceHeader, workspaceNavigation } from '../workspace-header.mjs';
import { managementDialog } from '../management-dialog.mjs';
import { abilitySummary } from '../player-development-ui.mjs';
import { playoffPlaces, currentPlayoffRound } from '../playoffs.mjs';
import { qualificationLegend, playoffBracket } from '../playoffs-ui.mjs';
import { waitingRoom } from './lobby-ui.mjs';
import { initialRoster } from './initial-roster-ui.mjs';
import { scheduledInstant } from './schedule.mjs';

const date = (value) => value ? new Date(value).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }) : 'Après le lancement de la ligue';
function input(type, label, value = '') { const node = el('input'); if (type === 'text') node.maxLength = 80; node.type = type; node.value = value; node.required = true; node.setAttribute('aria-label', label); return node; }

export async function mountOnline(root, config, connect, options = {}) {
  root.replaceChildren();
  const top = el('div', 'rb-online-top'), back = el('a', 'rb-button', 'Carrière solo et exhibition'); back.href = './index.html';
  const identity = el('span', 'rb-muted'); top.append(back, identity);
  top.hidden = Boolean(options.managedSession);
  const accountSlot = options.managedSession ? null : document.querySelector('[data-online-account]');
  if (accountSlot) { const menu = el('details', 'rb-account-menu'), panel = el('div', 'rb-account-panel'); panel.append(identity); menu.append(el('summary', '', 'Compte'), panel); accountSlot.append(back, menu); top.hidden = true; }
  const notice = el('p', 'rb-error rb-online-notice'); notice.hidden = true; notice.setAttribute('role', 'alert');
  const content = el('div'), live = el('div', 'rb-online-live'); live.hidden = true;
  const replayArea = el('section', 'rb-replay-area'); replayArea.hidden = true;
  root.append(top, notice, content, live, replayArea);
  let teamDraft = null, marketOpen = false, replayView = null, replayOpen = false, replayLimit = 30, waitingSlot;
  let firstMatchChoice = '', initialIds = new Set();
  const modal = managementDialog(root, () => { marketOpen = false; });
  let client, user, league, tab = 'Club', busy = false, polling = false, stopped = false, timer, view, frameKey, offset = 0, revision = null, formDirty = false, authSubscription;
  const inactive = () => stopped || options.isActive?.() === false;
  function message(text, error = true) { notice.textContent = text; notice.className = error ? 'rb-error rb-online-notice' : 'rb-muted rb-online-notice'; notice.hidden = false; if (error && modal.visible) modal.message(text); }
  async function attempt(action) { if (busy) return; busy = true; notice.hidden = true; if (modal.visible) modal.message(''); try { return await action(); } catch (error) { message(error.message); } finally { busy = false; } }
  async function send(action, payload = {}, id = league?.id) {
    const result = await client.request(action, id, payload);
    if (inactive()) return result;
    if (result.league) {
      const next = result.league, changed = !league || league.id !== next.id || revision !== result.revision || league.locked !== next.locked || league.status !== next.status;
      const entered = !league || league.id !== next.id, justLocked = next.locked && !league?.locked;
      const roomOnly = !entered && tab === 'Club' && league.status === 'lobby' && next.status === 'lobby' &&
        (['addBot', 'removeBot'].includes(action) || action === 'get' && (formDirty || JSON.stringify(league.club) === JSON.stringify(next.club)));
      if (entered) { modal.close(); tab = 'Club'; firstMatchChoice = ''; initialIds.clear(); }
      const discarded = justLocked && teamDraft?.dirty;
      if (entered || justLocked || ['configure', 'cancel', 'initialRecruit'].includes(action)) {
        const context = !entered && teamDraft ? { selected: teamDraft.selected, slotSelected: teamDraft.slotSelected, shopItem: teamDraft.shopItem, equipmentSlot: teamDraft.equipmentSlot, inspectorTab: teamDraft.inspectorTab } : null;
        teamDraft = context ? { ...preparationDraft(next.club), ...context } : null; formDirty = false;
      }
      league = next; revision = result.revision; offset = Date.parse(league.serverTime) - Date.now();
      if (roomOnly) { if (changed) renderWaitingRoom(); }
      else if (action !== 'get' || changed || tab === 'Ligue') renderLeague();
      if (discarded) message('Coup d’envoi : les modifications non enregistrées n’ont pas été retenues. La dernière préparation enregistrée est utilisée.', false);
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
    modal.close();
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
    if (inactive()) return;
    modal.close();
    workspaceHeader({ context: null, navigation: null });
    replayView?.stop(); replayOpen = false; replayArea.hidden = true; content.hidden = false;
    content.className = 'rb-online-lobby';
    league = null; teamDraft = null; revision = null; frameKey = null; formDirty = false; live.hidden = true; view?.pause(); content.replaceChildren(); identity.replaceChildren(el('span', '', user.email ?? 'Connecté'));
    if (!options.managedSession) identity.append(btn('Déconnexion', () => attempt(async () => { await client.auth.signOut(); user = null; renderAuth(); })));
    const { leagues } = await client.request('list');
    if (inactive()) return;
    content.append(el('h2', '', 'Vos ligues'));
    const list = el('div', 'rb-online-actions');
    for (const item of leagues) list.append(btn(`${item.name} · ${item.members} club${item.members > 1 ? 's' : ''}${item.status === 'lobby' ? ' · Salle d’attente' : ''}`, () => attempt(() => send('get', {}, item.id))));
    if (!leagues.length) list.append(el('p', 'rb-muted', 'Créez une ligue ou rejoignez celle de vos amis.'));
    content.append(list);
    const leagueName = input('text', 'Nom de la ligue'), clubName = input('text', 'Nom de votre club');
    const code = input('text', 'Code d’invitation'), joinName = input('text', 'Nom du club à inscrire');
    const columns = el('div', 'rb-online-columns');
    columns.append(form('Créer une ligue privée', [field('Nom de la ligue', leagueName), field('Votre club', clubName), el('p', 'rb-muted', 'Invitez vos amis, ajoutez des bots et choisissez le premier rendez-vous. Vous recruterez votre équipe au lancement de la saison.')], 'Créer la ligue', () => send('create', { name: leagueName.value, clubName: clubName.value })),
      form('Rejoindre sur invitation', [field('Code d’invitation', code), field('Votre club', joinName)], 'Rejoindre', () => send('join', { code: code.value.trim(), clubName: joinName.value })));
    content.append(columns);
  }
  function action(label, command, payload, primary = false) { const b = btn(label, () => attempt(() => send(command, payload)), primary); b.disabled = league.locked; return b; }
  function renderWaitingRoom() {
    if (!waitingSlot || league.status !== 'lobby') return;
    const key = document.activeElement?.dataset?.focusKey, label = document.activeElement?.textContent;
    const restore = waitingSlot.contains(document.activeElement);
    waitingSlot.replaceChildren(waitingRoom(league, user.id, { scheduleValue: firstMatchChoice, onSchedule: value => { firstMatchChoice = value; },
      onAdd: () => attempt(() => send('addBot')), onRemove: botId => attempt(() => send('removeBot', { botId })),
      onStart: value => attempt(() => send('start', { firstMatchAt: scheduledInstant(value) })), onCopy: () => attempt(async () => {
        if (!globalThis.navigator?.clipboard?.writeText) { message('Sélectionnez le code affiché pour le copier.', false); return; }
        await navigator.clipboard.writeText(league.inviteCode); message('Code d’invitation copié.', false);
      }),
    }));
    if (restore) ([...waitingSlot.querySelectorAll('button'), ...waitingSlot.querySelectorAll('input')].find(button => key ? button.dataset.focusKey === key : button.textContent === label) ?? waitingSlot.querySelector('.rb-online-actions button'))?.focus({ preventScroll: true });
  }
  function renderLeague() {
    if (replayOpen || inactive()) return;
    content.className = 'rb-online-content';
    delete content.dataset.workspaceScreen;
    content.replaceChildren(); live.hidden = true;
    const c = league.club, heading = el('div', 'rb-online-identity'), copy = el('div');
    if (league.status === 'lobby') {
      workspaceHeader({ context: null, navigation: null });
      content.append(pageHeading(league.name, 'Invitez les managers avant de lancer la saison.'), btn('Changer de ligue', () => attempt(renderLobby)));
      waitingSlot = el('div'); content.append(waitingSlot); renderWaitingRoom(); return;
    }
    if (league.needsRecruitment) {
      workspaceHeader({ context: null, navigation: null });
      content.append(pageHeading(league.name, `Premier rendez-vous : ${date(league.firstMatchAt)} · heure de Paris`), initialRoster(c, initialIds, {
        onSelect() { formDirty = true; }, onConfirm: playerIds => attempt(() => send('initialRecruit', { playerIds })),
      })); return;
    }
    content.dataset.workspaceScreen = tab;
    const stage = league.status === 'lobby' ? 'Salle d’attente' : league.phase === 'playoffs' ? currentPlayoffRound(league.playoffs)?.name ?? 'Playoffs' : `Phase de groupe · journée ${league.day + 1}`;
    copy.append(el('p', 'rb-eyebrow', `${league.name} · saison ${league.season} · ${stage}`), clubIdentity(c));
    const actions = el('div', 'rb-online-actions'); actions.append(btn('Actualiser', () => attempt(() => send('get'))), btn('Changer de ligue', () => attempt(renderLobby)));
    heading.append(copy, actions); content.append(heading);
    const summary = el('div', 'rb-online-finances'); summary.append(metric('Solde prévu', money(c.balance)), metric('Prochains salaires', money(c.players.reduce((n, p) => n + salary(p), 0))), metric('Revenu / victoire', '210 / +100', 'chromas par journée'));
    heading.replaceChildren(copy, summary, actions);
    workspaceHeader({ context: heading });
    const pending = league.members.filter(m => !m.ready);
    const lockMessage = league.status === 'recruitment' ? `Recrutement en cours : ${pending.map(m => m.name).join(', ')}. Le premier match attend la validation de tous les effectifs.` : league.locked ? 'Équipes verrouillées pour la soirée.' : league.nextLockAt ? `Modifiable jusqu’au ${date(league.nextLockAt)} · heure de Paris.` : 'Préparation libre jusqu’au lancement de la saison.';
    summary.setAttribute('aria-label', 'Finances en chromas');
    if (league.status === 'lobby') {
      waitingSlot = el('div'); content.append(waitingSlot); renderWaitingRoom();
    }
    const fixture = league.upcoming.find(f => [f.homeId, f.awayId].includes(c.id));
    const otherId = fixture && (fixture.homeId === c.id ? fixture.awayId : fixture.homeId), opponent = league.members.find(m => m.userId === otherId);
    if (tab === 'Club') {
      if (opponent) content.append(matchBanner(c, opponent, league.locked ? 'Soirée en cours' : league.nextLockAt ? date(league.nextLockAt) : 'Saison à préparer', lockMessage));
      else content.append(el('p', league.locked ? 'rb-online-lock' : 'rb-muted', `${league.status === 'preparation' && league.phase !== 'playoffs' ? 'Journée de repos pour votre club. ' : ''}${lockMessage}`));
    }
    if (league.phase === 'playoffs') content.append(el('p', 'rb-competition-status', fixture ? `${stage} · élimination directe` : 'Votre club ne dispute plus les playoffs. Suivez les rencontres et le tableau dans Ligue.'));
    const lastChampion = league.playoffHistory?.at(-1);
    if (lastChampion) content.append(el('p', 'rb-competition-status', `Champion de la saison ${lastChampion.season} : ${league.members.find(member => member.userId === lastChampion.bracket.championId)?.name}`));
    const nav = workspaceNavigation(tab, label => { modal.close(); replayView?.stop(); view?.pause(); replayOpen = false; replayArea.hidden = true; content.hidden = false; tab = label; frameKey = null; renderLeague(); });
    content.append(nav); workspaceHeader({ navigation: nav });
    const body = el('section', 'rb-online-body'); content.append(body);
    if (tab === 'Club') renderTeam(body, c);
    if (tab === 'Ligue') {
      const overview = el('div', 'rb-league-layout'), ranking = el('section'), programme = el('section');
      const title = pageHeading('La ligue', `Saison ${league.season} · ${stage}`);
      const replays = btn(`Replays des rencontres · ${league.history.length}`, () => { modal.body.replaceChildren(); renderReplays(modal.body); modal.show('Replays des rencontres', replays); });
      replays.classList.add('rb-quiet-action'); replays.dataset.focusKey = 'league-replays'; replays.setAttribute('aria-haspopup', 'dialog'); replays.setAttribute('data-readonly-control', 'true'); title.append(replays);
      if (!league.broadcast) body.append(title);
      ranking.append(el('h3', '', 'Classement · phase de groupe'), table(['Club', 'J', 'V', 'N', 'D', 'Points'], league.table.map((r) => [clubIdentity(league.members.find(m => m.userId === r.id), { compact: true }), r.played, r.wins, r.draws, r.losses, r.points]), { highlight: league.table.findIndex(r => r.id === c.id), qualifying: league.capacity ? playoffPlaces(league.capacity) : 0 }));
      if (league.capacity) ranking.append(qualificationLegend(playoffPlaces(league.capacity)));
      programme.append(el('h3', '', 'Programme de la soirée'));
      for (const f of league.upcoming) {
        const row = el('div', 'rb-fixture-row'); row.append(clubIdentity(league.members.find(m => m.userId === f.homeId), { compact: true }), clubIdentity(league.members.find(m => m.userId === f.awayId), { compact: true })); programme.append(row);
      }
      if (league.status === 'lobby') programme.append(el('p', 'rb-muted', 'Le calendrier sera établi au lancement de la saison.'));
      overview.append(ranking, programme);
      if (league.broadcast) {
        const standings = btn('Classement, programme et replays', () => { modal.body.replaceChildren(title, overview); modal.show('La ligue', standings); });
        standings.classList.add('rb-live-overview'); standings.dataset.focusKey = 'live-overview'; standings.setAttribute('aria-haspopup', 'dialog'); standings.setAttribute('data-readonly-control', 'true'); body.append(standings);
      } else body.append(overview);
      const clubs = league.members.map(member => ({ id: member.userId, name: member.name }));
      if (league.playoffs || lastChampion) { overview.classList.add('has-playoffs'); overview.append(playoffBracket(league.playoffs ?? lastChampion.bracket, clubs, c.id)); }
    }
    if (tab === 'Ligue') renderLive(body);
    if (marketOpen) { modal.body.replaceChildren(); renderMarket(modal.body, c); modal.show('Recrutement'); }
    if (league.hasDraft) {
      const cancel = el('div', 'rb-preparation-cancel');
      const undo = action('Annuler la préparation', 'cancel', {}), description = el('p', 'rb-sr-only', 'Rétablit la composition, les recrutements, les achats et le blason précédents, avant le verrouillage.');
      description.id = 'rb-cancel-preparation-note'; undo.setAttribute('aria-describedby', description.id); undo.title = description.textContent;
      cancel.append(undo, description);
      (body.querySelector('.rb-broadcast-save') ?? body).append(cancel);
    }
    // Read-only applies to forms as well as mutation buttons.
    if (league.locked) for (const tag of ['input', 'select', 'button']) for (const control of body.querySelectorAll(tag)) if (!control.closest('.rb-online-live') && control.getAttribute('data-readonly-control') !== 'true') control.disabled = true;
  }
  function renderReplays(body) {
    body.append(el('p', 'rb-muted', 'Revoir les matchs terminés de la ligue, sans modifier les résultats ni la progression.'));
    if (!league.history.length) { body.append(el('p', 'rb-empty-state', 'Les replays apparaîtront après la première rencontre terminée.')); return; }
    for (const game of league.history.slice(-replayLimit).reverse()) {
      const row = el('section', 'rb-replay-entry'), home = league.members.find(m => m.userId === game.homeId), away = league.members.find(m => m.userId === game.awayId);
      row.append(el('p', 'rb-eyebrow', `Saison ${game.season} · ${game.phase === 'playoffs' ? 'Playoffs' : 'journée ' + (game.day + 1)}`), clubIdentity(home, { compact: true }), clubIdentity(away, { compact: true }), el('p', 'rb-muted', `${date(game.endsAt)} · ${game.winnerId ? 'Victoire : ' + league.members.find(m => m.userId === game.winnerId)?.name : 'Match nul'}${game.decision === 'ranking' ? ' · qualifié au classement : ' + league.members.find(m => m.userId === game.qualifiedId)?.name : ''}`));
      if (game.replayAvailable) {
        const watch = btn('Voir le replay', () => openReplay(game.id, watch)); watch.setAttribute('data-readonly-control', 'true'); row.append(watch);
      } else row.append(el('p', 'rb-muted', 'Images non conservées pour cette ancienne rencontre.'));
      body.append(row);
    }
    if (league.history.length > replayLimit) { const more = btn('Afficher les rencontres précédentes', () => { replayLimit += 30; body.replaceChildren(); renderReplays(body); }); more.setAttribute('data-readonly-control', 'true'); body.append(more); }
  }
  async function openReplay(matchId, control) {
    if (busy) return;
    const leagueId = league.id;
    control.disabled = true; control.textContent = 'Chargement du replay…';
    try { return await attempt(async () => {
      const { replay } = await client.request('replay', leagueId, { matchId });
      if (league?.id !== leagueId || tab !== 'Ligue' || stopped) return;
      modal.close(); replayView?.stop(); view?.pause(); replayOpen = true; content.hidden = true; live.hidden = true; replayArea.hidden = false;
      const back = btn('Retour aux replays', () => { replayView?.stop(); replayView = null; replayOpen = false; replayArea.hidden = true; content.hidden = false; tab = 'Ligue'; renderLeague(); });
      const player = el('div'); replayArea.replaceChildren(back, pageHeading(`Replay · saison ${replay.season}, journée ${replay.day + 1}`), player);
      replayView = mountReplay(player, replay, mountMatch); replayArea.scrollIntoView({ block: 'start' }); back.focus();
    }); } finally { control.disabled = false; control.textContent = 'Voir le replay'; }
  }
  function renderTeam(body, c) {
    teamDraft ??= preparationDraft(c);
    const editor = mountTeamEditor({ club: c, league, draft: teamDraft, locked: league.locked, hasDraft: league.hasDraft,
      onDirty(dirty) { formDirty = dirty; }, onSave: payload => attempt(() => send('configure', payload)),
      onBuy: (itemId, playerId, replaceConfirmed, location) => attempt(() => send('buy', { itemId, playerId, replaceConfirmed, location })),
      onAssign: (itemId, playerId, location) => attempt(() => send('equip', { itemId, playerId, location })),
      onSellGear: itemId => attempt(() => send('sellProtection', { itemId })),
      onAdvance: (playerId, changes) => attempt(() => send('advance', { playerId, changes })),
      onRecruit() { marketOpen = true; modal.body.replaceChildren(); renderMarket(modal.body, c); modal.show('Recrutement'); },
      onSell: playerId => attempt(() => send('sell', { playerId })) });
    body.append(editor.root);
  }
  function renderMarket(body, c) {
    body.append(el('p', 'rb-muted', `${c.players.length}/${MAX_SQUAD_SIZE} places occupées · Contrats annulables avant le coup d’envoi. Les offres changent après chaque rencontre.`));
    const list = el('div', 'rb-market-list'); body.append(list);
    for (const p of c.market) {
      const row = el('section', 'rb-career-player'), price = recruitmentPrice(p), compiled = compilePlayer(p);
      row.append(portraitIdentity(compiled, c.kitColor, el('h4', '', p.name)), el('p', 'rb-muted', `Niveau ${compiled.level} · ${money(salary(p))} / journée`), abilitySummary(compiled), statList(compiled), el('p', 'rb-purchase-projection', `Après contrat : ${money(c.balance - price)}.`));
      const buy = action(`Recruter · ${money(price)}`, 'recruit', { playerId: p.id }, true);
      const blocked = c.balance < 0 ? 'Salaires impayés : achats bloqués.' : c.players.length >= MAX_SQUAD_SIZE ? 'Dix joueurs maximum.' : c.balance < price ? `Il manque ${price - c.balance} chromas.` : '';
      if (blocked) { buy.disabled = true; row.append(el('small', 'rb-muted', blocked)); } row.append(buy); list.append(row);
    }
  }
  function renderLive(body) {
    const frame = league.broadcast;
    if (!frame) body.append(el('h3', '', 'La soirée en direct'));
    body.append(live);
    if (!frame) { view?.pause(); body.append(el('p', 'rb-muted', league.waitingForServer ? 'Diffusion retardée : attente du serveur. Reconnexion automatique en cours.' : league.status === 'broadcast' ? 'Pause entre deux rencontres. Prochain coup d’envoi indiqué ci-dessus.' : `Prochaine soirée : ${date(league.nextLockAt)}.`)); return; }
    live.hidden = false; if (!view) view = mountMatch(live);
    const key = `${frame.id}:${frame.roundStartsAt}:${frame.turns.length}`;
    if (key !== frameKey) { frameKey = key; view.broadcast(frame, Math.max(0, Date.now() + offset - Date.parse(frame.roundStartsAt))); }
  }
  async function poll() {
    if (inactive() || polling) return;
    polling = true;
    try {
      if (!document.hidden && user && league && !busy && (['lobby', 'recruitment'].includes(league.status) || tab === 'Ligue' || league.status === 'broadcast' || league.nextLockAt && Date.now() + offset >= Date.parse(league.nextLockAt))) {
        await send('get');
      }
    } catch (error) { message(`Connexion interrompue. Nouvelle tentative automatique : ${error.message}`); }
    finally { polling = false; if (!stopped) timer = setTimeout(poll, 4000); }
  }
  try {
    client = await connect(config);
    const { data, error } = await client.auth.getSession(); if (error) throw error;
    user = data.session?.user;
    if (!options.managedSession) authSubscription = client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') renderAuth(true);
      if (event === 'SIGNED_OUT') { user = null; league = null; view?.pause(); renderAuth(); }
    })?.data?.subscription;
    if (inactive()) return { stop() {} };
    if (options.managedSession && !user) throw new Error('Session expirée. Reconnectez-vous au jeu.');
    if (new URLSearchParams(location.search).has('recovery') && user) renderAuth(true);
    else if (user) await renderLobby(); else renderAuth();
    timer = setTimeout(poll, 4000);
  } catch (error) { message(error.message); content.append(el('p', 'rb-muted', 'La carrière solo reste disponible.')); }
  const stop = () => { stopped = true; clearTimeout(timer); if (view?.stop) view.stop(); else view?.pause(); replayView?.stop(); modal.close(); authSubscription?.unsubscribe?.(); document.removeEventListener?.('visibilitychange', onVisibility); window.removeEventListener?.('pagehide', stop); };
  const onVisibility = () => { if (!document.hidden && !inactive()) { frameKey = null; clearTimeout(timer); poll(); } };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener?.('pagehide', stop);
  return { stop };
}
