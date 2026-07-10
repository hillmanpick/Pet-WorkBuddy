import type { ChatAttachment, ChatMessage, WorkBuddyConfig } from "../config/schema";
import { isSupportedImageMimeType, shouldSendVisionInput } from "../providers/ProviderCapabilities";
import { getProvider } from "../providers/ProviderRegistry";
import { getApiKey } from "../settings/SettingsStore";

export function createMessage(
  role: ChatMessage["role"],
  content: string,
  attachments: ChatAttachment[] = [],
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now(),
    attachments: attachments.length ? attachments : undefined,
  };
}

export async function requestAssistantReply(
  config: WorkBuddyConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const providerConfig = config.providers[config.activeProvider];
  const unsupportedImageReply = imageInputPreflightReply(config, messages);
  if (unsupportedImageReply) return unsupportedImageReply;

  const provider = getProvider(config.activeProvider);
  const apiKey = await getApiKey(config.activeProvider);
  const result = await provider.chat({
    providerId: config.activeProvider,
    config: providerConfig,
    apiKey,
    messages,
    signal,
  });
  return result.text.trim();
}

function imageInputPreflightReply(config: WorkBuddyConfig, messages: ChatMessage[]): string | null {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const imageAttachments = (latestUserMessage?.attachments ?? []).filter(
    (attachment) => attachment.kind === "image",
  );
  if (!imageAttachments.length) return null;

  const providerConfig = config.providers[config.activeProvider];
  const supportsVision = shouldSendVisionInput(config.activeProvider, providerConfig);
  if (!supportsVision) {
    return unsupportedVisionReply(config, imageAttachments);
  }

  const hasSendableImage = imageAttachments.some(
    (attachment) => Boolean(attachment.dataUrl) && isSupportedImageMimeType(attachment.mimeType),
  );
  if (hasSendableImage) return null;

  return unsupportedImageTypeReply(config, imageAttachments);
}

function unsupportedVisionReply(config: WorkBuddyConfig, attachments: ChatAttachment[]): string {
  const provider = config.providers[config.activeProvider];
  const names = attachmentNames(attachments);
  if (config.appearance.language === "zh") {
    if (config.activeProvider === "deepseek") {
      return `我没有把图片发给 DeepSeek。\n\n当前模型是 ${provider.modelId}，WorkBuddy 使用的是 DeepSeek API，不是 DeepSeek 网页/App。官方 API 目前不支持图片或文档内容块，所以它不能直接识别这张图片。\n\n附件：${names}\n\n如果你接的是支持图片的 DeepSeek-VL 或第三方兼容接口，可以到 设置 > 模型 > DeepSeek > 图片输入，改成“强制上传图片”。否则请切换到 ChatGPT 或 Claude 的视觉模型。`;
    }

    return `我没有把图片发给当前模型。\n\n当前模型是 ${provider.displayName} / ${provider.modelId}，图片输入处于不可用状态。\n\n附件：${names}\n\n请切换到支持图片的模型，或者在 设置 > 模型 > 图片输入 中选择“强制上传图片”。`;
  }

  if (config.activeProvider === "deepseek") {
    return `I did not send the image to DeepSeek.\n\nThe active model is ${provider.modelId}. WorkBuddy uses the DeepSeek API, not the DeepSeek web/app upload flow. The official API does not currently support image or document content blocks, so it cannot directly inspect this image.\n\nAttachment: ${names}\n\nIf you are using a DeepSeek-VL or third-party compatible vision endpoint, set Settings > Providers > DeepSeek > Image input to "Force image upload". Otherwise, switch to a ChatGPT or Claude vision model.`;
  }

  return `I did not send the image to the active model.\n\nThe active model is ${provider.displayName} / ${provider.modelId}, and image input is not enabled for it.\n\nAttachment: ${names}\n\nSwitch to a vision-capable model, or set Settings > Providers > Image input to "Force image upload".`;
}

function unsupportedImageTypeReply(config: WorkBuddyConfig, attachments: ChatAttachment[]): string {
  const names = attachmentNames(attachments);
  if (config.appearance.language === "zh") {
    return `这次图片没有上传成功，因为当前接口只支持 JPEG、PNG、GIF、WebP 这几类图片格式。\n\n附件：${names}`;
  }

  return `The image was not uploaded because the active provider only supports JPEG, PNG, GIF, and WebP image inputs.\n\nAttachment: ${names}`;
}

function attachmentNames(attachments: ChatAttachment[]): string {
  return attachments.map((attachment) => attachment.name).join(", ");
}
