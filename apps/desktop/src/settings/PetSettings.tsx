import { Check, Trash2, Upload } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import type { MotionFps, WorkBuddyConfig } from "../config/schema";
import type { Translations } from "../i18n";
import { deleteCustomPetPack, pickAndImportPetPack } from "../pet/CustomPetManager";
import type { LoadedPetPack } from "../pet/PetPackLoader";
import { resolvePetAsset } from "../pet/PetPackLoader";

type PetSettingsProps = {
  config: WorkBuddyConfig;
  pets: LoadedPetPack[];
  labels: Translations["pets"];
  onConfigChange: (config: WorkBuddyConfig) => void;
  onPetCatalogChange?: (activePetId?: string) => void;
};

const chatColorSwatches = [
  { id: "mint", color: "#2e6f73", labelKey: "chatColorMint" },
  { id: "rose", color: "#c65f89", labelKey: "chatColorRose" },
  { id: "blue", color: "#4778c7", labelKey: "chatColorBlue" },
  { id: "amber", color: "#b8792f", labelKey: "chatColorAmber" },
  { id: "graphite", color: "#4b5563", labelKey: "chatColorGraphite" },
] as const;
const motionFpsOptions: MotionFps[] = [30, 60, 90, 120];

export function PetSettings({ config, pets, labels, onConfigChange, onPetCatalogChange }: PetSettingsProps) {
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  async function handleImportPet() {
    setImporting(true);
    setImportStatus(null);
    try {
      const imported = await pickAndImportPetPack();
      if (!imported) return;
      setImportStatus(labels.importPetDone);
      onPetCatalogChange?.(imported.id);
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
    }
  }

  async function handleDeletePet(pet: LoadedPetPack) {
    if (!pet.custom) return;
    if (!window.confirm(labels.deletePetConfirm)) return;

    setImportStatus(null);
    try {
      await deleteCustomPetPack(pet.id);
      if (config.activePetId === pet.id) {
        const fallback = pets.find((item) => item.id !== pet.id)?.id;
        if (fallback) {
          onConfigChange({ ...config, activePetId: fallback });
        }
      }
      setImportStatus(labels.deletePetDone);
      onPetCatalogChange?.();
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="settings-stack">
      <section className="settings-group">
        <h3>{labels.appearance}</h3>
        <div className="settings-grid">
          <label className="field">
            <span>{labels.petName}</span>
            <input
              value={config.appearance.petName}
              maxLength={24}
              placeholder={labels.petNamePlaceholder}
              onChange={(event) =>
                onConfigChange({
                  ...config,
                  appearance: {
                    ...config.appearance,
                    petName: event.target.value,
                  },
                })
              }
            />
          </label>

          <label className="field">
            <span>{labels.language}</span>
            <select
              value={config.appearance.language}
              onChange={(event) =>
                onConfigChange({
                  ...config,
                  appearance: {
                    ...config.appearance,
                    language: event.target.value as WorkBuddyConfig["appearance"]["language"],
                  },
                })
              }
            >
              <option value="zh">{labels.chinese}</option>
              <option value="en">{labels.english}</option>
            </select>
          </label>

          <label className="field pet-size-field">
            <span>{labels.petSize}</span>
            <input
              type="range"
              min={130}
              max={260}
              step={10}
              value={config.appearance.petSize}
              onChange={(event) =>
                onConfigChange({
                  ...config,
                  appearance: {
                    ...config.appearance,
                    petSize: Number(event.target.value),
                  },
                })
              }
            />
            <output>{config.appearance.petSize}px</output>
          </label>

          <label className="field">
            <span>{labels.motionFps}</span>
            <select
              value={config.behavior.motionFps}
              onChange={(event) =>
                onConfigChange({
                  ...config,
                  behavior: {
                    ...config.behavior,
                    motionFps: Number(event.target.value) as MotionFps,
                  },
                })
              }
            >
              {motionFpsOptions.map((fps) => (
                <option value={fps} key={fps}>
                  {fps} FPS{fps === 90 ? ` (${labels.motionFpsRecommended})` : fps === 120 ? ` (${labels.motionFpsHigh})` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            <span>{labels.chatColor}</span>
            <div className="color-swatch-grid" role="group" aria-label={labels.chatColor}>
              {chatColorSwatches.map((swatch) => {
                const active = (config.appearance.chatColor || "mint") === swatch.id;
                return (
                  <button
                    className={active ? "color-swatch active" : "color-swatch"}
                    type="button"
                    key={swatch.id}
                    title={labels[swatch.labelKey]}
                    aria-label={labels[swatch.labelKey]}
                    style={{ "--swatch-color": swatch.color } as CSSProperties}
                    onClick={() =>
                      onConfigChange({
                        ...config,
                        appearance: {
                          ...config.appearance,
                          chatColor: swatch.id,
                        },
                      })
                    }
                  >
                    {active ? <Check size={15} /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="settings-group">
        <h3>{labels.choosePet}</h3>
        <div className="pet-import-row">
          <button type="button" disabled={importing} onClick={() => void handleImportPet()}>
            <Upload size={16} />
            {importing ? labels.importingPet : labels.importPet}
          </button>
          <p className="settings-help">{labels.importPetHelp}</p>
        </div>
        {importStatus ? <p className="settings-note">{importStatus}</p> : null}
        <div className="pet-picker">
          {pets.map((pet) => {
            const active = pet.id === config.activePetId;
            return (
              <div className="pet-card-shell" key={pet.id}>
                <button
                  className={active ? "pet-card active" : "pet-card"}
                  type="button"
                  onClick={() => onConfigChange({ ...config, activePetId: pet.id })}
                >
                  {pet.preview ? <img src={resolvePetAsset(pet, pet.preview)} alt="" /> : null}
                  <span>{pet.name}</span>
                  {pet.custom ? <small>{labels.customPet}</small> : null}
                  {active ? <Check size={16} /> : null}
                </button>
                {pet.custom ? (
                  <button
                    className="pet-card-delete"
                    type="button"
                    title={labels.deletePet}
                    aria-label={labels.deletePet}
                    onClick={() => void handleDeletePet(pet)}
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
