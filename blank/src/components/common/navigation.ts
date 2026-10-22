import { common } from './factory';

export const navigation = common({
  name: 'navbar', title: '顶部导航', icon: '☰', tags: ['nav', 'a'], size: [28, 4], min: [15, 3],
  html: '<nav class="box row" aria-label="主导航"><strong data-title></strong><div class="links row"><a href="#" aria-current="page">概览</a><a href="#">组件</a><a href="#">文档</a></div><span class="subtle">工作空间 ↗</span></nav>',
  css: 'nav{justify-content:space-between}.links{gap:20px}a{color:var(--muted);text-decoration:none}a[aria-current]{color:var(--accent)}',
  setup(root, signal) { root.querySelectorAll('a').forEach(a => a.addEventListener('click', event => { event.preventDefault(); root.querySelectorAll('a').forEach(link => link.removeAttribute('aria-current')); a.setAttribute('aria-current', 'page'); }, { signal })); },
});

export const breadcrumb = common({
  name: 'breadcrumb', title: '面包屑', icon: '›', tags: ['nav', 'ol', 'a'], size: [16, 3],
  html: '<nav class="box" aria-label="面包屑"><ol><li><a href="#">工作空间</a></li><li aria-hidden="true">/</li><li><a href="#">组件库</a></li><li aria-hidden="true">/</li><li aria-current="page" data-title></li></ol></nav>',
  css: 'ol{display:flex;gap:12px;padding:0;margin:0;list-style:none;flex-wrap:wrap;font-size:12px}a{color:var(--muted);text-decoration:none}li[aria-current]{color:var(--accent)}',
  setup(root, signal) { root.querySelectorAll('a').forEach(a => a.addEventListener('click', e => e.preventDefault(), { signal })); },
});

export const pagination = common({
  name: 'pagination', title: '分页器', icon: '⋯', tags: ['nav', 'button'], size: [18, 4], min: [12, 3],
  html: '<nav class="box row" aria-label="分页"><span class="subtle" data-title></span><button data-step="-1" aria-label="上一页">‹</button><button data-page="1" aria-current="page">1</button><button data-page="2">2</button><button data-page="3">3</button><button data-step="1" aria-label="下一页">›</button></nav>',
  css: 'button[aria-current]{color:var(--accent);border-color:var(--accent)}',
  setup(root, signal) {
    let page = 1;
    const paint = () => {
      root.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(button => { if (Number(button.dataset.page) === page) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
      root.querySelector<HTMLButtonElement>('[data-step="-1"]')!.disabled = page === 1;
      root.querySelector<HTMLButtonElement>('[data-step="1"]')!.disabled = page === 3;
    };
    root.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.addEventListener('click', () => { page = button.dataset.page ? Number(button.dataset.page) : page + Number(button.dataset.step); paint(); }, { signal }));
    paint();
  },
});
