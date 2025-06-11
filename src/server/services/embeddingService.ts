import { pipeline, env, type Pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

// 配置 Transformers.js，例如模型缓存目录（可选）
// env.cacheDir = './.cache'; // 指定缓存目录
// env.allowLocalModels = true; // 允许本地模型
// env.localModelPath = 'path/to/your/models'; // 本地模型路径

let embeddingPipeline: FeatureExtractionPipeline | null = null;
const MODEL_NAME = 'Xenova/paraphrase-multilingual-mpnet-base-v2';

/**
 * 初始化文本嵌入 pipeline。
 * 使用单例模式确保 pipeline 只被初始化一次。
 */
async function initializeEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  if (!embeddingPipeline) {
    try {
      console.log(`Initializing embedding model: ${MODEL_NAME}`);
      
      // 1. Call pipeline and let TypeScript infer its (potentially complex) return type for the promise
      const unresolvedPipelinePromise = pipeline(
        'feature-extraction',
        MODEL_NAME,
        {
          // progress_callback: (progress: any) => { // 可选的回调，用于跟踪下载进度
          //   console.log('Model loading progress:', progress);
          // }
        }
      );

      // 2. Await the promise to get the resolved pipeline object
      const resolvedPipeline = await unresolvedPipelinePromise;

      // 3. Assert the type of the resolved pipeline object
      embeddingPipeline = resolvedPipeline as FeatureExtractionPipeline;
      
      console.log('Embedding model initialized successfully.');
    } catch (error) {
      console.error('Failed to initialize embedding model:', error);
      throw new Error('Embedding model initialization failed.');
    }
  }
  return embeddingPipeline;
}

/**
 * 获取给定文本的嵌入向量。
 * @param text 单个文本字符串或文本字符串数组。
 * @returns 返回一个包含嵌入向量的数组 (number[][])，或者在出错时抛出错误。
 *          每个内部数组代表一个文本的嵌入向量。
 */
export async function getTextEmbeddings(
  text: string | string[]
): Promise<number[][]> {
  const pipelineInstance = await initializeEmbeddingPipeline();
  if (!pipelineInstance) {
    throw new Error('Embedding pipeline is not initialized.');
  }

  const inputTextArray = Array.isArray(text) ? text : [text];

  if (inputTextArray.length === 0) {
    return [];
  }

  try {
    // console.log(`Generating embeddings for ${inputTextArray.length} text(s).`);
    const output = await pipelineInstance(inputTextArray, {
      pooling: 'mean', // 'mean' 池化是常用的策略
      normalize: true, // 归一化向量，使其长度为 1，适用于余弦相似度计算
    });

    // output.data 是一个 Float32Array，包含所有批次文本的扁平化嵌入。
    // output.tolist() 可以将其转换为嵌套数组，每个内部数组是一个文本的嵌入。
    // 对于单个句子，tolist() 返回的是 [[vector]]
    // 对于多个句子，tolist() 返回的是 [[vector1], [vector2], ...]
    // 我们需要确保返回的是 number[][]
    // 当 output.size === pipelineInstance.model.config.dim 时，表示只有一个句子的嵌入结果，此时 output.tolist() 的结果可能是单个向量数组。
    // 然而，根据 Transformers.js 的通常行为和 feature-extraction 的输出，即使是单个句子，tolist() 也会是 [[vector]]。

    const embeddings = output.tolist();

    // 简单的类型检查和日志记录
    // if (Array.isArray(embeddings) && embeddings.length > 0 && Array.isArray(embeddings[0])) {
    //   console.log(`Generated embeddings with dimension: ${embeddings[0].length}`);
    // } else {
    //   console.warn('Embeddings format might be unexpected:', embeddings);
    // }

    return embeddings as number[][];
  } catch (error) {
    console.error('Failed to generate text embeddings:', error);
    throw new Error('Text embedding generation failed.');
  }
}

// 可选：在应用启动时预先初始化 pipeline，以减少首次请求的延迟
// initializeEmbeddingPipeline().catch(console.error);

// 示例用法 (用于测试，可以注释掉)
/*
async function testEmbedding() {
  try {
    const exampleTexts = [
      "你好，世界！",
      "这是一个测试句子。",
      "Hello, world!",
      "This is a test sentence."
    ];
    const embeddings = await getTextEmbeddings(exampleTexts);
    console.log('Embeddings generated:');
    embeddings.forEach((emb, i) => {
      console.log(`Text ${i + 1} (dim: ${emb.length}):`, emb.slice(0, 5)); // 只打印前5个维度
    });

    const singleTextEmbedding = await getTextEmbeddings("单独的句子");
    console.log('Single text embedding (dim: ${singleTextEmbedding[0].length}):', singleTextEmbedding[0].slice(0,5));

  } catch (error) {
    console.error('Error during embedding test:', error);
  }
}

// testEmbedding();
*/

export const EMBEDDING_DIMENSION = 768; // paraphrase-multilingual-mpnet-base-v2 的维度
                                       // 对于 Xenova/all-MiniLM-L6-v2 是 384

 