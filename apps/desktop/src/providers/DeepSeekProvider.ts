import { OpenAIProvider } from "./OpenAIProvider";

export class DeepSeekProvider extends OpenAIProvider {
  id = "deepseek" as const;
  displayName = "DeepSeek";
}

