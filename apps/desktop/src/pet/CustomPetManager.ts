import { invokeCommand, isTauriRuntime } from "../tauri/tauriClient";

export type ImportedPetPack = {
  id: string;
  path: string;
};

export async function pickAndImportPetPack(): Promise<ImportedPetPack | null> {
  if (!isTauriRuntime()) {
    throw new Error("Custom pet import is available in the desktop app.");
  }

  const { open } = await import("@tauri-apps/api/dialog");
  const selected = await open({
    multiple: false,
    title: "Import WorkBuddy pet model",
    filters: [
      {
        name: "WorkBuddy Pet",
        extensions: ["glb", "vrm", "gltf", "gif", "png", "jpg", "jpeg", "webp", "zip"],
      },
    ],
  });

  if (!selected || Array.isArray(selected)) return null;
  return invokeCommand<ImportedPetPack>("import_pet_pack", { sourcePath: selected });
}

export async function deleteCustomPetPack(id: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invokeCommand("delete_custom_pet_pack", { id });
}
