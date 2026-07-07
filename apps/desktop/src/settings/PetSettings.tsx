import { Check } from "lucide-react";
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

export function PetSettings({ config, pets, labels, onConfigChange }: PetSettingsProps) {
  return (
    <div className="settings-stack">
      <section className="settings-group">
        <h3>{labels.appearance}</h3>
        <div className="settings-grid">
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
