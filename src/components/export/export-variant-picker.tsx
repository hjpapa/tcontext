"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  VARIANT_PICKER_HINT,
  VARIANT_SECTION_TITLES,
} from "@/content/export-variants";
import {
  OPTIONAL_SECTION_IDS,
  type OptionalSectionId,
} from "@/lib/export/profile-variants";
import {
  PROFILE_MODULE_IDS,
  PROFILE_MODULE_TITLES,
  type ProfileModuleId,
} from "@/types/profile";

export type ExportVariantSelection = {
  variant: "full" | "core" | "modules";
  modules: ProfileModuleId[];
  sections: OptionalSectionId[];
};

const FORMATS = [
  { value: "full", label: "전체본", description: "모든 모듈과 수업 작업 양식" },
  {
    value: "core",
    label: "핵심본",
    description: "확인된 맥락과 원칙만, 반복 사용에 적합",
  },
  { value: "modules", label: "모듈 선택본", description: "고른 영역만" },
] as const;

export function ExportVariantPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ExportVariantSelection;
  onChange: (value: ExportVariantSelection) => void;
  disabled?: boolean;
}) {
  const id = useId();

  return (
    <fieldset
      disabled={disabled}
      aria-describedby={`${id}-hint`}
      className="min-w-0 space-y-4 disabled:opacity-60"
    >
      <legend id={`${id}-legend`} className="font-semibold">
        내보내기 형식
      </legend>
      <RadioGroup
        value={value.variant}
        onValueChange={(next) => {
          if (next === "full" || next === "core" || next === "modules")
            onChange({ ...value, variant: next });
        }}
        disabled={disabled}
        aria-labelledby={`${id}-legend`}
        className="gap-3 sm:grid-cols-3"
      >
        {FORMATS.map((format) => (
          <div key={format.value} className="min-w-0 rounded-xl border p-3">
            <label className="flex cursor-pointer items-center gap-2 font-semibold">
              <RadioGroupItem
                value={format.value}
                aria-describedby={`${id}-${format.value}-description`}
              />
              {format.label}
            </label>
            <p
              id={`${id}-${format.value}-description`}
              className="text-muted-foreground mt-2 text-sm leading-6"
            >
              {format.description}
            </p>
          </div>
        ))}
      </RadioGroup>
      {value.variant === "modules" ? (
        <div className="space-y-4">
          <fieldset className="min-w-0 space-y-3">
            <legend className="font-semibold">포함할 모듈</legend>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() =>
                  onChange({ ...value, modules: [...PROFILE_MODULE_IDS] })
                }
              >
                전체 선택
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => onChange({ ...value, modules: [] })}
              >
                전체 해제
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {PROFILE_MODULE_IDS.map((moduleId) => (
                <label
                  key={moduleId}
                  className="flex items-start gap-2 text-sm leading-6"
                >
                  <Checkbox
                    disabled={disabled}
                    checked={value.modules.includes(moduleId)}
                    onCheckedChange={(checked) =>
                      onChange({
                        ...value,
                        modules:
                          checked === true
                            ? [...value.modules, moduleId]
                            : value.modules.filter(
                                (selected) => selected !== moduleId,
                              ),
                      })
                    }
                    className="mt-1"
                  />
                  {PROFILE_MODULE_TITLES[moduleId]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="min-w-0 space-y-3">
            <legend className="font-semibold">함께 포함할 내용</legend>
            {OPTIONAL_SECTION_IDS.map((sectionId) => (
              <label
                key={sectionId}
                className="flex items-start gap-2 text-sm leading-6"
              >
                <Checkbox
                  disabled={disabled}
                  checked={value.sections.includes(sectionId)}
                  onCheckedChange={(checked) =>
                    onChange({
                      ...value,
                      sections:
                        checked === true
                          ? [...value.sections, sectionId]
                          : value.sections.filter(
                              (selected) => selected !== sectionId,
                            ),
                    })
                  }
                  className="mt-1"
                />
                {VARIANT_SECTION_TITLES[sectionId]}
              </label>
            ))}
            <p className="text-muted-foreground text-sm leading-6">
              AI 협업 지침과 판단 경계는 항상 포함됩니다
            </p>
          </fieldset>
        </div>
      ) : null}
      <p id={`${id}-hint`} className="text-muted-foreground text-sm leading-6">
        {VARIANT_PICKER_HINT}
      </p>
    </fieldset>
  );
}
