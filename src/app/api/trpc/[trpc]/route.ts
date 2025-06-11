import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/routers/_app';
import { createContext } from '@/server/context';
import { type NextRequest } from 'next/server';

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async () => createContext(),
    onError: ({ error, path }: { error: Error; path?: string }) => {
      console.error(`tRPC failed on ${path ?? ''}: ${error.message}`);
    },
  });

export { handler as GET, handler as POST }; 