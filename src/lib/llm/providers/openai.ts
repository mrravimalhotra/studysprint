import OpenAI from "openai";
import type { CompletionRequest, CompletionResult, EmbeddingResult, LlmProviderAdapter } from "@/lib/llm/types";

function client() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey });
}

export const openaiAdapter: LlmProviderAdapter = {
  async generateCompletion(req: CompletionRequest & { model: string }): Promise<CompletionResult> {
    const openai = client();

    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
    const text = req.context ? `Reference material (RAG context):\n${req.context}\n\n${req.prompt}` : req.prompt;
    userContent.push({ type: "text", text });
    for (const img of req.images ?? []) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.data}` },
      });
    }

    const completion = await openai.chat.completions.create({
      model: req.model,
      temperature: req.temperature ?? 0.4,
      messages: [
        { role: "system", content: req.systemInstructions },
        { role: "user", content: userContent },
      ],
    });

    const usage = completion.usage;

    return {
      text: completion.choices[0]?.message?.content ?? "",
      provider: "openai",
      model: req.model,
      usage: {
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
      },
      usedSearchGrounding: false,
    };
  },

  async embed(text: string, model: string): Promise<EmbeddingResult> {
    const openai = client();
    const result = await openai.embeddings.create({ model, input: text });

    return {
      embedding: result.data[0].embedding,
      provider: "openai",
      model,
      usage: {
        inputTokens: result.usage.prompt_tokens,
        outputTokens: 0,
        totalTokens: result.usage.total_tokens,
      },
    };
  },
};
