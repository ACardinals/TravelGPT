"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import Link from "next/link";
import { useParams, useRouter, notFound } from "next/navigation"; // 添加 notFound
import type { TravelPlan } from "@/generated/prisma"; 
// import Image from "next/image"; // 如果要直接显示图片，取消注释

// PageParams 不再需要，因为我们会直接从 useParams 获取 planId
// interface PageParams {
//   planId: string;
// }

// Define a type for chat messages
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  
  // 从 params 中安全地获取 planId
  const planId = typeof params.planId === 'string' ? params.planId : undefined;

  const { data: session, status: sessionStatus } = useSession();
  const isLoadingSession = sessionStatus === "loading";

  // 如果 planId 无效或不存在，可以提前处理，例如显示 notFound 页面
  // 但我们也将此逻辑交由 tRPC query 的 enabled 状态和错误处理
  // if (!planId) {
  //   notFound(); // 调用 Next.js 的 notFound 函数
  // }

  const utils = api.useUtils(); // 获取 tRPC Utils 用于手动刷新

  // State for chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentUserMessage, setCurrentUserMessage] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  // Updated Notification State to support confirmation dialogs
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'confirm';
    title?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  const { data: plan, isLoading: isLoadingPlan, error: planError, refetch: refetchPlan } = 
    api.travelPlan.getById.useQuery(
      { id: planId! }, // 使用 non-null assertion，因为 enabled 条件会保证 planId 存在
      { 
        enabled: !!session?.user && !!planId, // 确保 planId 是有效的字符串
        retry: (failureCount, error) => {
          if (error.data?.code === 'FORBIDDEN' || error.data?.code === 'NOT_FOUND') {
            return false;
          }
          return failureCount < 3;
        }
      }
    );
  
  // Query for conversation history
  const { data: conversationHistory, isLoading: isLoadingHistory } = 
    api.travelPlan.getConversationHistory.useQuery(
      { planId: planId! }, 
      {
        enabled: !!planId && !!session?.user && plan?.status === 'ANALYZED',
        // We might want to refetch if plan status changes to ANALYZED, 
        // but usually, the page will reload or plan data will update, re-triggering this.
      }
    );

  // Auto-grow textarea useEffect - ENSURE THIS IS PRESENT
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"; 
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [currentUserMessage]);

  // Effect to load history into chatMessages state once - THIS SHOULD ALREADY BE HERE
  useEffect(() => {
    if (conversationHistory && chatMessages.length === 0) {
      const formattedHistory = conversationHistory.map((msg: { id: string; role: "user" | "assistant"; content: string; createdAt: Date | string }) => ({
        id: msg.id,
        role: msg.role, 
        content: msg.content,
        timestamp: new Date(msg.createdAt),
      }));
      setChatMessages(formattedHistory);
    }
  }, [conversationHistory, chatMessages.length]);

  // 如果 planId 在路由中不存在 (例如用户手动输入错误 URL)，
  // 且 tRPC 查询因为 enabled: false 而未运行，或者 planId 不是预期的字符串，
  // 则 params.planId 可能不是有效字符串，导致 getById 查询的 input.id 无效。
  // 在这种情况下，我们应该显示一个错误或 "未找到" 页面。
  // tRPC 的 NOT_FOUND 错误会处理 planId 在数据库中找不到的情况。
  // 这里增加一个针对路由参数本身的检查：
  if (!planId && !isLoadingSession && sessionStatus !== 'unauthenticated') {
    // 如果 planId 无效 (不是字符串)，且会话已加载 (不是loading或未认证状态，避免在重定向到登录前误判)
    // 可以选择调用 notFound() 或显示自定义的 "无效计划ID" 消息。
    // router.push('/404'); // 或者重定向到404
    return (
        <main className="container mx-auto px-4 py-8 text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">无效的请求</h1>
            <p className="text-red-700 mb-6">旅行计划 ID 格式不正确或缺失。</p>
            <Link href="/my-plans" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                返回我的计划列表
            </Link>
        </main>
    );
  }

  // Updated showNotification function (can be split or expanded for confirmation)
  const showCustomModal = (config: {
    message: string;
    type: 'success' | 'error' | 'confirm';
    title?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  }) => {
    setNotification(config);
  };

  const analyzePlanMutation = api.travelPlan.analyzePlan.useMutation({
    onSuccess: (updatedPlan) => {
      // alert("计划分析完成！");
      showCustomModal({
        message: "计划分析成功完成！",
        type: 'success',
        title: "分析成功"
      });
      utils.travelPlan.getById.setData({ id: planId! }, updatedPlan);
      setChatMessages([]); 
    },
    onError: (error) => {
      // alert(`分析失败: ${error.message}`);
      showCustomModal({
        message: `分析失败: ${error.message}`,
        type: 'error',
        title: "分析错误"
      });
      setChatMessages([]); 
    },
  });

  // Chat Mutation
  const chatMutation = api.travelPlan.chatWithPlanAssistant.useMutation({
    onSuccess: (data) => {
      setChatMessages((prevMessages) => [
        ...prevMessages,
        { id: Math.random().toString(), role: "assistant", content: data.reply, timestamp: new Date() },
      ]);
      setIsAssistantTyping(false);
    },
    onError: (error) => {
      setChatMessages((prevMessages) => [
        ...prevMessages,
        { id: Math.random().toString(), role: "assistant", content: `抱歉，我暂时无法回复：${error.message}`, timestamp: new Date() },
      ]);
      setIsAssistantTyping(false);
    },
  });

  const clearChatHistoryMutation = api.travelPlan.clearConversationHistory.useMutation({
    onSuccess: (data) => {
      setChatMessages([]); 
      utils.travelPlan.getConversationHistory.invalidate({ planId: planId! });
      // alert(data.message || "聊天记录已清除。");
      showCustomModal({
        message: data.message || "聊天记录已成功清除。",
        type: 'success',
        title: "操作成功"
      });
    },
    onError: (error) => {
      // alert(`清除聊天记录失败: ${error.message}`);
      showCustomModal({
        message: `清除聊天记录失败: ${error.message}`,
        type: 'error',
        title: "操作失败"
      });
    },
  });

  // RE-ADD deletePlanMutation definition
  const deletePlanMutation = api.travelPlan.delete.useMutation({
    onSuccess: () => {
      showCustomModal({
        message: "计划已成功删除。",
        type: 'success',
        title: "删除成功"
      });
      router.push("/my-plans");
    },
    onError: (error) => {
      showCustomModal({
        message: `删除失败: ${error.message}`,
        type: 'error',
        title: "删除错误"
      });
    },
  });

  const handleStartAnalysis = () => {
    if (planId) {
      analyzePlanMutation.mutate({ id: planId });
    }
  };

  const handleDeletePlan = () => {
    if (!planId) return;
    showCustomModal({
      message: "您确定要删除此旅行计划及其所有相关数据（包括聊天记录）吗？此操作无法撤销。",
      type: 'confirm',
      title: "确认删除计划",
      confirmText: "确定删除",
      cancelText: "取消",
      onConfirm: () => {
        if (planId) { // Double check planId just in case, though it should be defined here
          deletePlanMutation.mutate({ id: planId });
        }
      },
      onCancel: () => {
        setNotification(null); // Just close the modal
      }
    });
  };

  const handleClearChatHistory = () => {
    if (!planId) return;
    showCustomModal({
      message: "您确定要清除此计划的所有聊天记录吗？此操作无法撤销。",
      type: 'confirm', 
      title: "确认清除",
      confirmText: "确定清除",
      cancelText: "取消",
      onConfirm: () => {
        clearChatHistoryMutation.mutate({ planId: planId! });
      },
      onCancel: () => {
        setNotification(null); // Just close the modal
      }
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserMessage.trim() || !planId || chatMutation.isPending) return;

    const newUserMessage: ChatMessage = {
      id: Math.random().toString(),
      role: "user",
      content: currentUserMessage.trim(),
      timestamp: new Date(),
    };
    
    // Prepare messages for API: current user message + limited history
    // Backend expects an array of messages. Client sends what it deems relevant.
    // Let's send the last N messages including the new one.
    const currentChatHistory = [...chatMessages, newUserMessage];
    const messagesForApi = currentChatHistory.slice(-6).map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    setChatMessages(currentChatHistory);
    setIsAssistantTyping(true); // Start typing indicator
    
    chatMutation.mutate({
      planId,
      messages: messagesForApi, // Send the new message and recent history
    });
    setCurrentUserMessage(""); // Clear input field
  };
  
  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, isAssistantTyping]); // Also scroll when typing indicator appears/disappears

  // Scroll event listener for chat container
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      // Show button if scrolled up more than, say, 300px from the bottom
      if (scrollHeight - scrollTop - clientHeight > 300) {
        setShowScrollToBottomButton(true);
      } else {
        setShowScrollToBottomButton(false);
      }
    };

    chatContainer.addEventListener('scroll', handleScroll);
    return () => {
      chatContainer.removeEventListener('scroll', handleScroll);
    };
  }, []); // Empty dependency array, so it runs once on mount and cleans up on unmount

  if (isLoadingSession || (isLoadingPlan && !planError && !plan)) {
    return <p className="p-8 text-center">正在加载数据...</p>;
  }

  if (!session?.user) {
    // 理论上，如果路由本身受保护或页面内容依赖会话，这里可能不需要，但作为健全性检查
    return (
      <div className="p-8 text-center">
        <p>请先 <Link href="/" className="text-blue-600 hover:underline">登录</Link> 查看此计划。</p>
      </div>
    );
  }
  
  if (planError) {
    return (
      <main className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">出错了</h1>
        <p className="text-red-700 mb-6">{planError.message || "无法加载旅行计划详情。"}</p>
        <button 
          onClick={() => router.push('/my-plans')} 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          返回我的计划列表
        </button>
      </main>
    );
  }

  if (!plan) {
    // 如果 planError 没有捕获到错误，但 plan 仍然是空的 (例如 enabled 条件变化导致查询未运行完成)
    return <p className="p-8 text-center">未找到计划详情或正在加载...</p>;
  }

  return (
    <>
      <main className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-start">
          <Link 
            href="/my-plans" 
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors"
          >
            <svg className="-ml-1 mr-2 h-5 w-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            返回我的计划列表
          </Link>
        </div>

        <article className="p-6 sm:p-8 bg-white rounded-xl shadow-xl">
          <header className="mb-8 pb-6 border-b border-slate-200">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">{plan.title}</h1>
            <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap sm:mt-4 sm:space-x-6">
              <div className="flex items-center text-sm text-slate-500">
                <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                创建于: {new Date(plan.createdAt).toLocaleDateString("zh-CN", { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div className="mt-2 flex items-center text-sm text-slate-500 sm:mt-0">
                <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                   <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                状态: <span className="font-semibold capitalize text-slate-700">{plan.status}</span>
              </div>
            </div>
          </header>

          {/* 编辑和删除按钮 */}
          <div className="mb-6 flex flex-wrap gap-3 items-center">
            <button
              onClick={() => router.push(`/my-plans/${plan.id}/edit`)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
              </svg>
              编辑
            </button>
            <button
              onClick={handleDeletePlan}
              disabled={deletePlanMutation.isPending}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:bg-red-300"
            >
              {deletePlanMutation.isPending ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
              {deletePlanMutation.isPending ? "删除中..." : "删除"}
            </button>

            {/* 开始分析按钮 - 仅当计划状态为 DRAFT (或其他你定义的可分析状态) */} 
            {plan && (plan.status === 'DRAFT' || plan.status === 'ANALYZED') && (
              <button
                onClick={handleStartAnalysis}
                disabled={analyzePlanMutation.isPending || plan.status === 'ANALYZING'}
                className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors 
                  ${plan.status === 'DRAFT' ? 'bg-green-500 hover:bg-green-600 focus:ring-green-400 disabled:bg-green-300' : 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-400 disabled:bg-blue-300'}
                `}
              >
                {analyzePlanMutation.isPending ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  plan.status === 'DRAFT' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586zM10 18a8 8 0 100-16 8 8 0 000 16zm-1-8v4a1 1 0 102 0v-4a1 1 0 10-2 0zM9 8a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm15-1a1 1 0 011 1v5.101a7.002 7.002 0 01-11.601-2.566 1 1 0 111.885-.666A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v2a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601 2.566 1 1 0 11-1.885-.666A5.002 5.002 0 005.999 13H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                  )
                )}
                {analyzePlanMutation.isPending 
                  ? (plan.status === 'ANALYZING' || utils.travelPlan.getById.getData({id: planId!})?.status === 'ANALYZING' ? '正在分析中...' : '正在重新分析...') 
                  : (plan.status === 'DRAFT' ? '开始智能分析' : '重新分析')}
              </button>
            )}
            {plan && plan.status === 'ANALYZING' && (
               <button
                disabled={true}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gray-400 rounded-lg focus:outline-none disabled:opacity-75"
              >
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                正在分析中...
              </button>
            )}
          </div>

          {plan.textContent && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-3">计划详情</h2>
              <div className="prose prose-slate max-w-none lg:prose-lg text-slate-700 leading-relaxed whitespace-pre-wrap">
                {plan.textContent}
              </div>
            </section>
          )}

          {plan.imageUrl && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800 mb-3">相关图片</h2>
              <a href={plan.imageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 hover:underline break-all block mb-3">
                {plan.imageUrl}
              </a>
              {/* Image display can be enhanced here */}
            </section>
          )}

          <section className="py-6 border-t border-slate-200">
            <h2 className="text-2xl font-semibold text-slate-800 mb-4">分析与建议</h2>
            <div className="space-y-3">
              <div>
                <span className="text-slate-600">可行性分数: </span>
                {plan?.feasibilityScore !== null ? 
                  <span className="font-bold text-slate-800">{plan?.feasibilityScore} / 10</span> : 
                  <span className="text-slate-500 italic">暂无</span>
                }
              </div>
              <div>
                <span className="text-slate-600">合理性分数: </span>
                {plan?.reasonablenessScore !== null ? 
                  <span className="font-bold text-slate-800">{plan?.reasonablenessScore} / 10</span> : 
                  <span className="text-slate-500 italic">暂无</span>
                }
              </div>
              {plan?.suggestions ? (
                <div className="pt-2">
                  <h3 className="text-lg font-medium text-slate-700 mb-1">综合改进建议:</h3>
                  <p className="text-slate-600 italic leading-relaxed whitespace-pre-wrap">{plan.suggestions}</p>
                </div>
              ) : (
                <p className="text-slate-500 italic">暂无改进建议。</p>
              )}
              {plan?.analysisDetails && (
                 <div className="pt-3 mt-3 border-t border-slate-200">
                   <h3 className="text-lg font-medium text-slate-700 mb-1">详细分析维度:</h3>
                   <div className="space-y-2 mt-2">
                    {(plan.analysisDetails as unknown as Array<{dimensionName: string, score: number | null, evaluation: string}>).map((detail, index) => (
                      <div key={index} className="p-3 bg-slate-100 rounded-md">
                        <p className="font-semibold text-slate-700">{detail.dimensionName}
                          {detail.score !== null && <span className="ml-2 font-normal">({detail.score}/10)</span>}
                        </p>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{detail.evaluation}</p>
                      </div>
                    ))}
                   </div>
                 </div>
               )}
            </div>
          </section>

          {/* Chat Section - Only if plan is ANALYZED */}
          {plan && plan.status === 'ANALYZED' && (
            <section className="mt-8 pt-6 border-t border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-slate-800">与智能助手对话</h2>
                {chatMessages.length > 0 && (
                  <button
                    onClick={handleClearChatHistory}
                    disabled={clearChatHistoryMutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-100 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {clearChatHistoryMutation.isPending ? "清除中..." : "清除聊天记录"}
                  </button>
                )}
              </div>
              <div 
                ref={chatContainerRef}
                className="h-80 overflow-y-auto p-4 border border-slate-300 rounded-lg mb-4 bg-slate-50 space-y-4"
              >
                {chatMessages.length === 0 && (
                  <p className="text-slate-500 text-center py-4">可以开始提问了，例如"帮我推荐一些第一天可以去的餐厅"或"这个行程会不会太赶？"</p>
                )}
                {chatMessages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Avatar DIVs are removed */}
                    <div 
                      className={`max-w-[75%] p-3 rounded-xl shadow-md ${
                        msg.role === 'user' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-white text-slate-800 border border-slate-200'}`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200 text-right' : 'text-slate-400 text-left'}`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {/* Assistant Typing Indicator */}
                {isAssistantTyping && (
                  <div className="flex justify-start">
                    <div className="max-w-[75%] p-3 rounded-xl shadow-md bg-white text-slate-800 border border-slate-200">
                      <p className="text-sm">
                        <span className="animate-pulse inline-block w-2 h-2 bg-slate-500 rounded-full mr-1"></span>
                        <span className="animate-pulse inline-block w-2 h-2 bg-slate-500 rounded-full mr-1 delay-150"></span>
                        <span className="animate-pulse inline-block w-2 h-2 bg-slate-500 rounded-full delay-300"></span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {/* Scroll to Bottom Button */}
              {showScrollToBottomButton && (
                <button 
                  onClick={() => {
                    chatContainerRef.current?.scrollTo({
                      top: chatContainerRef.current.scrollHeight,
                      behavior: 'smooth'
                    });
                  }}
                  className="absolute bottom-20 right-6 sm:right-10 p-2 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-opacity duration-200"
                  title="滚动到底部"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
              )}
              <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={currentUserMessage}
                  onChange={(e) => setCurrentUserMessage(e.target.value)}
                  placeholder="输入您的问题..."
                  className="flex-grow block w-full px-3.5 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow disabled:bg-slate-100 resize-none overflow-y-hidden"
                  disabled={chatMutation.isPending}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !chatMutation.isPending && currentUserMessage.trim()) {
                      e.preventDefault(); 
                      handleSendMessage(e as unknown as React.FormEvent);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={chatMutation.isPending || !currentUserMessage.trim()}
                  className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  {chatMutation.isPending ? (
                    <>
                      <svg className="animate-spin -mr-1 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {/* <span className="ml-2">发送中...</span> */}
                    </>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 16.51l.245.082a1 1 0 00.928-.006l.002-.001.006-.002.002-.001.245-.082a1 1 0 00.692-.006l5 1.428a1 1 0 001.17-1.408l-7-14zM10 4.868L12.898 10H7.102L10 4.868z" />
                    </svg>
                  )}
                </button>
              </form>
            </section>
          )}
        </article>
      </main>

      {/* Custom Notification Modal */}
      {notification && (
        // Removed bg-black bg-opacity-60 from the wrapper for a less intrusive dialog
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="notification-title">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md transform transition-all duration-300 ease-in-out scale-100 border border-gray-300">
            <div className="flex items-start">
              {notification.type === 'success' && (
                <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
              )}
              {notification.type === 'error' && (
                <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
              )}
              <div className="ml-4 text-left">
                <h3 className="text-lg leading-6 font-medium text-gray-900" id="notification-title">
                  {notification.title || (notification.type === 'success' ? '成功' : '错误')}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{notification.message}</p>
                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
              {notification.type === 'confirm' ? (
                <>
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm"
                    onClick={() => {
                      if (notification.onConfirm) notification.onConfirm();
                      setNotification(null); // Close modal after action
                    }}
                  >
                    {notification.confirmText || '确认'}
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                    onClick={() => {
                      if (notification.onCancel) notification.onCancel();
                      else setNotification(null); // Default cancel action
                    }}
                  >
                    {notification.cancelText || '取消'}
                  </button>
                </>
              ) : (
                // Original close button for success/error
                <button
                  type="button"
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:col-start-2 sm:text-sm ${notification.type === 'success' ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'} focus:outline-none focus:ring-2 focus:ring-offset-2`}
                  onClick={() => setNotification(null)}
                >
                  关闭
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
} 