<script lang="ts">
  import { onMount } from 'svelte';
  import Home from './screens/Home.svelte';
  import LiveMatch from './screens/LiveMatch.svelte';
  import NewMatch from './screens/NewMatch.svelte';
  import Presets from './screens/Presets.svelte';
  import Stats from './screens/Stats.svelte';

  type Route =
    | { name: 'home' }
    | { name: 'new' }
    | { name: 'live'; id: string }
    | { name: 'stats'; id: string }
    /** `matchId` : ouvert depuis la saisie d'un match, on y revient ensuite. */
    | { name: 'presets'; matchId?: string };

  let route = $state<Route>({ name: 'home' });

  // Le bouton retour d'Android ramène à l'accueil au lieu de fermer l'application.
  function go(next: Route) {
    if (route.name === 'home' && next.name !== 'home') history.pushState({ app: true }, '');
    if (next.name === 'home' && route.name !== 'home') {
      route = next;
      history.back();
      return;
    }
    route = next;
  }

  onMount(() => {
    const onPop = () => {
      route = { name: 'home' };
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  });
</script>

{#if route.name === 'home'}
  <Home
    onNew={() => go({ name: 'new' })}
    onOpen={(id) => go({ name: 'live', id })}
    onPresets={() => go({ name: 'presets' })}
  />
{:else if route.name === 'new'}
  <NewMatch onCancel={() => go({ name: 'home' })} onCreated={(id) => (route = { name: 'live', id })} />
{:else if route.name === 'presets'}
  {@const matchId = route.matchId}
  <Presets onBack={() => (matchId ? (route = { name: 'live', id: matchId }) : go({ name: 'home' }))} />
{:else if route.name === 'stats'}
  {@const id = route.id}
  <Stats {id} onBack={() => (route = { name: 'live', id })} />
{:else}
  {@const id = route.id}
  {#key id}
    <LiveMatch
      {id}
      onExit={() => go({ name: 'home' })}
      onStats={() => (route = { name: 'stats', id })}
      onPresets={() => (route = { name: 'presets', matchId: id })}
    />
  {/key}
{/if}
