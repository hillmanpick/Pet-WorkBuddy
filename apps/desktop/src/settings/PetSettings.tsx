import { Check } from "lucide-react";
import type { WorkBuddyConfig } from "../config/schema";
import type { LoadedPetPack } from "../pet/PetPackLoader";
import { resolvePetAsset } from "../pet/PetPackLoader";

type PetSettingsProps = {
  config: WorkBuddyConfig;
  pets: LoadedPetPack[];
  onConfigChange: (config: WorkBuddyConfig) => void;
};

export function PetSettings({ config, pets, onConfigChange }: PetSettingsProps) {
  return (
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
  );
}

