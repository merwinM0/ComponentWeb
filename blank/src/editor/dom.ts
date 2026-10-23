export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let timer: ReturnType<typeof setTimeout>;
export function toast(message: string) {
  const target = $('toast'); target.textContent = message; target.hidden = false;
  clearTimeout(timer); timer = setTimeout(() => { target.hidden = true; }, 4000);
}
