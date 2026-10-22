import page from './blank/index.html';

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  routes: { '/': page },
  development: { hmr: true, console: true },
});
console.log(`组件工作台已启动：${server.url}`);
