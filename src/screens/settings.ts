import type { AppDeps } from '../deps.ts';
import type { Screen } from '../router.ts';
import {
  ROUND_SECONDS_OPTIONS,
  SENSITIVITIES,
  type Sensitivity,
  type Settings,
} from '../settings.ts';
import { button, el } from '../ui/dom.ts';

export interface SettingsProps {
  settings: Settings;
  /** Called on every change with the full, updated settings. */
  onChange: (settings: Settings) => void;
  onDone: () => void;
}

interface Choice<T> {
  value: T;
  label: string;
}

const SENSITIVITY_LABEL: Record<Sensitivity, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
};

function roundLabel(secs: number): string {
  return secs % 60 === 0 && secs > 60 ? `${secs / 60} min` : `${secs} s`;
}

let seq = 0;

/** A labelled group of radio buttons styled as one segmented control. */
function segmented<T>(
  legend: string,
  hint: string,
  choices: readonly Choice<T>[],
  current: T,
  onPick: (value: T) => void,
): HTMLElement {
  const name = `setting-${++seq}`;
  const options = el('div', { class: 'segmented' });
  for (const { value, label } of choices) {
    const input = el('input', { attrs: { type: 'radio', name } });
    input.checked = value === current;
    input.addEventListener('change', () => {
      if (input.checked) onPick(value);
    });
    options.append(el('label', { class: 'segment' }, input, el('span', { text: label })));
  }
  return el(
    'fieldset',
    { class: 'setting' },
    el('legend', { class: 'setting-name', text: legend }),
    options,
    el('p', { class: 'setting-hint', text: hint }),
  );
}

export const settingsScreen: Screen<SettingsProps, AppDeps> = {
  name: 'settings',
  mount(root, props) {
    let settings = { ...props.settings };
    const update = (patch: Partial<Settings>): void => {
      settings = { ...settings, ...patch };
      props.onChange(settings);
    };

    const done = button('Done', 'btn btn-primary');
    done.addEventListener('click', () => props.onDone());

    root.append(
      el(
        'main',
        { class: 'screen screen-settings' },
        el('h1', { class: 'settings-title', text: 'Settings' }),
        segmented(
          'Round length',
          'How long each player has to guess.',
          ROUND_SECONDS_OPTIONS.map((s) => ({ value: s, label: roundLabel(s) })),
          settings.roundSeconds,
          (roundSeconds) => update({ roundSeconds }),
        ),
        segmented(
          'Sound',
          'Beeps for the countdown, answers and the final seconds.',
          [
            { value: true, label: 'On' },
            { value: false, label: 'Off' },
          ],
          settings.sound,
          (sound) => update({ sound }),
        ),
        segmented(
          'Tilt sensitivity',
          'High needs only a small nod. Low ignores small wobbles.',
          SENSITIVITIES.map((s) => ({ value: s, label: SENSITIVITY_LABEL[s] })),
          settings.sensitivity,
          (sensitivity) => update({ sensitivity }),
        ),
        el('div', { class: 'actions' }, done),
      ),
    );
    done.focus();
  },
};
