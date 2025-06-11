import NextAuth, { type AuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma"; // 确保 prisma 实例路径正确

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // EmailProvider 用于无密码登录 (需要邮件服务配置)
    // EmailProvider({
    //   server: process.env.EMAIL_SERVER,
    //   from: process.env.EMAIL_FROM,
    // }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "邮箱", type: "email", placeholder: "user@example.com" },
        password: { label: "密码", type: "password" }, // 简单起见，我们暂时不实际使用密码字段，而是硬编码
      },
      async authorize(credentials, req) {
        if (!credentials?.email) {
          return null;
        }
        // 注意：这是一个非常不安全的 authorize 实现，仅用于开发测试！
        // 生产环境中，您需要验证密码哈希等。
        try {
          let user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            // 如果用户不存在，则创建一个新用户
            // 在实际应用中，注册应该是独立的过程
            user = await prisma.user.create({
              data: {
                email: credentials.email,
                name: credentials.email.split('@')[0], // 从邮箱生成一个默认名字
              },
            });
          }
          // 只要提供了邮箱，就认为授权成功 (仅用于测试)
          return user;
        } catch (error) {
          console.error("Authorize error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt", // 或者 "database"，JWT 通常性能更好
  },
  callbacks: {
    // JWT 回调，用于将用户信息（如 id）添加到 JWT token 中
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        // 可以添加更多用户信息到 token
      }
      return token;
    },
    // Session 回调，用于将 JWT token 中的信息传递给客户端 session 对象
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        // 从 token 中同步其他信息到 session.user
      }
      return session;
    },
  },
  // pages: { // 自定义页面 (可选)
  //   signIn: '/auth/signin',
  //   // signOut: '/auth/signout',
  //   // error: '/auth/error', // Error code passed in query string as ?error=
  //   // verifyRequest: '/auth/verify-request', // (used for check email message)
  //   // newUser: '/auth/new-user' // New users will be directed here on first sign in (leave the property out to disable)
  // },
  // secret: process.env.NEXTAUTH_SECRET, // 在 .env 文件中设置 NEXTAUTH_SECRET
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 