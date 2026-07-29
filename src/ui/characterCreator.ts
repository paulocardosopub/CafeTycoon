import { PLAYER_SKINS, playerSkinAsset } from '../content/characters/playerSkins';
import { CHARACTER_OPTIONS } from '../content/characters/options';
import { publicAssetUrl } from '../assets/pixel/publicAssetUrl';
import type { CharacterAppearance, PlayerProfile, ProfessionId, TaskKind } from '../core/types';
import { createPersistentId } from '../core/id';

const defaultAppearance: CharacterAppearance = {
  assetId: 'char_player_female_01',
  presentation: 'feminina', skin: 'honey', hairStyle: 'wave', hairColor: 'espresso',
  face: 'bright', outfit: 'apron', outfitColor: 'teal',
};

export function showCharacterCreator(root: HTMLElement): Promise<PlayerProfile> {
  return new Promise((resolve) => {
    const appearance = { ...defaultAppearance };
    root.innerHTML = `
      <main class="creator-screen">
        <section class="creator-story">
          <div class="brand-lockup"><span class="brand-flower">✿</span><div><b>Bistrô Bloom</b><small>Uma mesa, muitos sonhos</small></div></div>
          <div class="creator-copy">
            <span class="eyebrow">ANTES DE ABRIR AS PORTAS</span>
            <h1>Quem vai dar vida a este pequeno bistrô?</h1>
            <p>Escolha quem você será no restaurante. Os funcionários usarão uniforme de chef para que a equipe seja reconhecida rapidamente.</p>
          </div>
          <div class="creator-scene" aria-label="Pré-visualização do personagem">
            <div class="window-sun"></div><div class="window-plant">♧</div>
            <div class="character-preview" id="character-preview">
              <img id="character-preview-sprite" alt="Sprite definitivo do jogador" draggable="false" />
            </div>
            <div class="preview-name" id="preview-name">Seu personagem</div>
            <div class="preview-appearance" id="appearance-summary">Mel · Ondulado · Espresso</div>
          </div>
        </section>
        <section class="creator-form-wrap">
          <form class="creator-form" id="creator-form">
            <header><span>FICHA DO PERSONAGEM</span><strong>Seu novo começo</strong></header>
            <label class="field"><span>Como devemos chamar você?</span><input id="character-name" maxlength="18" placeholder="Digite um nome" autocomplete="off" required /></label>
            <fieldset class="player-skin-picker"><legend>Escolha sua aparência</legend><p>Esta será a roupa do seu personagem dentro do restaurante.</p><div class="player-skin-grid">
              ${PLAYER_SKINS.map((skin) => `<label><input type="radio" name="playerSkin" value="${skin.assetId}" ${skin.assetId === defaultAppearance.assetId ? 'checked' : ''}/><span><img src="${publicAssetUrl(skin.thumbnail)}" alt=""/><b>${escapeCreatorText(skin.label)}</b></span></label>`).join('')}
            </div></fieldset>
            <fieldset class="appearance-detail-picker"><legend>Personalize os detalhes</legend><p>Essas escolhas ficam salvas no perfil do jogador.</p>
              ${appearanceChoices('skin', 'Tom de pele', CHARACTER_OPTIONS.skin)}
              ${appearanceChoices('hairStyle', 'Estilo de cabelo', CHARACTER_OPTIONS.hairStyle)}
              ${appearanceChoices('hairColor', 'Cor de cabelo', CHARACTER_OPTIONS.hairColor)}
            </fieldset>
            <div class="creator-note"><span>✦</span><p>Sua aparência e seu progresso ficam salvos neste dispositivo.</p></div>
            <button class="primary-button creator-submit" type="submit">Abrir o Bistrô <span>→</span></button>
          </form>
        </section>
      </main>`;

    const form = root.querySelector<HTMLFormElement>('#creator-form')!;
    const preview = root.querySelector<HTMLElement>('#character-preview')!;
    const appearanceSummary = root.querySelector<HTMLElement>('#appearance-summary')!;
    const nameInput = root.querySelector<HTMLInputElement>('#character-name')!;
    const submitButton = root.querySelector<HTMLButtonElement>('.creator-submit')!;
    let confirmationReady = false;
    const refresh = () => {
      preview.dataset.hair = appearance.hairStyle;
      preview.dataset.skin = appearance.skin;
      preview.dataset.hairColor = appearance.hairColor;
      preview.dataset.outfit = appearance.outfit;
      preview.dataset.presentation = appearance.presentation;
      const skin = CHARACTER_OPTIONS.skin.find((option) => option.id === appearance.skin);
      const hairStyle = CHARACTER_OPTIONS.hairStyle.find((option) => option.id === appearance.hairStyle);
      const hairColor = CHARACTER_OPTIONS.hairColor.find((option) => option.id === appearance.hairColor);
      preview.style.setProperty('--preview-skin', skin?.color ?? '#d99a68');
      preview.style.setProperty('--preview-hair', hairColor?.color ?? '#3a241d');
      const assetId = playerSkinAsset(appearance);
      root.querySelector<HTMLImageElement>('#character-preview-sprite')!.src = publicAssetUrl(`assets/pixel/rendered/thumbnails/${assetId}.png?v=0.0.7-c3-br-2`);
      root.querySelector<HTMLElement>('#preview-name')!.textContent = nameInput.value.trim() || 'Seu personagem';
      appearanceSummary.textContent = `${skin?.label ?? 'Mel'} · ${hairStyle?.label ?? 'Ondulado'} · ${hairColor?.label ?? 'Espresso'}`;
    };
    form.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      confirmationReady = false;
      submitButton.innerHTML = 'Abrir o Bistrô <span>→</span>';
      if (target.name === 'playerSkin') {
        const skin = PLAYER_SKINS.find((entry) => entry.assetId === target.value);
        if (skin) { appearance.assetId = skin.assetId; appearance.presentation = skin.presentation; }
      }
      refresh();
    });
    form.addEventListener('click', (event) => {
      const control = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-appearance-field]');
      if (!control) return;
      const field = control.dataset.appearanceField as 'skin' | 'hairStyle' | 'hairColor';
      const value = control.dataset.value;
      if (!value) return;
      appearance[field] = value;
      form.querySelectorAll<HTMLButtonElement>(`[data-appearance-field="${field}"]`).forEach((button) => {
        const selected = button.dataset.value === value;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      confirmationReady = false;
      submitButton.innerHTML = 'Abrir o Bistrô <span>→</span>';
      refresh();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      if (!confirmationReady) {
        confirmationReady = true;
        submitButton.innerHTML = `Confirmar ${escapeCreatorText(name)} <span>✓</span>`;
        return;
      }
      const professions = Object.fromEntries((['cook', 'waiter', 'cleaner', 'stocker'] as ProfessionId[]).map((id) => [id, { xp: 0, level: 1, tasksCompleted: 0 }])) as PlayerProfile['professions'];
      const taskHistory = Object.fromEntries((['take_order', 'cook_step', 'deliver', 'payment', 'clean', 'stock_support', 'restock_purchase', 'production_batch'] as TaskKind[]).map((id) => [id, 0])) as PlayerProfile['taskHistory'];
      resolve({ id: createPersistentId('profile'), name, appearance: { ...appearance }, level: 1, xp: 0, helpRole: 'manager', professions, taskHistory });
    });
    refresh();
  });
}

function appearanceChoices(
  field: 'skin' | 'hairStyle' | 'hairColor',
  label: string,
  options: readonly { id: string; label: string; color?: string }[],
): string {
  const current = defaultAppearance[field];
  return `<div class="appearance-choice"><span>${label}</span><div class="appearance-choice-options">${options.map((option) => `<button type="button" data-appearance-field="${field}" data-value="${option.id}" aria-pressed="${option.id === current}" class="${option.id === current ? 'active' : ''}">${option.color ? `<i style="--choice-color:${option.color}"></i>` : ''}${escapeCreatorText(option.label)}</button>`).join('')}</div></div>`;
}

function escapeCreatorText(value: string): string {
  const element = document.createElement('div');
  element.textContent = value;
  return element.innerHTML;
}
