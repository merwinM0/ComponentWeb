export interface Props {
  title: string;
  description: string;
  accent: string;
}

export interface ComponentDefinition {
  type: string;
  title: string;
  category: string;
  icon: string;
  description: string;
  size: [number, number];
  min: [number, number];
  defaults: Props;
  mount(host: HTMLElement, props: Props): {
    update(props: Props): void;
    destroy(): void;
  };
}

/** 模板仅允许开发者静态内容；用户文本通过 textContent 写入。 */
export function shadowComponent(host: HTMLElement, css: string, html: string, render: (root: ShadowRoot, props: Props) => void, props: Props) {
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>:host{display:block;width:100%;height:100%;font-family:inherit;box-sizing:border-box}*{box-sizing:border-box}${css}</style>${html}`;
  const update = (next: Props) => {
    host.style.setProperty('--accent', next.accent);
    render(root, next);
  };
  update(props);
  return { update, destroy: () => root.replaceChildren() };
}
