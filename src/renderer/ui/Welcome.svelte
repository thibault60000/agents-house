<script lang="ts">
  import { ui } from './state.svelte';

  async function choose() {
    const state = await ui.call(() => window.house.chooseRoot());
    if (state) ui.app = state;
  }
</script>

<div class="wrap">
  <section class="card-welcome glass glass-liquid">
    <h1>Bienvenue à la maison</h1>
    <p class="muted">
      Choisis le dossier qui contient tes projets. Chaque sous-dossier deviendra une pièce, avec son agent, ses documents et son coffre.
    </p>
    <button class="btn btn-primary big" onclick={choose}>Choisir le dossier racine</button>
    {#if ui.claude && !ui.claude.available}
      <p class="faint">Claude Code n'a pas été trouvé : les agents joueront en mode démo tant qu'il n'est pas installé.</p>
    {/if}
  </section>
</div>

<style>
  .wrap {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: var(--space-5);
    z-index: 30;
  }

  .card-welcome {
    width: min(480px, 100%);
    padding: 36px;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    text-align: center;
    background: var(--glass-bg-strong);
  }

  h1 {
    font-size: 30px;
  }

  p {
    margin: 0;
  }

  .big {
    min-height: 44px;
    font-size: 15px;
  }
</style>
