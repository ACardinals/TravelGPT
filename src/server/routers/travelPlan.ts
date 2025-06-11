import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import OpenAI from 'openai';
import { queryCollection } from '../services/vectorDBService';

// 确保 DASHSCOPE_API_KEY 环境变量已设置
if (!process.env.DASHSCOPE_API_KEY) {
  console.warn("DASHSCOPE_API_KEY is not set. Real LLM calls will fail.");
  // throw new Error("DASHSCOPE_API_KEY is not set. Real LLM calls will fail."); // 或者在开发阶段只警告
}

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY || "dummy_key_for_dev_if_not_set", // 在没有设置时提供一个虚拟值避免初始化错误
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

export const travelPlanRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, { message: "标题不能为空" }),
        textContent: z.string().optional(),
        imageUrl: z.string().url({ message: "无效的图片 URL" }).or(z.literal('')).optional().transform(val => val === '' ? undefined : val),
        // userId 不再由客户端提供
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { title, textContent, imageUrl } = input;
      const userId = ctx.session.user.id; // 从 session 中获取 userId

      const newTravelPlan = await ctx.prisma.travelPlan.create({
        data: {
          title,
          textContent,
          imageUrl,
          userId, // 使用从 session 中获取的 userId
        },
      });
      return newTravelPlan;
    }),

  listByUser: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const plans = await ctx.prisma.travelPlan.findMany({
        where: {
          userId: userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      return plans;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid({ message: "无效的计划 ID" }) }))
    .query(async ({ ctx, input }) => {
      const { id } = input;
      const userId = ctx.session.user.id;

      const plan = await ctx.prisma.travelPlan.findUnique({
        where: { id },
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '未找到指定的旅行计划。',
        });
      }

      // 验证计划是否属于当前用户
      if (plan.userId !== userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '您无权查看此计划。',
        });
      }
      return plan;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid({ message: "无效的计划 ID" }),
        title: z.string().min(1, { message: "标题不能为空" }).optional(),
        textContent: z.string().optional(),
        imageUrl: z.string().url({ message: "无效的图片 URL" }).optional().nullable(), // 允许清空
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, title, textContent, imageUrl } = input;
      const userId = ctx.session.user.id;

      const planToUpdate = await ctx.prisma.travelPlan.findUnique({
        where: { id },
      });

      if (!planToUpdate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '未找到要更新的旅行计划。',
        });
      }

      if (planToUpdate.userId !== userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '您无权修改此计划。',
        });
      }

      const updatedPlan = await ctx.prisma.travelPlan.update({
        where: { id },
        data: {
          // 只有当字段在输入中提供时才更新
          ...(title !== undefined && { title }),
          ...(textContent !== undefined && { textContent }),
          // imageUrl 可以是 null 来表示删除
          ...(imageUrl !== undefined && { imageUrl }), 
        },
      });
      return updatedPlan;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid({ message: "无效的计划 ID" }) }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;
      const userId = ctx.session.user.id;

      const planToDelete = await ctx.prisma.travelPlan.findUnique({
        where: { id },
      });

      if (!planToDelete) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '未找到要删除的旅行计划。',
        });
      }

      if (planToDelete.userId !== userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '您无权删除此计划。',
        });
      }

      await ctx.prisma.travelPlan.delete({
        where: { id },
      });

      return { success: true, message: '计划已成功删除。' };
    }),

  analyzePlan: protectedProcedure
    .input(z.object({ id: z.string().cuid({ message: "无效的计划 ID" }) }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;
      const userId = ctx.session.user.id;

      if (!process.env.DASHSCOPE_API_KEY) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '模型服务 API 密钥未配置，无法执行分析。',
        });
      }

      const planToAnalyze = await ctx.prisma.travelPlan.findUnique({
        where: { id },
      });

      if (!planToAnalyze) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '未找到要分析的旅行计划。',
        });
      }

      if (planToAnalyze.userId !== userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '您无权分析此计划。',
        });
      }
      
      // 如果计划当前正在分析中，则阻止新的分析请求
      if (planToAnalyze.status === 'ANALYZING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '此计划目前正在分析中，请等待分析完成后再尝试。',
        });
      }

      // 更新状态为分析中 (无论之前是 DRAFT 还是 ANALYZED)
      await ctx.prisma.travelPlan.update({
        where: { id },
        data: { status: 'ANALYZING' },
      });

      try {
        const systemMessage = "你是一位经验丰富且细致的旅行计划分析师。你的任务是根据用户提供的旅行计划文本，进行全面的分析，并以严格的JSON格式返回你的评估结果。请确保你的分析客观、具有建设性，并帮助用户改进他们的计划。严格按照用户指定的JSON结构输出，不要包含任何JSON对象之外的额外文本或解释。";
        
        const userPromptContent = `
请仔细分析以下旅行计划文本：
---
计划标题：${planToAnalyze.title}
计划内容：
${planToAnalyze.textContent || "未提供详细内容"}
---

根据上述计划，请提供一个严格的JSON对象作为分析结果，包含以下顶级字段：

1.  "feasibilityScore": 数字，0到10之间的总体可行性评分。可行性主要评估计划在现实条件下的可执行程度，包括时间分配、季节适宜性、交通接驳、预算（如果提及）等方面。10分表示非常可行。
2.  "reasonablenessScore": 数字，0到10之间的总体合理性评分。合理性主要评估行程安排的逻辑性、流畅度、松紧适宜度、活动组合是否得当等。10分表示非常合理。
3.  "overallSuggestions": 字符串，针对整个计划提出的综合改进建议。
    *   请至少提供3条建议。
    *   每条建议都应具有**高度的可操作性**。例如，不要只说"可以增加文化体验"，而应建议"可以在第二天下午参观XX博物馆，预计停留2小时"。
    *   明确指出计划的**亮点**（如果有）。
    *   对于计划中的**主要不足之处**，每指出一点不足，都必须伴随**至少一个具体的改进方案**。
    *   总字数不少于80字。
4.  "detailedAnalysis": 一个JSON数组，包含对以下固定维度的详细分析。每个维度都是数组中的一个对象，必须包含 "dimensionName" (字符串，维度名称), "score" (数字, 0-10的评分, 如果该维度不适合评分则为null), 和 "evaluation" (字符串, 对该维度的具体评价和建议，至少30字)。
    *   在 "evaluation" 中，如果评价不是完全正面的，**必须包含至少一个具体的、可操作的改进建议**。
    请确保 "detailedAnalysis" 数组包含针对以下所有维度的分析对象：
    - { "dimensionName": "行程饱满度与节奏", "score": (0-10 or null), "evaluation": "评价行程是否过于紧凑或松散，每日活动量是否均衡。若有问题，请给出调整建议，例如：'建议将A活动移至B日，为C活动留出更多时间'。" }
    - { "dimensionName": "交通方式与衔接", "score": (0-10 or null), "evaluation": "评价计划中提及的交通方式是否合适、经济、高效，以及不同地点间的交通接驳是否顺畅。如果未提及或存在问题，请具体建议，例如：'从X到Y可考虑乘坐Z号地铁，大约需要N分钟'。" }
    - { "dimensionName": "住宿安排（若提及）", "score": (0-10 or null), "evaluation": "如果计划中提及住宿类型或地点，评价其是否合适（例如位置、交通便利性）。如果未提及或不合适，则指出需要补充住宿规划或给出区域性建议。" }
    - { "dimensionName": "预算考量（若提及）", "score": (0-10 or null), "evaluation": "如果计划中提及预算，评价其是否合理。如果未提及或不合理，则指出需要明确预算或建议如何调整开支项目。" }
    - { "dimensionName": "活动多样性与深度", "score": (0-10 or null), "evaluation": "评价计划中的活动是否多样化（如观光、文化、休闲、美食等），以及是否有足够的时间进行深度体验。若不足，请建议可以增加哪些类型的活动或如何深化体验。"}
    - { "dimensionName": "潜在风险与安全提示", "score": null, "evaluation": "根据计划的目的地和活动，指出可能的风险点（如天气、安全、健康、预订要求等）并给出相应提示。提示应具体，例如：'XX地区夏季炎热，请注意防晒补水'或'参观YY景点需提前在线预约'。" }
    - { "dimensionName": "信息完整度", "score": (0-10 or null), "evaluation": "评价计划提供的信息是否足够进行全面分析，指出哪些关键信息缺失（如具体日期、参与人数、详细预算、个人偏好等）。对于每项缺失的关键信息，都应说明其重要性。" }

如果用户提供的计划文本非常简短或信息不足（例如少于50字），请在各项评分中酌情给出较低分数（例如1-3分），并在 "evaluation" 和 "overallSuggestions" 中明确指出信息不足的问题，并具体建议用户补充哪些核心信息（例如：目的地、天数、主要活动）以便进行更准确的分析。

请严格按照此JSON结构输出，不要有任何偏差。
        `;

        const completion = await openai.chat.completions.create({
          model: "qwen-plus", // 你选择的模型
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: userPromptContent },
          ],
          temperature: 0.3, // 稍降低温度，期望更稳定的结构化输出
          // response_format: { type: "json_object" }, // 保持尝试，如果模型和兼容模式支持
        });

        let analysisResultJson;
        const content = completion.choices[0]?.message?.content;

        if (!content) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: '模型未返回任何内容。',
          });
        }

        try {
          analysisResultJson = JSON.parse(content);
        } catch (e) {
          console.error("Failed to parse LLM JSON response:", e);
          console.error("LLM Raw Response:", content);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `模型返回的内容不是有效的JSON格式。原始返回: ${content.substring(0,1000)}`,
          });
        }
        
        // 增强验证逻辑
        if (typeof analysisResultJson.feasibilityScore !== 'number' ||
            typeof analysisResultJson.reasonablenessScore !== 'number' ||
            typeof analysisResultJson.overallSuggestions !== 'string' ||
            !Array.isArray(analysisResultJson.detailedAnalysis) ||
            analysisResultJson.detailedAnalysis.length < 7) { // 确保至少有7个维度
          console.error("LLM JSON response missing required fields, has wrong types, or detailedAnalysis is incomplete:", analysisResultJson);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: '模型返回的JSON数据结构不符合预期或详细分析维度不完整。',
          });
        }

        // 可选：更细致地验证 detailedAnalysis 数组中每个对象的结构
        for (const item of analysisResultJson.detailedAnalysis) {
          if (typeof item.dimensionName !== 'string' || 
              (typeof item.score !== 'number' && item.score !== null) || 
              typeof item.evaluation !== 'string') {
            console.error("LLM JSON response: detailedAnalysis item has wrong structure:", item);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: '模型返回的JSON中详细分析条目结构不符合预期。',
            });
          }
        }

        const analyzedPlan = await ctx.prisma.travelPlan.update({
          where: { id },
          data: {
            feasibilityScore: analysisResultJson.feasibilityScore,
            reasonablenessScore: analysisResultJson.reasonablenessScore,
            suggestions: analysisResultJson.overallSuggestions, // 注意这里用 overallSuggestions 赋值给 Prisma 的 suggestions
            analysisDetails: analysisResultJson.detailedAnalysis, // 将LLM返回的 detailedAnalysis 数组存入 Prisma 的 analysisDetails (Json类型)
            status: 'ANALYZED',
          },
        });

        return analyzedPlan;

      } catch (error: any) {
        // 如果分析失败，将状态重置回 DRAFT (或其他适当的状态)
        await ctx.prisma.travelPlan.update({
          where: { id },
          data: { status: 'DRAFT' }, // 或者 FAILED_ANALYSIS
        });

        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("LLM API call failed:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `与模型服务通信失败: ${error.message || '未知错误'}`,
        });
      }
    }),

  chatWithPlanAssistant: protectedProcedure
    .input(
      z.object({
        planId: z.string().cuid({ message: "无效的计划 ID" }),
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string().min(1, { message: "消息内容不能为空" }),
          })
        ).min(1, { message: "至少需要一条消息" }), // 确保至少有用户的一条新消息
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { planId, messages } = input;
      const userId = ctx.session.user.id;

      // 1. 验证计划是否存在以及用户是否有权访问
      const plan = await ctx.prisma.travelPlan.findUnique({
        where: { id: planId },
      });

      if (!plan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '未找到指定的旅行计划。' });
      }
      if (plan.userId !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '您无权与此计划的助手聊天。' });
      }

      // 2. 保存用户最新消息
      const userMessageContent = messages[messages.length - 1].content;
      await ctx.prisma.planConversation.create({
        data: {
          planId,
          userId,
          role: 'user',
          content: userMessageContent,
        },
      });

      // 获取完整的对话历史 (包括刚刚保存的用户消息)
      const conversationHistory: Array<{ role: string; content: string }> = await ctx.prisma.planConversation.findMany({
        where: { planId, userId },
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true }, // 只选择需要的字段
      });

      // 4. 构建 Prompt
      const systemMessageContent = `你是一位乐于助人的旅行计划优化顾问。你的主要目标是根据用户提供的旅行计划（包括原始计划、先前的分析结果摘要）以及当前的对话历史，与用户进行自然、友好且富有建设性的多轮对话，帮助用户进一步完善他们的旅行计划。

当前旅行计划概要：
标题：${plan.title}
内容：${plan.textContent || '未提供具体文本内容。'}

先前智能分析摘要（如果存在）：
可行性评分：${plan.feasibilityScore ?? '未分析'}
合理性评分：${plan.reasonablenessScore ?? '未分析'}
综合建议：${plan.suggestions || '未分析'}
详细分析：${plan.analysisDetails ? JSON.stringify(plan.analysisDetails) : '未分析'}

对话应专注于：
1.  解答用户关于当前计划的疑问。
2.  针对用户提出的不确定或不满意的地方，提供具体的、可操作的优化建议。
3.  如果用户提出了新的想法或需求，帮助他们评估并融入到现有计划中。
4.  保持对话的上下文连贯性，充分利用之前的对话历史。
5.  如果用户的某些想法不太可行或不合理，请委婉地指出，并给出替代方案。
6.  语气应亲切、耐心，像一位经验丰富的朋友在给出建议。`;

      // ---- RAG 整合开始 ----
      let ragContext = '';
      const userLastMessage = messages[messages.length - 1]?.content;

      if (userLastMessage && typeof userLastMessage === 'string') {
        try {
          console.log(`[RAG] Querying knowledge base with: "${userLastMessage.substring(0, 100)}..."`);
          const ragResults = await queryCollection(userLastMessage, 3); // 查询3条相关信息
          
          if (ragResults && ragResults.documents && ragResults.documents.length > 0 && ragResults.documents[0].length > 0) {
            const relevantDocs = ragResults.documents[0];
            ragContext = "\n\n为了给您更全面的建议，我从知识库中找到了一些可能相关的信息供您参考：\n";
            relevantDocs.forEach((doc: string, index: number) => {
              // 过滤掉与用户输入过于相似或完全相同的条目，避免冗余
              // 这里简单检查一下，实际应用中可能需要更复杂的相似度计算
              if (doc.trim().toLowerCase() !== userLastMessage.trim().toLowerCase()) {
                ragContext += `- ${doc}\n`;
              }
            });
            if (ragContext === "\n\n为了给您更全面的建议，我从知识库中找到了一些可能相关的信息供您参考：\n") {
                 // 如果过滤后没有文档，则清空 ragContext
                 ragContext = '\n\n(本次未从知识库中检索到额外相关信息。)';
            } else {
                console.log(`[RAG] Found ${relevantDocs.filter((doc:string) => doc.trim().toLowerCase() !== userLastMessage.trim().toLowerCase()).length} relevant documents for context.`);
            }
          } else {
            ragContext = '\n\n(本次未从知识库中检索到额外相关信息。)';
            console.log('[RAG] No relevant documents found in knowledge base.');
          }
        } catch (error) {
          console.error('[RAG] Error querying knowledge base:', error);
          ragContext = '\n\n(检索知识库时发生错误，本次回复可能不包含外部知识。)';
        }
      }
      // ---- RAG 整合结束 ----

      const messagesForLLM: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemMessageContent },
        // 包含过去的对话历史
        ...conversationHistory.map((msg: { role: string; content: string }) => ({
          role: msg.role as 'user' | 'assistant', // 进行类型断言，因为 Prisma 返回的是 string
          content: msg.content,
        })),
        // 用户最新消息 (实际上已经被包含在 conversationHistory 的最后一条了，但为了明确区分当前轮次的用户输入，可以这样保留，或者从 conversationHistory 中取最后一条)
        // 为了简化，我们使用 conversationHistory 的最后一条作为用户当前消息的来源，因为它已经保存并按时间排序
        // { role: "user", content: userMessageContent }, // 直接使用上面保存的用户消息
      ];

      // 如果 conversationHistory 包含用户最新消息，则不需要再单独添加 userMessageContent
      // 确保 messagesForLLM 的最后一条确实是用户的当前消息。
      // 当前的 conversationHistory.map 已经包含了所有历史，包括最新的用户消息

      // 如果RAG上下文不为空，则插入到用户最新消息之前，作为LLM的参考
      if (ragContext && ragContext.trim() !== '' && ragContext !== '\n\n(本次未从知识库中检索到额外相关信息。)' && ragContext !== '\n\n(检索知识库时发生错误，本次回复可能不包含外部知识。)') {
        messagesForLLM.splice(messagesForLLM.length - 1, 0, {
          role: "system", // 或者 assistant，视情况而定，system 更像背景知识
          content: ragContext,
        });
      }

      const completion = await openai.chat.completions.create({
        model: "qwen-plus", // 或其他适合对话的模型
        messages: messagesForLLM,
        temperature: 0.7, // 对话可以稍微活泼一点
      });

      const assistantResponseContent = completion.choices[0]?.message?.content;

      if (!assistantResponseContent) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '模型未返回任何回复。' });
      }

      // 6. 保存 LLM 的回复
      await ctx.prisma.planConversation.create({
        data: {
          planId,
          userId, // 这里的 userId 应该是当前登录用户，但回复是助手的
          role: "assistant",
          content: assistantResponseContent,
        },
      });

      // 7. 返回 LLM 的回复
      return { reply: assistantResponseContent };
    }),

  getConversationHistory: protectedProcedure
    .input(z.object({ planId: z.string().cuid({ message: "无效的计划 ID" }) }))
    .query(async ({ ctx, input }) => {
      const { planId } = input;
      const userId = ctx.session.user.id;

      // 1. 验证用户是否有权访问该计划
      const plan = await ctx.prisma.travelPlan.findUnique({
        where: { id: planId },
        select: { userId: true }, // 只选择 userId 用于权限验证
      });

      if (!plan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '未找到指定的旅行计划。' });
      }
      if (plan.userId !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '您无权访问此计划的对话历史。' });
      }

      // 2. 获取聊天记录
      const history = await ctx.prisma.planConversation.findMany({
        where: { planId },
        orderBy: { createdAt: 'asc' }, // 按时间升序排列
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true, // 获取创建时间
        },
      });
      
      // 3. 转换 role 类型以匹配前端期望 (如果需要)
      // Prisma schema 定义 role 为 String，但我们知道它是 'user' 或 'assistant'
      // Zod 在 chatWithPlanAssistant 中已经验证了输入，这里查询出来的值应该是符合的
      // 直接返回即可，前端在转换时处理类型
      return history.map((message: { id: string; role: string; content: string; createdAt: Date }) => ({
        ...message,
        // 确保 role 是联合类型 'user' | 'assistant'
        role: message.role as "user" | "assistant", 
      }));
    }),

  clearConversationHistory: protectedProcedure
    .input(z.object({ planId: z.string().cuid({ message: "无效的计划 ID" }) }))
    .mutation(async ({ ctx, input }) => {
      const { planId } = input;
      const userId = ctx.session.user.id;

      // 1. 验证用户是否有权访问该计划
      const plan = await ctx.prisma.travelPlan.findUnique({
        where: { id: planId },
        select: { userId: true },
      });

      if (!plan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '未找到指定的旅行计划。' });
      }
      if (plan.userId !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '您无权清除此计划的对话历史。' });
      }

      // 2. 删除与 planId 和 userId 相关的聊天记录
      // 虽然 planId 应该已经是特定于用户的了（通过上一步验证），但多加一层 userId 条件更安全
      await ctx.prisma.planConversation.deleteMany({
        where: {
          planId: planId,
          userId: userId, // 确保只删除该用户在此计划下的消息
        },
      });

      return { success: true, message: "聊天记录已成功清除。" };
    }),

  // 未来可以在这里添加 getById (protected), update, delete 等过程
}); 