import type { SuggestedTag } from "@/lib/ai/schemas/profile";
import {
  CONTROLLED_TAGS,
  confirmedTagsFromCandidates,
  type ConfirmedTags,
  type ControlledTagCategory,
} from "@/types/profile";

export function tagKey(tag: {
  category: ControlledTagCategory;
  tag: string;
}): string {
  return `${tag.category}:${tag.tag}`;
}

export function suggestedTagsFromConfirmedTags(
  tags: ConfirmedTags,
): SuggestedTag[] {
  const result: SuggestedTag[] = [];
  for (const category of Object.keys(
    CONTROLLED_TAGS,
  ) as ControlledTagCategory[]) {
    for (const tag of CONTROLLED_TAGS[category]) {
      if ((tags[category] as readonly string[]).includes(tag)) {
        result.push({ category, tag } as SuggestedTag);
      }
    }
  }
  return result;
}

export function mergeSuggestedTags(
  ...lists: ReadonlyArray<readonly SuggestedTag[]>
): SuggestedTag[] {
  const seen = new Set<string>();
  const result: SuggestedTag[] = [];
  for (const list of lists)
    for (const tag of list) {
      if (!seen.has(tagKey(tag))) {
        seen.add(tagKey(tag));
        result.push(tag);
      }
    }
  return result;
}

export function selectedTagKeysFromConfirmedTags(
  tags: ConfirmedTags,
): Set<string> {
  return new Set(suggestedTagsFromConfirmedTags(tags).map(tagKey));
}

export function confirmedTagsFromSelection(
  suggested: readonly SuggestedTag[],
  selectedKeys: Iterable<string>,
): ConfirmedTags {
  const selected = new Set(selectedKeys);
  return confirmedTagsFromCandidates(
    mergeSuggestedTags(suggested).map((tag) => ({
      category: tag.category,
      tag: tag.tag,
      confirmedByUser: selected.has(tagKey(tag)),
    })),
  );
}
