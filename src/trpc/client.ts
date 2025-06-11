import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { AppRouter } from '@/server/routers/_app'; // 确保路径正确
import superjson from 'superjson';

function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // 浏览器应该使用相对路径
    return '';
  }
  if (process.env.VERCEL_URL) {
    // Vercel 部署的参考 URL
    return `https://${process.env.VERCEL_URL}`;
  }
  // 假设在 localhost 上运行
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const trpc = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
    }),
  ],
}); 