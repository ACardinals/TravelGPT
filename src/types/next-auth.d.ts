import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's id. */
      id: string;
      // email?: string | null; // email 已经是 DefaultSession 的一部分
      // name?: string | null; // name 已经是 DefaultSession 的一部分
      // image?: string | null; // image 已经是 DefaultSession 的一部分
    } & DefaultSession["user"]; // 合并默认的 user 属性，如 name, email, image
  }

  // 如果你也想在 User 对象上直接保证 id 的存在 (例如在 authorize 返回或 jwt 回调中的 user 参数)
  // interface User extends DefaultUser {
  //   id: string;
  // }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT extends DefaultJWT {
    /** OpenID ID Token */
    id?: string; // 在 jwt 回调中我们会添加 id
    // email?: string | null; // email 已经是 DefaultJWT 的一部分
  }
} 