# Provider Configuration

WorkBuddy supports configurable provider settings.

```json
{
  "activeProvider": "openai",
  "providers": {
    "openai": {
      "displayName": "ChatGPT",
      "baseUrl": "https://api.openai.com/v1",
      "modelId": "gpt-5.5"
    }
  }
}
```

Users can edit:

- Display name
- Base URL
- API key
- Model ID
- Temperature
- Max tokens
- System prompt

API keys are stored in the OS keychain when running in Tauri. Browser preview mode stores test keys in local storage.
