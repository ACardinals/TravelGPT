import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { travelPlanRouter } from './travelPlan';
import { userRouter } from './user';

export const appRouter = router({
  hello: publicProcedure
    .input(
      z.object({
        text: z.string(),
      }),
    )
    .query(({ input }) => {
      return {
        greeting: `hello ${input.text}`,
      };
    }),
  
  user: userRouter, 
  travelPlan: travelPlanRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter; 