import { CHARACTER_OPTIONS } from '../content/characters/options';
import type { CharacterAppearance, PlayerProfile, Presentation, ProfessionId, TaskKind } from '../core/types';
import { createPersistentId } from '../core/id';

const defaultAppearance: CharacterAppearance = {
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
            <p>Crie a pessoa que trabalhará lado a lado com Nina e Caio. Você poderá trocar de função a qualquer momento.</p>
          </div>
          <div class="creator-scene" aria-label="Pré-visualização do personagem">
            <div class="window-sun"></div><div class="window-plant">♧</div>
            <div class="character-preview" id="character-preview">
              <div class="preview-shadow"></div><div class="preview-legs"></div><div class="preview-body"><span>✿</span></div>
              <div class="preview-head"><i class="eye left"></i><i class="eye right"></i><i class="smile"></i></div><div class="preview-hair"></div>
            </div>
            <div class="preview-name" id="preview-name">Seu personagem</div>
          </div>
        </section>
        <section class="creator-form-wrap">
          <form class="creator-form" id="creator-form">
            <header><span>FICHA DO PERSONAGEM</span><strong>Seu novo começo</strong></header>
            <label class="field"><span>Como devemos chamar você?</span><input id="character-name" maxlength="18" placeholder="Digite um nome" autocomplete="off" required /></label>
            <fieldset><legend>Apresentação</legend><div class="choice-pills">
              <label><input type="radio" name="presentation" value="feminina" checked /><span>Feminina</span></label>
              <label><input type="radio" name="presentation" value="masculina" /><span>Masculina</span></label>
            </div></fieldset>
            ${selectField('skin', 'Tom de pele', CHARACTER_OPTIONS.skin)}
            ${selectField('hairStyle', 'Estilo de cabelo', CHARACTER_OPTIONS.hairStyle)}
            ${selectField('hairColor', 'Cor do cabelo', CHARACTER_OPTIONS.hairColor)}
            ${selectField('face', 'Rosto', CHARACTER_OPTIONS.face)}
            ${selectField('outfit', 'Roupa inicial', CHARACTER_OPTIONS.outfit)}
            ${selectField('outfitColor', 'Cor da roupa', CHARACTER_OPTIONS.outfitColor)}
            <div class="creator-note"><span>✦</span><p>Sua aparência e seu progresso ficam salvos neste dispositivo.</p></div>
            <button class="primary-button creator-submit" type="submit">Abrir o Bistrô <span>→</span></button>
          </form>
        </section>
      </main>`;

    const form = root.querySelector<HTMLFormElement>('#creator-form')!;
    const preview = root.querySelector<HTMLElement>('#character-preview')!;
    const nameInput = root.querySelector<HTMLInputElement>('#character-name')!;
    const submitButton = root.querySelector<HTMLButtonElement>('.creator-submit')!;
    let confirmationReady = false;
    const refresh = () => {
      const skin = CHARACTER_OPTIONS.skin.find((item) => item.id === appearance.skin)?.color ?? '#d99a68';
      const hair = CHARACTER_OPTIONS.hairColor.find((item) => item.id === appearance.hairColor)?.color ?? '#3a241d';
      const outfit = CHARACTER_OPTIONS.outfitColor.find((item) => item.id === appearance.outfitColor)?.color ?? '#1d766d';
      preview.style.setProperty('--skin', skin); preview.style.setProperty('--hair', hair); preview.style.setProperty('--outfit', outfit);
      preview.dataset.hair = appearance.hairStyle; preview.dataset.outfit = appearance.outfit; preview.dataset.presentation = appearance.presentation;
      root.querySelector<HTMLElement>('#preview-name')!.textContent = nameInput.value.trim() || 'Seu personagem';
    };
    form.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement;
      confirmationReady = false;
      submitButton.innerHTML = 'Abrir o Bistrô <span>→</span>';
      if (target.name === 'presentation') appearance.presentation = target.value as Presentation;
      else if (target.id && target.id in appearance) (appearance as unknown as Record<string, string>)[target.id] = target.value;
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
      const taskHistory = Object.fromEntries((['take_order', 'cook_step', 'deliver', 'payment', 'clean', 'stock_support'] as TaskKind[]).map((id) => [id, 0])) as PlayerProfile['taskHistory'];
      resolve({ id: createPersistentId('profile'), name, appearance: { ...appearance }, level: 1, xp: 0, helpRole: 'kitchen', professions, taskHistory });
    });
    refresh();
  });
}

function escapeCreatorText(value: string): string {
  const element = document.createElement('div');
  element.textContent = value;
  return element.innerHTML;
}

function selectField(id: keyof CharacterAppearance, label: string, options: readonly { id: string; label: string; color?: string }[]): string {
  const selected = defaultAppearance[id];
  return `<label class="field"><span>${label}</span><select id="${id}">${options.map((option) => `<option value="${option.id}" ${option.id === selected ? 'selected' : ''}>${option.label}</option>`).join('')}</select></label>`;
}
