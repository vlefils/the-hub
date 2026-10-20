import { el, btn } from './career-components.mjs';
import { workspaceHeader } from './workspace-header.mjs';
import { mountLogin } from './auth-ui.mjs';
import { mountCareer } from './career-ui.mjs';
import { mountMatch } from './ui.mjs';
import { mountOnline } from './online/ui.mjs';
import { connectOnline } from './online/client.mjs';
import { ONLINE_CONFIG } from './online/config.mjs';
import { accountRequest, createSoloSync, recoverSoloGames, localSoloGames, cacheSoloGame } from './solo-sync.mjs';

const localStorageProxy = () => ({ get length() { return window.localStorage.length; }, key: i => window.localStorage.key(i),
  getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value), removeItem: key => window.localStorage.removeItem(key) });
const date = value => value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'À l’instant';

export async function mountSession(root, { connect = connectOnline, config = ONLINE_CONFIG, storage = localStorageProxy(), initialMode = 'home',
  careerView = mountCareer, matchView = mountMatch, onlineView = mountOnline } = {}) {
  root.replaceChildren(); root.classList.add('rb');
  const notice = el('p', 'rb-session-notice'), pane = el('div', 'rb-session-pane'); notice.hidden = true;
  const accountSlot = document.querySelector('[data-account-tools]') ?? el('div', 'rb-account-tools rb-account-inline');
  accountSlot.hidden = true;
  if (!accountSlot.parentNode) root.append(accountSlot);
  root.append(notice, pane);
  let client, user, child, sync, generation = 0, stopped = false, busy = false, recovering = false, subscription;
  function message(text, error = true) { notice.hidden = !text; notice.textContent = text; notice.className = error ? 'rb-session-notice rb-error' : 'rb-session-notice rb-muted'; notice.setAttribute('role', error ? 'alert' : 'status'); }
  function clearView() { child?.stop?.(); child = null; sync?.stop(); sync = null; workspaceHeader({ context: null, navigation: null, tools: null }); }
  const active = (ticket, owner) => !stopped && ticket === generation && user?.id === owner;
  function account() {
    accountSlot.replaceChildren(); accountSlot.hidden = !user;
    if (!user) return;
    const menu = el('details', 'rb-account-menu'), panel = el('div', 'rb-account-panel'), home = btn('Mes parties', () => attempt(() => showHome()));
    panel.append(el('span', '', user.email ?? 'Compte connecté'), btn('Déconnexion', () => attempt(async () => {
      clearView();
      const { error } = await client.auth.signOut(); if (error) { await showHome(); throw error; }
      if (user) signedOut();
    })));
    const hub = el('a', '', 'Retour à The Hub'); hub.href = '../#outils-rumbleball'; panel.append(hub);
    menu.append(el('summary', '', 'Compte'), panel); accountSlot.append(home, menu);
  }
  async function attempt(action) {
    if (busy || stopped) return; busy = true; message('');
    try { return await action(); } catch (error) { if (!stopped) message(error.message); }
    finally { busy = false; }
  }
  function login(recovery = false) {
    const ticket = ++generation; clearView(); account(); pane.replaceChildren();
    mountLogin(pane, client, { recovery, message, onSession: async nextUser => {
      if (stopped || generation !== ticket && user?.id !== nextUser?.id) return;
      recovering = false; user = nextUser; await showHome({ destination: initialMode });
    } });
  }
  function signedOut() { user = null; recovering = false; message(''); login(); }
  async function showHome({ destination = 'home' } = {}) {
    const owner = user?.id; if (!owner) { login(); return; }
    const ticket = ++generation; clearView(); account(); message('');
    pane.replaceChildren(el('p', 'rb-loading', 'Chargement de vos parties…'));
    const messages = []; let games = [], offline = false;
    try { messages.push(...await recoverSoloGames(client, owner, storage)); }
    catch (error) { messages.push(`Import ou synchronisation en attente : ${error.message} La partie locale est conservée.`); }
    if (!active(ticket, owner)) return;
    if (destination === 'multi') { if (messages.length) message(messages.join(' '), false); return showOnline(); }
    try { games = (await accountRequest(client, owner, 'solo_list')).games; }
    catch (error) { offline = true; messages.push(`Le compte est momentanément inaccessible : ${error.message}`); }
    if (!active(ticket, owner)) return;
    let local = [];
    try { local = localSoloGames(storage, owner); } catch (error) { messages.push(`Lecture du cache impossible : ${error.message}`); }
    const byId = new Map(games.map(game => [game.id, game]));
    for (const entry of local) if (entry.game.pending || offline && !byId.has(entry.game.id)) byId.set(entry.game.id, entry.game);
    games = [...byId.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const header = el('header', 'rb-games-heading'), copy = el('div'), actions = el('div', 'rb-online-actions');
    copy.append(el('p', 'rb-eyebrow', 'Votre espace Rumbleball'), el('h2', '', 'Mes parties'), el('p', 'rb-muted', 'Chaque carrière garde son club, sa progression et sa rencontre en cours. Retrouvez-la en vous connectant sur un autre appareil.'));
    const create = btn('Nouvelle partie solo', () => attempt(async () => {
      create.disabled = true;
      try { const { game } = await accountRequest(client, owner, 'solo_create'); if (active(ticket, owner)) await openGame(game.id, game); }
      finally { create.disabled = false; }
    }), true);
    create.disabled = offline;
    actions.append(create, btn('Ligues multijoueurs', () => attempt(showOnline)), btn('Actualiser les parties', () => attempt(() => showHome())));
    header.append(copy, actions);
    const list = el('section', 'rb-solo-list'); list.setAttribute('aria-label', 'Parties solo');
    if (!games.length) list.append(el('p', 'rb-empty-state', offline ? 'Reconnectez-vous au réseau pour retrouver les parties de votre compte.' : 'Votre première carrière commence ici. Vous pouvez en créer plusieurs et les reprendre indépendamment.'));
    for (const game of games) {
      const row = btn('', () => attempt(() => openGame(game.id))), identity = el('div'), summary = el('div');
      row.classList.add('rb-solo-entry'); row.setAttribute('aria-label', `Ouvrir la partie ${game.clubName}${game.isCopy ? ' · copie' : ''}`);
      identity.append(el('h3', '', game.clubName), el('p', 'rb-muted', game.status === 'empty' ? 'Club à créer' : game.status === 'draft' ? 'Recrutement initial en cours' : `Saison ${game.season} · ${game.completedDays} journées terminées`));
      if (game.mode === 'long') identity.append(el('small', 'rb-solo-mode', `Carrière longue · Ligue ${game.division}/6`));
      summary.append(el('small', game.pending ? 'rb-online-lock' : 'rb-muted', game.pending ? 'Progression locale à synchroniser' : `Sauvegardé le ${date(game.updatedAt)}`));
      if (game.isCopy) summary.append(el('small', 'rb-muted', 'Copie conservée après un conflit entre appareils'));
      row.append(identity, summary, el('span', 'rb-solo-resume', 'Reprendre →')); list.append(row);
    }
    pane.replaceChildren(header, list);
    if (messages.length) message(messages.join(' '), offline);
  }
  async function openGame(id, provided) {
    const owner = user?.id; if (!owner) return;
    const ticket = ++generation; clearView(); account(); message('');
    pane.replaceChildren(el('p', 'rb-loading', 'Ouverture de la partie…'));
    let local, game = provided;
    try { local = localSoloGames(storage, owner).find(entry => entry.game.id === id); } catch {}
    if (local?.record.pending) game = local.game;
    if (!game) {
      try { game = (await accountRequest(client, owner, 'solo_get', { id })).game; }
      catch (error) { if (!local) throw error; game = local.game; if (active(ticket, owner)) message('Partie ouverte depuis la copie de cet appareil. La synchronisation reprendra au retour de la connexion.', false); }
    }
    if (!active(ticket, owner)) return;
    try { if (!game.pending) cacheSoloGame(storage, owner, game); } catch { /* Saving will report any unavailable local outbox. */ }
    sync = createSoloSync(client, owner, storage, game, { record: local?.record.pending ? local.record : undefined });
    child = careerView(pane, matchView, { sync, onOnline: () => attempt(showOnline) });
  }
  async function showOnline() {
    const owner = user?.id; if (!owner) return;
    const ticket = ++generation; clearView(); account();
    pane.replaceChildren(el('p', 'rb-loading', 'Ouverture des ligues…'));
    const guardedClient = { ...client, request: (action, id, payload = {}) => client.request(action, id, { ...payload, accountId: owner }) };
    const instance = await onlineView(pane, config, async () => guardedClient, { managedSession: true, isActive: () => active(ticket, owner) });
    if (active(ticket, owner)) child = instance; else instance?.stop();
  }
  const onPageHide = () => { child?.stop?.(); sync?.stop(); };
  const onPageShow = async event => {
    if (!event.persisted || stopped || !client) return;
    try {
      const { data, error } = await client.auth.getSession(); if (error) throw error;
      if (!data.session?.user) { signedOut(); return; }
      user = data.session.user; await showHome({ destination: initialMode });
    } catch (error) { message(error.message); }
  };
  globalThis.window?.addEventListener?.('pagehide', onPageHide);
  globalThis.window?.addEventListener?.('pageshow', onPageShow);
  const stop = () => { stopped = true; generation++; clearView(); subscription?.unsubscribe?.(); globalThis.window?.removeEventListener?.('pagehide', onPageHide); globalThis.window?.removeEventListener?.('pageshow', onPageShow); accountSlot.replaceChildren(); accountSlot.hidden = true; };
  try {
    pane.replaceChildren(el('p', 'rb-loading', 'Vérification de la connexion…'));
    client = await connect(config);
    const listener = client.auth.onAuthStateChange((event, session) => {
      if (stopped) return;
      if (event === 'SIGNED_OUT') signedOut();
      if (event === 'PASSWORD_RECOVERY') { recovering = true; user = session?.user ?? user; login(true); }
      if (event === 'SIGNED_IN' && session?.user && !recovering && user?.id !== session.user.id) {
        const ticket = ++generation, owner = session.user.id;
        clearView(); user = session.user; account(); pane.replaceChildren(el('p', 'rb-loading', 'Ouverture de votre compte…'));
        // Keep API calls outside the Auth callback lock, and discard a queued
        // sign-in if logout or another account change happened in the meantime.
        setTimeout(async () => {
          if (!active(ticket, owner) || recovering) return;
          try {
            const { data, error } = await client.auth.getSession(); if (error) throw error;
            if (!active(ticket, owner) || recovering || data.session?.user.id !== owner) return;
            await showHome({ destination: initialMode });
          } catch (error) { if (active(ticket, owner)) message(error.message); }
        }, 0);
      }
    });
    subscription = listener?.data?.subscription;
    const ticket = generation, { data, error } = await client.auth.getSession(); if (error) throw error;
    if (!stopped && generation === ticket) {
      user = data.session?.user;
      recovering = Boolean(user && new URLSearchParams(location.search).has('recovery'));
      if (recovering) login(true); else if (user) await showHome({ destination: initialMode }); else login();
    }
  } catch (error) {
    clearView(); message(`Connexion au jeu impossible : ${error.message}`);
    pane.replaceChildren(btn('Réessayer la connexion', async () => { stop(); await mountSession(root, { connect, config, storage, initialMode, careerView, matchView, onlineView }); }));
  }
  return { stop, showHome, get user() { return user; } };
}
