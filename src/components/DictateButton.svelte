<script lang="ts">
  // Dictée vocale : le texte reconnu est renvoyé par onText, puis reste modifiable dans le champ.
  // Utilise la reconnaissance vocale du navigateur (Chrome Android : en général via le réseau).
  import { onDestroy } from 'svelte';

  let { onText, label = 'Dicter' }: { onText: (text: string) => void; label?: string } = $props();

  interface Alternative {
    transcript: string;
  }
  interface Result {
    isFinal: boolean;
    0: Alternative;
  }
  interface Recognition {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((e: { resultIndex: number; results: ArrayLike<Result> }) => void) | null;
    onend: (() => void) | null;
    onerror: ((e: { error: string }) => void) | null;
  }
  type RecognitionCtor = new () => Recognition;
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  const SpeechCtor = w.SpeechRecognition ?? w.webkitSpeechRecognition;

  let recognition: Recognition | null = null;
  let listening = $state(false);
  let interim = $state('');
  let error = $state('');

  const ERRORS: Record<string, string> = {
    'not-allowed': 'Micro refusé : autorisez le micro pour cette application dans les réglages du téléphone.',
    'service-not-allowed': 'Dictée refusée par le téléphone. Vérifiez les autorisations du micro.',
    'no-speech': 'Aucune parole détectée. Réessayez en parlant près du téléphone.',
    network: 'La dictée nécessite une connexion réseau. Écrivez la note ou utilisez le micro du clavier.',
    'audio-capture': 'Aucun micro disponible sur cet appareil.',
    'language-not-supported': 'La dictée en français n’est pas disponible sur cet appareil.',
  };

  function toggle() {
    if (!SpeechCtor) return;
    if (listening) {
      recognition?.stop();
      return;
    }
    error = '';
    interim = '';
    recognition = new SpeechCtor();
    recognition.lang = 'fr-FR';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      let finalText = '';
      let partial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else partial += r[0].transcript;
      }
      interim = partial;
      const said = finalText.trim();
      if (said) {
        // Majuscule en début de note, comme à l'écrit.
        onText(said.charAt(0).toLocaleUpperCase('fr') + said.slice(1));
        interim = '';
      }
    };
    recognition.onerror = (e) => {
      if (e.error !== 'aborted') error = ERRORS[e.error] ?? 'Dictée indisponible pour le moment.';
    };
    recognition.onend = () => {
      listening = false;
      interim = '';
    };
    try {
      recognition.start();
      listening = true;
    } catch {
      error = 'Dictée indisponible pour le moment.';
    }
  }

  onDestroy(() => recognition?.abort());
</script>

{#if SpeechCtor}
  <div class="dictate">
    <button type="button" class="mic" class:rec={listening} onclick={toggle} aria-pressed={listening}>
      {#if listening}
        <span class="dot" aria-hidden="true"></span> J'écoute… toucher pour arrêter
      {:else}
        🎤 {label}
      {/if}
    </button>
    {#if listening && interim}<p class="live">{interim}</p>{/if}
    {#if error}<p class="err" role="alert">{error}</p>{/if}
  </div>
{:else}
  <p class="unsupported">
    La dictée n'est pas disponible dans ce navigateur : utilisez le micro du clavier du téléphone.
  </p>
{/if}

<style>
  .dictate {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mic {
    min-height: 52px;
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .mic.rec {
    background: var(--danger-bg);
    color: var(--danger);
    border-color: var(--danger);
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--danger);
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      transform: scale(0.6);
    }
  }
  .live {
    margin: 0;
    font-size: 14px;
    color: var(--muted);
    font-style: italic;
  }
  .err {
    margin: 0;
    font-size: 13px;
    color: var(--danger);
  }
  .unsupported {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }
</style>
