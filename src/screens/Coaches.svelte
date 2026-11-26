<script lang="ts">
  // Gestion des coachs autorisés (administrateurs uniquement ; les règles Firestore l'imposent aussi).
  import { onMount } from 'svelte';
  import { removeCoach, saveCoach, watchCoaches } from '../lib/cloud/account';
  import { account, isEmail, type Coach, type Role } from '../lib/cloud/state.svelte';

  let { onBack }: { onBack: () => void } = $props();

  let coaches = $state<Coach[]>([]);
  let loaded = $state(false);
  let listError = $state('');
  let email = $state('');
  let name = $state('');
  let role = $state<Role>('coach');
  let formError = $state('');
  let message = $state('');
  let confirmEmail = $state<string | null>(null);

  onMount(() =>
    watchCoaches(
      (list) => {
        coaches = list;
        loaded = true;
      },
      (msg) => (listError = msg),
    ),
  );

  async function add(e: SubmitEvent) {
    e.preventDefault();
    formError = '';
    message = '';
    if (!isEmail(email)) {
      formError = 'Saisissez une adresse e-mail valide.';
      return;
    }
    try {
      await saveCoach({ email, role, name });
      message = `${email.trim().toLowerCase()} peut maintenant se connecter.`;
      email = '';
      name = '';
      role = 'coach';
    } catch {
      formError = "L'ajout a échoué (réseau, ou droits d'administrateur manquants).";
    }
  }

  async function setRole(c: Coach, r: Role) {
    try {
      await saveCoach({ ...c, role: r });
    } catch {
      message = 'La modification a échoué.';
    }
  }

  async function remove(e: string) {
    try {
      await removeCoach(e);
      confirmEmail = null;
      message = `${e} a été retiré de la liste.`;
    } catch {
      message = 'Le retrait a échoué.';
    }
  }
</script>

<div class="page">
  <header>
    <button class="ghost back" onclick={onBack}>‹ Retour</button>
    <h1>Coachs du club</h1>
  </header>

  {#if account.role !== 'admin'}
    <p class="hint">Cet écran est réservé aux administrateurs.</p>
  {:else}
    <p class="hint">
      Seules les adresses de cette liste peuvent se connecter, synchroniser des matchs et partager un direct. Un
      administrateur peut aussi gérer cette liste.
    </p>

    <form class="card add" novalidate onsubmit={add}>
      <label for="c-email">Adresse e-mail du coach</label>
      <input id="c-email" type="email" bind:value={email} oninput={() => (formError = '')} placeholder="prenom.nom@exemple.fr" autocomplete="off" />
      <label for="c-name">Nom (facultatif)</label>
      <input id="c-name" bind:value={name} placeholder="Léo Martin" autocomplete="off" />
      <div class="roles" role="group" aria-label="Rôle">
        <button type="button" class:on={role === 'coach'} onclick={() => (role = 'coach')}>Coach</button>
        <button type="button" class:on={role === 'admin'} onclick={() => (role = 'admin')}>Administrateur</button>
      </div>
      {#if formError}<p class="error" role="alert">{formError}</p>{/if}
      <button type="submit" class="primary">Ajouter</button>
    </form>

    {#if message}<p class="hint" role="status">{message}</p>{/if}
    {#if listError}<p class="error" role="alert">{listError}</p>{/if}
    {#if loaded && coaches.length === 0}<p class="hint">Aucun coach pour l'instant.</p>{/if}

    <ul>
      {#each coaches as c (c.email)}
        <li class="card">
          <div class="line">
            <div class="id">
              <strong>{c.name || c.email}</strong>
              {#if c.name}<span>{c.email}</span>{/if}
            </div>
            <span class="badge" class:admin={c.role === 'admin'}>{c.role === 'admin' ? 'Administrateur' : 'Coach'}</span>
          </div>
          {#if c.email === account.email}
            <p class="hint">C'est vous : pour éviter de perdre l'accès, un administrateur ne peut pas se retirer lui-même.</p>
          {:else if confirmEmail === c.email}
            <div class="confirm">
              <span>Retirer {c.email} ? Il ne pourra plus se connecter.</span>
              <div class="row">
                <button onclick={() => (confirmEmail = null)}>Annuler</button>
                <button class="danger" onclick={() => remove(c.email)}>Retirer</button>
              </div>
            </div>
          {:else}
            <div class="row">
              <button onclick={() => setRole(c, c.role === 'admin' ? 'coach' : 'admin')}>
                {c.role === 'admin' ? 'Passer coach' : 'Passer administrateur'}
              </button>
              <button onclick={() => (confirmEmail = c.email)}>Retirer</button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 32px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .back {
    padding: 0 8px;
  }
  h1 {
    font-size: 22px;
    margin: 0;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
  .add,
  li {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .add label {
    margin: 0;
  }
  .roles,
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .roles button,
  .row button {
    min-height: 44px;
  }
  .on {
    background: var(--a-bg);
    color: var(--a);
    border: 2px solid var(--a-strong);
    font-weight: 600;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  li {
    padding: 12px;
  }
  .line {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: flex-start;
  }
  .id {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .id span {
    font-size: 13px;
    color: var(--muted);
  }
  .badge {
    flex: none;
    font-size: 12px;
    font-weight: 600;
    border-radius: 6px;
    padding: 2px 8px;
    background: var(--surface-2);
  }
  .badge.admin {
    background: var(--a-bg);
    color: var(--a);
  }
  .confirm {
    background: var(--danger-bg);
    color: var(--danger);
    border-radius: 10px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
  }
  .danger {
    background: var(--danger);
    border-color: var(--danger);
    color: var(--danger-bg);
    font-weight: 600;
  }
  .error {
    margin: 0;
  }
</style>
