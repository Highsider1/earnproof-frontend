"use client";

import { useState } from "react";
import {
  DisplayPreferenceMode,
  getStorageValue,
  setStorageValue,
} from "@/lib/storage";

interface PreferenceOption {
  value: DisplayPreferenceMode;
  label: string;
}

const OPTIONS: PreferenceOption[] = [
  { value: "system", label: "System" },
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
];

function applyMotionPreference(mode: DisplayPreferenceMode) {
  const root = document.documentElement;
  if (mode === "enabled") {
    root.dataset.motion = "reduced";
  } else if (mode === "disabled") {
    root.dataset.motion = "full";
  } else {
    delete root.dataset.motion;
  }
}

function applyContrastPreference(mode: DisplayPreferenceMode) {
  const root = document.documentElement;
  if (mode === "enabled") {
    root.dataset.contrast = "high";
  } else {
    delete root.dataset.contrast;
  }
}

interface RadioGroupProps {
  legend: string;
  description: string;
  name: string;
  value: DisplayPreferenceMode;
  onChange: (mode: DisplayPreferenceMode) => void;
}

function PreferenceRadioGroup({
  legend,
  description,
  name,
  value,
  onChange,
}: RadioGroupProps) {
  return (
    <fieldset className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <legend className="px-1 text-sm font-semibold text-white">
        {legend}
      </legend>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
      <div className="mt-3 flex flex-wrap gap-4" role="radiogroup" aria-label={legend}>
        {OPTIONS.map((option) => {
          const id = `${name}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className="flex items-center gap-2 text-sm text-slate-300"
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="h-4 w-4 border-white/20 text-cyan-300 focus:ring-cyan-300"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function DisplayPreferencesForm() {
  const [reducedMotion, setReducedMotion] = useState<DisplayPreferenceMode>(
    () => getStorageValue("DISPLAY_PREFERENCES")?.data.reducedMotion ?? "system"
  );
  const [highContrast, setHighContrast] = useState<DisplayPreferenceMode>(
    () => getStorageValue("DISPLAY_PREFERENCES")?.data.highContrast ?? "system"
  );

  const persist = (next: {
    reducedMotion: DisplayPreferenceMode;
    highContrast: DisplayPreferenceMode;
  }) => {
    setStorageValue("DISPLAY_PREFERENCES", { data: next });
  };

  const handleReducedMotionChange = (mode: DisplayPreferenceMode) => {
    setReducedMotion(mode);
    applyMotionPreference(mode);
    persist({ reducedMotion: mode, highContrast });
  };

  const handleHighContrastChange = (mode: DisplayPreferenceMode) => {
    setHighContrast(mode);
    applyContrastPreference(mode);
    persist({ reducedMotion, highContrast: mode });
  };

  return (
    <div className="grid gap-4">
      <PreferenceRadioGroup
        legend="Reduced motion"
        description="Controls animations and transitions across the app."
        name="reduced-motion"
        value={reducedMotion}
        onChange={handleReducedMotionChange}
      />
      <PreferenceRadioGroup
        legend="High contrast"
        description="Increases border and text contrast for readability."
        name="high-contrast"
        value={highContrast}
        onChange={handleHighContrastChange}
      />
    </div>
  );
}
