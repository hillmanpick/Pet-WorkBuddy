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
- `sprite`: 2D `.gif` files, single `.png` images, or `.png` frame sequences

## 2D Sprite Pack Example

```text
my-2d-pet/
  pet.json
  preview.png
  idle/
    idle_0001.png
    idle_0002.png
  walk/
    walk_0001.png
    walk_0002.png
  happy.gif
```

```json
{
  "id": "my-2d-pet",
  "name": "My 2D Pet",
  "type": "sprite",
  "model": "idle/idle_0001.png",
  "preview": "preview.png",
  "defaultAnimation": "idle",
  "animations": {
    "idle": {
      "frames": ["idle/idle_0001.png", "idle/idle_0002.png"],
      "fps": 12,
      "loop": true
    },
    "walk": {
      "frames": ["walk/walk_0001.png", "walk/walk_0002.png"],
      "fps": 12,
      "loop": true
    },
    "happy": { "file": "happy.gif", "loop": false }
  },
  "events": {
    "onClick": "happy",
    "onChatOpen": "happy",
    "onUserSendMessage": "idle",
    "onAiReplyEnd": "happy"
  }
}
```

## Required License Hygiene

Only include pet packs in the public repository if the assets are original, CC0, or clearly redistributable.

User-local pet imports can use any legally obtained asset that the user is allowed to run locally.
