"use client"; // tRPC Query需要客户端组件

import { api } from "@/trpc/react";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import type { TravelPlan } from "@/generated/prisma"; // 导入 Prisma 类型
import Link from "next/link"; // 确保 Link 已导入

export default function Home() {
  const { data: session, status } = useSession();
  const isLoadingSession = status === "loading";

  const [title, setTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Email for CredentialsProvider login
  const [email, setEmail] = useState("");

  const createPlanMutation = api.travelPlan.create.useMutation({
    onSuccess: (data: TravelPlan) => {
      alert(`计划创建成功! ID: ${data.id}`);
      setTitle("");
      setTextContent("");
      setImageUrl("");
    },
    onError: (error: any) => {
      alert(`创建失败: ${error.message}`);
    },
  });

  const handleCreatePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) {
      alert("请先登录后再创建计划。");
      return;
    }
    if (!title.trim()) {
      alert("标题不能为空");
      return;
    }
    createPlanMutation.mutate({ 
      title, 
      textContent, 
      imageUrl 
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // 对于 CredentialsProvider，我们只需要传递在 authorize 函数中期望的凭据。
    // 我们配置的 authorize 仅使用 email，password 字段是 NextAuth UI 的一部分但我们后端没用。
    const result = await signIn("credentials", { 
      redirect: false, // 避免页面跳转，除非显式处理
      email: email, 
      // password: "anypassword" // 如果 authorize 中需要密码，则传递
    });

    if (result?.error) {
      alert(`登录失败: ${result.error}`);
    } else if (result?.ok) {
      // 登录成功，useSession 会自动更新
      alert("登录成功!");
      setEmail("");
    }
  };

  if (isLoadingSession) {
    return <p className="p-8 text-center">正在加载会话信息...</p>;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 space-y-8 bg-slate-50">
      {/* 会话信息和导航 */} 
      <div className="w-full max-w-xl p-6 bg-white rounded-xl shadow-xl">
        <div className="flex justify-between items-center mb-5">
          <h1 className="text-2xl font-bold text-slate-800">旅行计划助手</h1>
          {session?.user && (
            <Link href="/my-plans" className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors">
              我的计划
            </Link>
          )}
        </div>
        {session?.user ? (
          <div className="space-y-3">
            <p className="text-slate-700">欢迎回来, <span className="font-semibold">{session.user.name || session.user.email}</span>!</p>
            {/* <p className="text-xs text-slate-500">用户 ID: {session.user.id}</p> */}
            <button 
              onClick={() => signOut()} 
              className="w-full px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
            >
              登出
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-700">您当前未登录。请登录以创建和管理您的旅行计划。</p>
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label htmlFor="email-login" className="block text-sm font-medium text-slate-700">邮箱:</label>
                <input 
                  id="email-login" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  className="mt-1 block w-full px-3 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow"
                  placeholder="you@example.com"
                />
              </div>
              <button 
                type="submit" 
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                登录 / 注册 (测试)
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 创建计划表单 (仅登录后显示) */} 
      {session?.user && (
        <div className="w-full max-w-xl mt-6 p-6 bg-white rounded-xl shadow-xl">
          <h2 className="text-xl font-semibold text-slate-800 mb-5">创建新的旅行计划</h2>
          <form onSubmit={handleCreatePlanSubmit} className="space-y-4">
            <div>
              <label htmlFor="title-create" className="block text-sm font-medium text-slate-700">标题 <span className="text-red-500">*</span></label>
              <input
                id="title-create"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 block w-full px-3 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow"
                required
                placeholder="例如：东京五日家庭游"
              />
            </div>
            <div>
              <label htmlFor="textContent-create" className="block text-sm font-medium text-slate-700">计划内容 (详细行程)</label>
              <textarea
                id="textContent-create"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={5}
                className="mt-1 block w-full px-3 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow"
                placeholder="第一天：参观浅草寺，晴空塔...\n第二天：..."
              />
            </div>
            <div>
              <label htmlFor="imageUrl-create" className="block text-sm font-medium text-slate-700">相关图片 URL (可选)</label>
              <input
                id="imageUrl-create"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="mt-1 block w-full px-3 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <button
              type="submit"
              disabled={createPlanMutation.isPending}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-slate-400 transition-colors"
            >
              {createPlanMutation.isPending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  提交中...
                </>
              ) : "创建计划"}
            </button>
          </form>
        </div>
      )}
      {/* 原 Next.js 默认内容已移除，可以根据需要添加页脚等 */}
    </main>
  );
}
