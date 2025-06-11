import { publicProcedure, router } from '../trpc';

const TEST_USER_EMAIL = 'testuser@example.com';

export const userRouter = router({
  getOrCreateTestUser: publicProcedure
    .query(async ({ ctx }) => {
      let user = await ctx.prisma.user.findUnique({
        where: { email: TEST_USER_EMAIL },
      });

      if (!user) {
        user = await ctx.prisma.user.create({
          data: {
            email: TEST_USER_EMAIL,
            name: 'Test User',
          },
        });
      }
      return user;
    }),
}); 