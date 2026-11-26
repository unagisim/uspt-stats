<script lang="ts">
  // Carte « Compte coach » de l'accueil : connexion par lien e-mail et état du compte.
  import { account, accountApi, isEmail } from '../lib/cloud/state.svelte';

  let { onManageCoaches }: { onManageCoaches: () => void } = $props();

  let email = $state('');
  let error = $state('');

  async function submit(e: SubmitEvent, finish = false) {
    e.preventDefault();
    error = '';
    if (!isEmail(email)) {
      error = 'Saisissez une adresse e-mail valide.';
      return;
    }
    try {
      const api = await accountApi();
      await (finish ? api.finishSignIn(email) : api.sendLink(email));
    } catch {
      error = 'Connexion impossible pour le moment (réseau ?). Réessayez.';
    }
  }

  async function signOut() {
    try {
      await (await accountApi()).signOut();
    } catch {
      error = 'Déconnexion impossible pour le moment.';
    }
  }
</script>

<section class="card account">
  <h2>Compte coach</h2>

  {#if !account.ready}
    <p class="hint">Vérification de la connexion…</p>
  {:else if account.needsEmailToFinish}
    <p class="hint">Pour terminer la connexion sur cet appareil, confirmez l'adresse e-mail qui a reçu le lien.</p>
    <form novalidate onsubmit={(e) => submit(e, true)}>
      <input type="email" bind:value={email} oninput={() => (error = '')} placeholder="prenom.nom@exemple.fr" autocomplete="email" aria-label="Adresse e-mail" />
      <button class="primary" disabled={account.busy}>Terminer la connexion</button>
    </form>
  {:else if account.email}
    <p class="who">
      Connecté : <strong>{account.email}</strong>
      {#if account.role}<span class="role">{account.role === 'admin' ? 'Administrateur' : 'Coach'}</span>{/if}
    </p>
    {#if account.authorized === false}
      <p class="warn" role="alert">
        Cette adresse n'est pas dans la liste des coachs du club. Demandez à un administrateur de l'ajouter.
      </p>
    {:else if account.authorized === null}
      <p class="hint">Vérification de votre accès… (réseau nécessaire la première fois)</p>
    {:else}
      <p class="hint">La synchronisation des matchs et le suivi en direct arrivent dans les prochaines versions.</p>
    {/if}
    <div class="row">
      {#if account.role === 'admin'}<button onclick={onManageCoaches}>Gérer les coachs</button>{/if}
      <button class="ghost" onclick={() => signOut()}>Se déconnecter</button>
    </div>
  {:else if account.linkSentTo}
    <p class="ok" role="status">
      Lien envoyé à <strong>{account.linkSentTo}</strong>. Ouvrez l'e-mail sur ce téléphone et touchez le lien pour vous
      connecter. Pensez à regarder dans les courriers indésirables.
    </p>
    <button class="ghost" onclick={() => (account.linkSentTo = null)}>Utiliser une autre adresse</button>
  {:else}
    <p class="hint">
      Pour les coachs du club : connectez-vous pour synchroniser vos matchs et partager le score en direct. Un lien de
      connexion vous est envoyé par e-mail, sans mot de passe.
    </p>
    <form novalidate onsubmit={(e) => submit(e)}>
      <input type="email" bind:value={email} oninput={() => (error = '')} placeholder="prenom.nom@exemple.fr" autocomplete="email" aria-label="Adresse e-mail" />
      <button class="primary" disabled={account.busy}>{account.busy ? 'Envoi…' : 'Recevoir le lien de connexion'}</button>
    </form>
  {/if}

  {#if error || account.error}<p class="error" role="alert">{error || account.error}</p>{/if}
</section>

<style>
  .account {
    margin-top: 28px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  h2 {
    margin: 0;
    font-size: 18px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
  .who {
    margin: 0;
    font-size: 15px;
    overflow-wrap: anywhere;
  }
  .role {
    margin-left: 6px;
    background: var(--a-bg);
    color: var(--a);
    border-radius: 6px;
    padding: 1px 6px;
    font-size: 12px;
    font-weight: 600;
  }
  .warn {
    margin: 0;
    background: var(--warn-bg);
    color: var(--warn);
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 14px;
  }
  .ok {
    margin: 0;
    background: var(--b-bg);
    color: var(--b);
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row button {
    flex: 1;
  }
  .error {
    margin: 0;
  }
</style>
