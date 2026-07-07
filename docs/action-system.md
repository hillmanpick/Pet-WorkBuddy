# Pet Action System

WorkBuddy maps app events to pet actions.

```text
onClick
onChatOpen
onUserSendMessage
onAiReplyStart
onAiReplyEnd
onLongIdle
onDragStart
onDragEnd
onError
```

The action resolver checks `pet.json` first, then falls back to a built-in mapping. This keeps custom pets declarative and avoids hardcoded model-specific behavior in the app.

Suggested action names:

- `idle`
- `walk`
- `run`
- `eat`
- `happy`
- `positive`
- `negative`
- `thinking`
- `talking`
- `dragged`
- `alert`
- `rest`

