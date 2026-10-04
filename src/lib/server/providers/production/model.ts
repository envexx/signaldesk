import "server-only";

import { deepseek } from "@ai-sdk/deepseek";
import { gateway } from "ai";

import { readProviderConfig } from "../config";

/**
 * Resolve the language model for structured extraction/drafting.
 *
 * - `DEEPSEEK_API_KEY` set  → DeepSeek directly (`AI_MODEL` e.g. `deepseek-chat`).
 * - otherwise               → Vercel AI Gateway (`AI_MODEL` e.g. `deepseek/deepseek-chat`).
 *
 * The caller only selects this provider when at least one key is configured.
 */
export function resolveIntelligenceModel() {
  const config = readProviderConfig();

  if (config.deepseekApiKey) {
    return deepseek(config.aiModel ?? "deepseek-chat");
  }

  return gateway(config.aiModel ?? "deepseek/deepseek-chat");
}
