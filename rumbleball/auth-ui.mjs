import { el, btn, field } from './career-components.mjs';

export function mountLogin(root, client, { recovery = false, onSession, message }) {
  const layout = el('section', 'rb-online-auth'), intro = el('div', 'rb-auth-intro'), panel = el('div', 'rb-auth-panel');
  intro.append(el('p', 'rb-eyebrow', 'Rumbleball Manager'), el('h2', '', 'Un compte. Tous vos clubs.'),
    el('p', '', 'Retrouvez vos carrières solo sur tous vos appareils et rejoignez vos ligues multijoueurs.'),
    el('p', 'rb-muted', 'Une partie déjà présente sur cet appareil sera sauvegardée sur votre compte à la connexion.'));
  const form = el('form', 'rb-online-form'), email = el('input'), password = el('input');
  email.type = 'email'; email.required = true; email.autocomplete = 'email'; email.setAttribute('aria-label', 'Adresse e-mail');
  password.type = 'password'; password.required = true; password.minLength = 8; password.autocomplete = recovery ? 'new-password' : 'current-password'; password.setAttribute('aria-label', recovery ? 'Nouveau mot de passe' : 'Mot de passe');
  form.append(el('h3', '', recovery ? 'Choisir un nouveau mot de passe' : 'Se connecter'));
  if (!recovery) form.append(field('Adresse e-mail', email));
  form.append(field(recovery ? 'Nouveau mot de passe' : 'Mot de passe', password));
  const submit = el('button', 'rb-button rb-button-primary', recovery ? 'Enregistrer le mot de passe' : 'Connexion'); submit.type = 'submit'; form.append(submit);
  const actions = el('div', 'rb-online-actions'); let busy = false;
  async function run(action) {
    if (busy) return; busy = true;
    for (const control of [submit, ...actions.querySelectorAll('button')]) control.disabled = true;
    try { await action(); } catch (error) { message(error.message); }
    finally { busy = false; for (const control of [submit, ...actions.querySelectorAll('button')]) control.disabled = false; }
  }
  form.addEventListener('submit', event => { event.preventDefault(); return run(async () => {
    const result = recovery ? await client.auth.updateUser({ password: password.value }) : await client.auth.signInWithPassword({ email: email.value, password: password.value });
    if (result.error) throw result.error;
    password.value = ''; await onSession(result.data.user);
  }); });
  if (!recovery) actions.append(btn('Créer un compte', () => run(async () => {
    if (!email.value || password.value.length < 8) throw new Error('Renseignez votre e-mail et un mot de passe d’au moins huit caractères.');
    const displayName = Array.from(email.value.trim().split('@')[0]).slice(0, 32).join('');
    const { data, error } = await client.auth.signUp({ email: email.value, password: password.value, options: {
      emailRedirectTo: new URL('./multi.html', location.href).href,
      data: { display_name: Array.from(displayName).length >= 2 ? displayName : 'Manager' },
    } });
    if (error) throw error;
    password.value = '';
    if (data.session) await onSession(data.user); else message('Consultez votre e-mail pour confirmer le compte, puis connectez-vous ici.', false);
  })), btn('Mot de passe oublié', () => run(async () => {
    if (!email.value) throw new Error('Renseignez votre adresse e-mail.');
    const { error } = await client.auth.resetPasswordForEmail(email.value, { redirectTo: new URL('./multi.html?recovery=1', location.href).href });
    if (error) throw error; message('Si ce compte existe, un lien de récupération vous a été envoyé.', false);
  })));
  panel.append(form, actions, el('p', 'rb-muted', 'Votre compte Riftbound Tracker fonctionne aussi ici. Les parties de Rumbleball restent séparées.'));
  layout.append(intro, panel); root.replaceChildren(layout);
}
