"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import Link from "next/link";
import type { TravelPlan } from "@/generated/prisma"; // 确保 Prisma 类型已导入

export default function MyPlansPage() {
  const { data: session, status } = useSession();
  const isLoadingSession = status === "loading";

  // 获取用户的旅行计划列表
  const { data: plans, isLoading: isLoadingPlans, error: plansError } = 
    api.travelPlan.listByUser.useQuery(
      undefined, // 此查询不需要输入参数
      { enabled: !!session?.user } // 仅当用户已登录时才执行查询
    );

  if (isLoadingSession) {
    return <p className="p-8 text-center">正在加载会话信息...</p>;
  }

  if (!session?.user) {
    return (
      <div className="p-8 text-center">
        <p>请先 <Link href="/" className="text-blue-600 hover:underline">登录</Link> 查看您的旅行计划。</p>
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4 sm:mb-0">我的旅行计划</h1>
        <Link href="/" className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
          创建新计划 &rarr;
        </Link>
      </div>

      {isLoadingPlans && <p className="text-center text-slate-600 py-10">正在加载旅行计划...</p>}
      
      {plansError && (
        <div className="p-5 mb-6 text-sm text-red-700 rounded-lg bg-red-100 border border-red-200 dark:bg-slate-800 dark:text-red-300 dark:border-red-600" role="alert">
          <svg className="inline flex-shrink-0 mr-3 w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path></svg>
          <span className="font-medium">错误!</span> 获取旅行计划失败: {plansError.message}
        </div>
      )}

      {plans && plans.length === 0 && !isLoadingPlans && (
        <div className="text-center py-10">
          <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-slate-800">暂无计划</h3>
          <p className="mt-1 text-sm text-slate-500">看起来您还没有创建任何旅行计划。</p>
          <div className="mt-6">
            <Link href="/" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              创建第一个计划
            </Link>
          </div>
        </div>
      )}

      {plans && plans.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan: TravelPlan) => (
            <div key={plan.id} className="col-span-1 bg-white rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 flex flex-col overflow-hidden">
              <div className="p-5 flex-grow">
                <Link href={`/my-plans/${plan.id}`} className="group">
                  <h3 className="text-xl font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                    {plan.title}
                  </h3>
                </Link>
                {plan.textContent && (
                  <p className="mt-2 text-sm text-slate-600 line-clamp-3 leading-relaxed">
                    {plan.textContent}
                  </p>
                )}
              </div>
              <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
                <div className="text-xs text-slate-500 mb-2">
                  <p>状态: <span className="font-medium text-slate-700 capitalize">{plan.status}</span></p>
                  <p>创建: {new Date(plan.createdAt).toLocaleDateString()}</p>
                </div>
                <Link href={`/my-plans/${plan.id}`} className="inline-block w-full text-center px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                  查看详情
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
} 