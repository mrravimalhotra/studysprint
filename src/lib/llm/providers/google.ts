import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import type { CompletionRequest, CompletionResult, EmbeddingResult, LlmProviderAdapter } from "@/lib/llm/types";

function client() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not configured");
  return new GoogleGenerativeAI(apiKey);
}

export const googleAdapter: LlmProviderAdapter = {
  async generateCompletion(req: CompletionRequest & { model: string }): Promise<CompletionResult> {
    const genAI = client();

    const tools = req.allowSearchGrounding ? [{ googleSearch: {} }] : undefined;

    const model = genAI.getGenerativeModel({
      model: req.model,
      systemInstruction: req.systemInstructions,
      tools: tools as never,
    });

    const parts: Part[] = [];
    if (req.context) parts.push({ text: `Reference material (RAG context):\n${req.context}` });
    parts.push({ text: req.prompt });
    for (const img of req.images ?? []) {
      parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: req.temperature ?? 0.4 },
    });

    const response = result.response;
    const usage = response.usageMetadata;
    const groundingUsed = Boolean(
      response.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length
    );

    return {
      text: response.text(),
      provider: "google",
      model: req.model,
      usage: {
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
      },
      usedSearchGrounding: groundingUsed,
    };
  },

  async embed(text: string, model: string): Promise<EmbeddingResult> {
    const genAI = client();
    const embedModel = genAI.getGenerativeModel({ model });
    const result = await embedModel.embedContent(text);
    const embedding = result.embedding.values;

    // The embeddings API doesn't return token usage; approximate for quota purposes.
    const approxTokens = Math.ceil(text.length / 4);

    return {
      embedding,
      provider: "google",
      model,
      usage: { inputTokens: approxTokens, outputTokens: 0, totalTokens: approxTokens },
    };
  },
};
