import { Check } from "lucide-react";
import type { CSSProperties } from "react";
import type { WorkBuddyConfig } from "../config/schema";
import type { Translations } from "../i18n";
import type { LoadedPetPack } from "../pet/PetPackLoader";
import { resolvePetAsset } from "../pet/PetPackLoader";

type PetSettingsProps = {
  config: WorkBuddyConfig;
  pets: LoadedPetPack[];
  labels: Translations["pets"];
  onConfigChange: (config: WorkBuddyConfig) => void;
};

const chatColorSwatches = [
  { id: "mint", color: "#2e6f73", labelKey: "chatColorMint" },
  { id: "rose", color: "#c65f89", labelKey: "chatColorRose" },
  { id: "blue", color: "#4778c7", labelKey: "chatColorBlue" },
  { id: "amber", color: "#b8792f", labelKey: "chatColorAmber" },
  { id: "graphite", color: "#4b5563", labelKey: "chatColorGraphite" },
] as const;

export function PetSettings({ config, pets, labels, onConfigChange }: PetSettingsProps) {
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
        <div className="pet-picker">
          {pets.map((pet) => {
            const active = pet.id === config.activePetId;
            return (
              <button
                className={active ? "pet-card active" : "pet-card"}
                type="button"
                key={pet.id}
                onClick={() => onConfigChange({ ...config, activePetId: pet.id })}
              >
                {pet.preview ? <img src={resolvePetAsset(pet, pet.preview)} alt="" /> : null}
                <span>{pet.name}</span>
                {active ? <Check size={16} /> : null}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
