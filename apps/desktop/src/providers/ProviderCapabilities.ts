import type { ProviderConfig, ProviderId } from "../config/schema";

const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function shouldSendVisionInput(providerId: ProviderId, config: ProviderConfig): boolean {
  if (config.imageInputMode === "enabled") return true;
  if (config.imageInputMode === "disabled") return false;
  return modelLooksVisionCapable(providerId, config.modelId);
}

export function isSupportedImageMimeType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

function modelLooksVisionCapable(providerId: ProviderId, modelId: string): boolean {
  const model = modelId.trim().toLowerCase();
  if (!model) return false;

  if (providerId === "claude") {
    return /\bclaude-(3|4)\b/.test(model) || /\b(sonnet|opus|haiku)\b/.test(model);
  }

  if (providerId === "deepseek") {
    return /\b(vl|vision|janus|multimodal)\b/.test(model);
  }

  return (
    /\b(gpt-4o|gpt-4\.1|gpt-4\.5|gpt-4-turbo|gpt-4-vision|gpt-5|chatgpt-4o)\b/.test(model) ||
    /\b(o3|o4|vision|omni|multimodal)\b/.test(model)
  );
}
