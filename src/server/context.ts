import { PrismaClient } from '../generated/prisma/index';
import { prisma } from '../lib/prisma';
import { getServerSession, type Session as NextAuthSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { type inferAsyncReturnType } from '@trpc/server';
// Remove CreateNextContextOptions if not using Next.js Pages Router specific req/res
// import { type CreateNextContextOptions } from '@trpc/server/adapters/next';

/**
 * Defines your inner context shape.
 * Add fields here that a procedure should be able to access.
 */
interface CreateInnerContextOptions {
  session: NextAuthSession | null;
  prisma: PrismaClient;
  // req?: Request; // If you need the raw request in procedures for fetchRequestHandler
}

/**
 * Inner context. Will always be available in your procedures.
 * @link https://trpc.io/docs/v10/context
 */
export async function createContextInner(opts: CreateInnerContextOptions) {
  return {
    session: opts.session,
    prisma: opts.prisma,
    // req: opts.req,
  };
}

// Context for fetchRequestHandler (App Router)
// It might not need req/res in the same way as Pages Router
export type Context = inferAsyncReturnType<typeof createContextInner>; 
  // & { req?: Request }; // Add if you pass req through createContextInner

/**
 * Creates context for an incoming request
 * @link https://trpc.io/docs/v10/context
 */
export async function createContext(): Promise<Context> {
  // For App Router, getServerSession can often work without req/res explicitly,
  // relying on cookies handled by NextAuth.js internally or by authOptions.
  const session = await getServerSession(authOptions);
  
  const innerContext = await createContextInner({
    session,
    prisma,
    // req, // Pass the original request if needed by procedures
  });

  return innerContext;
} 