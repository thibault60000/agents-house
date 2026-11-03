<script lang="ts">
  import type { Settings } from '@shared/types';
  import GlassPanel from '../GlassPanel.svelte';
  import { ui } from '../state.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let customName = $state('');
  let customCommand = $state('');
  let detecting = $state(false);

  const settings = $derived(ui.app?.settings);

  async function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    const state = await ui.call(() => window.house.updateSettings({ [key]: value }));
    if (state) ui.app = state;
  }

  async function chooseRoot() {
    const state = await ui.call(() => window.house.chooseRoot());
    if (state) ui.app = state;
  }

  async function redetect() {
    detecting = true;
    const list = await ui.call(() => window.house.listIdes(true));
    if (list) ui.ides = list;
    detecting = false;
  }

  async function addCustom() {
    const list = await ui.call(() => window.house.addCustomIde(customName, customCommand));
    if (list) {
      ui.ides = list;
      customName = '';
      customCommand = '';
    }
  }

  async function removeCustom(id: string) {
    const list = await ui.call(() => window.house.removeCustomIde(id));
    if (list) ui.ides = list;
  }

  async function recheckClaude() {
    const status = await ui.call(() => window.house.claudeStatus(true));
    if (status) ui.claude = status;
  }
</script>

<GlassPanel title="Réglages" {onclose}>
  {#if settings}
    <div class="content scroll stack">
      <section class="stack">
        <h3>Maison</h3>
        <div class="label">Dossier racine</div>
        <div class="path">{ui.app?.rootPath ?? 'Aucun'}</div>
        <button class="btn" onclick={chooseRoot}>Changer de dossier racine</button>
      </section>

      <section class="stack">
        <h3>IDE</h3>
        <label class="field">
          <span class="grow">IDE par défaut</span>
          <select class="select narrow" value={settings.defaultIdeId ?? ''} onchange={(event) => set('defaultIdeId', event.currentTarget.value || null)}>
            <option value="">Premier détecté</option>
            {#each ui.ides.filter((ide) => ide.available) as ide (ide.id)}
              <option value={ide.id}>{ide.name}</option>
            {/each}
          </select>
        </label>
        <div class="ides">
          {#each ui.ides as ide (ide.id)}
            <div class="ide" class:absent={!ide.available}>
              <span class="dot" class:on={ide.available}></span>
              <span class="grow truncate" title={ide.command}>{ide.name}</span>
              {#if ide.custom}
                <button class="btn btn-ghost btn-icon btn-danger" aria-label="Retirer {ide.name}" onclick={() => removeCustom(ide.id)}>✕</button>
              {/if}
            </div>
          {/each}
        </div>
        <button class="btn" disabled={detecting} onclick={redetect}>{detecting ? 'Détection…' : 'Re-détecter'}</button>
        <div class="label">IDE personnalisé</div>
        <form
          class="stack custom"
          onsubmit={(event) => {
            event.preventDefault();
            void addCustom();
          }}
        >
          <input class="input" placeholder="Nom, par exemple Kate" bind:value={customName} />
          <input class="input mono" placeholder={'Commande, par exemple kate {path}'} bind:value={customCommand} />
          <button class="btn" disabled={!customName.trim() || !customCommand.trim()}>Ajouter</button>
        </form>
      </section>

      <section class="stack">
        <h3>Agent</h3>
        <div class="row">
          <span class="dot" class:on={ui.claude?.available}></span>
          <span class="grow">{ui.claude?.available ? `Claude Code ${ui.claude.version ?? ''}` : 'Claude Code introuvable : mode démo'}</span>
          <button class="btn" onclick={recheckClaude}>Vérifier</button>
        </div>
        <label class="field">
          <span class="grow">Permissions de l'agent</span>
          <select class="select narrow" value={settings.permissionMode} onchange={(event) => set('permissionMode', event.currentTarget.value as Settings['permissionMode'])}>
            <option value="acceptEdits">Modifie les fichiers</option>
            <option value="auto">Automatique</option>
            <option value="plan">Plan seulement</option>
            <option value="dontAsk">Refuse sans demander</option>
            <option value="manual">Manuel</option>
            <option value="bypassPermissions">Aucune restriction</option>
          </select>
        </label>
        {#if settings.permissionMode === 'bypassPermissions'}
          <p class="warning">L'agent pourra lancer n'importe quelle commande sans confirmation sur cette machine.</p>
        {/if}
        <label class="field">
          <span class="grow">Modèle</span>
          <input class="input narrow" placeholder="Défaut de la CLI" value={settings.model} onchange={(event) => set('model', event.currentTarget.value.trim())} />
        </label>
        <label class="field">
          <span class="grow">Effort</span>
          <select class="select narrow" value={settings.effort} onchange={(event) => set('effort', event.currentTarget.value as Settings['effort'])}>
            <option value="">Défaut de la CLI</option>
            <option value="low">Bas</option>
            <option value="medium">Moyen</option>
            <option value="high">Élevé</option>
            <option value="xhigh">Très élevé</option>
            <option value="max">Maximal</option>
          </select>
        </label>
        <label class="field">
          <span class="grow">Alarmes lumineuses à 90 % des limites (petit appel à Haiku toutes les 5 min)</span>
          <input class="switch" type="checkbox" checked={settings.limitAlarms} onchange={(event) => set('limitAlarms', event.currentTarget.checked)} />
        </label>
      </section>

      <section class="stack">
        <h3>Graphismes</h3>
        <label class="field">
          <span class="grow">Qualité</span>
          <select class="select narrow" value={settings.quality} onchange={(event) => set('quality', event.currentTarget.value as Settings['quality'])}>
            <option value="low">Basse</option>
            <option value="medium">Moyenne</option>
            <option value="high">Haute</option>
          </select>
        </label>
        <label class="field"><span class="grow">Touffes d'herbe</span><input class="switch" type="checkbox" checked={settings.grass} onchange={(event) => set('grass', event.currentTarget.checked)} /></label>
        <label class="field"><span class="grow">Ombres</span><input class="switch" type="checkbox" checked={settings.shadows} onchange={(event) => set('shadows', event.currentTarget.checked)} /></label>
        <label class="field"><span class="grow">Post-traitement</span><input class="switch" type="checkbox" checked={settings.postProcess} onchange={(event) => set('postProcess', event.currentTarget.checked)} /></label>
        <label class="field"><span class="grow">Réfraction du verre</span><input class="switch" type="checkbox" checked={settings.liquidRefraction} onchange={(event) => set('liquidRefraction', event.currentTarget.checked)} /></label>
      </section>

      <section class="stack">
        <h3>Ambiance</h3>
        <label class="field">
          <span class="grow">Cycle jour/nuit</span>
          <select class="select narrow" value={settings.dayCycle} onchange={(event) => set('dayCycle', event.currentTarget.value as Settings['dayCycle'])}>
            <option value="real">Heure réelle</option>
            <option value="fast">Accéléré</option>
            <option value="day">Toujours le jour</option>
            <option value="night">Toujours la nuit</option>
          </select>
        </label>
        <label class="field">
          <span class="grow">Thème</span>
          <select class="select narrow" value={settings.theme} onchange={(event) => set('theme', event.currentTarget.value as Settings['theme'])}>
            <option value="auto">Système et cycle</option>
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
          </select>
        </label>
        <label class="field"><span class="grow">Sons</span><input class="switch" type="checkbox" checked={settings.sounds} onchange={(event) => set('sounds', event.currentTarget.checked)} /></label>
      </section>
    </div>
  {/if}
</GlassPanel>

<style>
  .content {
    flex: 1;
    min-height: 0;
    padding: var(--space-4);
    gap: var(--space-6);
  }

  h3 {
    font-size: 15px;
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .narrow {
    width: 180px;
    flex: none;
  }

  .ides {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px var(--space-3);
  }

  .ide {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 26px;
    font-size: 13px;
  }

  .ide.absent {
    color: var(--fg-faint);
  }

  .dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--fg-faint);
    opacity: 0.5;
  }

  .dot.on {
    background: var(--quest-done);
    opacity: 1;
  }

  .custom {
    gap: var(--space-2);
  }

  .warning {
    margin: 0;
    color: var(--quest-error);
    font-size: 12.5px;
  }
</style>
