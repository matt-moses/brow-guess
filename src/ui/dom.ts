/** Tiny DOM builder. Text is always set via textContent (no HTML injection). */

export interface ElProps {
  class?: string;
  text?: string;
  attrs?: Record<string, string>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) node.setAttribute(k, v);
  for (const c of children) if (c !== null && c !== undefined) node.append(c);
  return node;
}

/** A real <button type="button">. */
export function button(
  text: string,
  cls: string,
  attrs: Record<string, string> = {},
): HTMLButtonElement {
  return el('button', { class: cls, text, attrs: { type: 'button', ...attrs } });
}
