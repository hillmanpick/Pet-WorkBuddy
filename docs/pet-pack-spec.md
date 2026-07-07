# Pet Pack Specification

A WorkBuddy pet pack is a folder that contains a model, preview image, license file, and `pet.json`.

```text
my-pet/
  pet.json
  model.glb
  preview.png
  Textures/
  LICENSE.txt
```

## `pet.json`

```json
{
  "id": "kenney-cat",
  "name": "Kenney Cat",
  "type": "gltf",
  "model": "model.glb",
  "preview": "preview.png",
  "scale": 1,
  "defaultAnimation": "idle",
  "animations": {
    "idle": { "clip": "idle", "loop": true },
    "walk": { "clip": "walk", "loop": true },
    "happy": { "clip": "dance", "loop": false }
  },
  "events": {
    "onClick": "happy",
    "onChatOpen": "positive",
    "onUserSendMessage": "idle",
    "onAiReplyEnd": "happy"
  }
}
```

## Supported Formats

- `gltf`: `.glb` or `.gltf`
- `vrm`: planned through the same loader boundary
- `sprite`: planned for 2D sprite sheet packs

## Required License Hygiene

Only include pet packs in the public repository if the assets are original, CC0, or clearly redistributable.

User-local pet imports can use any legally obtained asset that the user is allowed to run locally.
