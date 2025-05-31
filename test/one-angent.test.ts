import { Tools } from 'unifai-sdk';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import { resolve } from 'path';
// 确保 dotenv 配置在最开始就加载
const result = dotenv.config({ path: resolve(__dirname, '../.env') });

async function runAgentTest() {
  const unifaiAgentApiKey = process.env.UNIFAI_AGENT_API_KEY;
  if (!unifaiAgentApiKey) {
    console.error("错误: 请在 .env 文件中设置 UNIFAI_AGENT_API_KEY。");
    return;
  }

  const tools = new Tools({ apiKey: unifaiAgentApiKey });

  // === 步骤 1: 获取可用工具定义 (模拟AI获取工具清单) ===
  console.log("正在从 UnifAI 平台获取工具定义...");
  const availableTools = await tools.getTools(); // 使用动态工具发现
  console.log("成功获取工具定义:", JSON.stringify(availableTools, null, 2));

  // === 步骤 2: 模拟 LLM 与工具的交互循环 ===
  // 这里将结合LLM (以OpenAI为例) 来展示完整的工具调用流程

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error("错误: 请在 .env 文件中设置 OPENAI_API_KEY 以模拟LLM调用。");
    return;
  }
  const openai = new OpenAI({ apiKey: openaiApiKey, baseURL: "https://api.gptsapi.net/v1", });

  let messages: any[] = [{ role: "user", content: "我想在lido上质押2000 个 ETH" }];

  console.log("\n--- 开始模拟 AI 代理与 LLM 及工具的交互循环 ---");

  let loopCount = 0;
  const MAX_LOOPS = 5; // 防止无限循环

  while (loopCount < MAX_LOOPS) {
    loopCount++;
    console.log(`\n--- 循环 ${loopCount}: LLM 思考中 ---`);
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // 使用支持工具调用的模型
      messages: messages,
      tools: availableTools, // 将 UnifAI 工具传递给 LLM
      tool_choice: "auto", // 允许LLM自动选择是否调用工具
    });

    const responseMessage = response.choices[0].message;
    messages.push(responseMessage); // 将LLM的响应添加到消息历史

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      // === 步骤 3: 如果 LLM 决定调用工具，则执行工具调用 ===
      console.log(`LLM 建议调用工具:`, JSON.stringify(responseMessage.tool_calls, null, 2));
      console.log("正在执行工具调用...");

      const toolCallResults = await tools.callTools(responseMessage.tool_calls); // 执行工具调用
      messages.push(...toolCallResults); // 将工具结果添加到消息历史，供LLM下一次处理
      console.log("工具调用结果已添加至消息历史。");

      // 如果工具调用成功并有结果，循环将继续，LLM会再次处理包含工具结果的消息。
      // 如果这里没有更多的 tool_calls，或者 LLM 已经得到了满意的答案，它就不会再生成 tool_calls。
    } else {
      // === 步骤 4: 如果 LLM 没有生成工具调用，则输出最终响应 ===
      console.log("\nLLM 已生成最终响应，没有新的工具调用。");
      console.log("最终 AI 响应:", responseMessage.content);
      break; // 结束循环
    }
  }

  if (loopCount >= MAX_LOOPS) {
    console.warn("\n达到最大循环次数，可能存在无限循环或LLM未能收敛。");
  }
  console.log("\n--- AI 代理测试完成 ---");


}

runAgentTest().catch(console.error);