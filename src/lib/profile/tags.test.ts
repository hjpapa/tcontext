import { expect, it } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import type { SuggestedTag } from "@/lib/ai/schemas/profile";
import { confirmedTagsFromCandidates, CONTROLLED_TAGS } from "@/types/profile";
import {
  tagKey,
  mergeSuggestedTags,
  suggestedTagsFromConfirmedTags,
  selectedTagKeysFromConfirmedTags,
  confirmedTagsFromSelection,
} from "./tags";
it("uses category:tag keys and preserves first-seen merge order", () => {
  const a: SuggestedTag = {
    category: "preferredTeachingMethods",
    tag: "inquiry",
  };
  const b: SuggestedTag = {
    category: "preferredTeachingMethods",
    tag: "making",
  };
  expect(tagKey(a)).toBe("preferredTeachingMethods:inquiry");
  expect(mergeSuggestedTags([a, b], [a])).toEqual([a, b]);
});
it("orders suggestions by controlled vocabulary and round trips confirmed tags", () => {
  for (const p of FICTIONAL_PROFILES) {
    const tags = suggestedTagsFromConfirmedTags(p.confirmedTags);
    const expected = Object.entries(CONTROLLED_TAGS).flatMap(
      ([category, values]) =>
        values
          .filter((tag) =>
            (
              p.confirmedTags[
                category as keyof typeof CONTROLLED_TAGS
              ] as readonly string[]
            ).includes(tag),
          )
          .map((tag) => ({ category, tag })),
    );
    expect(tags).toEqual(expected);
    const roundTrip = confirmedTagsFromSelection(
      tags,
      selectedTagKeysFromConfirmedTags(p.confirmedTags),
    );
    expect(selectedTagKeysFromConfirmedTags(roundTrip)).toEqual(
      selectedTagKeysFromConfirmedTags(p.confirmedTags),
    );
    const ordered = confirmedTagsFromCandidates(
      expected.map((tag) => ({
        category: tag.category as keyof typeof CONTROLLED_TAGS,
        tag: tag.tag,
        confirmedByUser: true,
      })),
    );
    expect(roundTrip).toEqual(ordered);
    expect(
      confirmedTagsFromSelection(
        suggestedTagsFromConfirmedTags(ordered),
        selectedTagKeysFromConfirmedTags(ordered),
      ),
    ).toEqual(ordered);
  }
});
it("matches current review calculation and ignores unknown selections", () => {
  const suggested = suggestedTagsFromConfirmedTags(
    FICTIONAL_PROFILES[0]!.confirmedTags,
  );
  const selected = new Set(suggested.filter((_, i) => i % 2 === 0).map(tagKey));
  selected.add("aiBoundaries:disclose_ai_use");
  selected.add("unknown:key");
  const inline = confirmedTagsFromCandidates(
    suggested.map((tag) => ({
      ...tag,
      confirmedByUser: selected.has(`${tag.category}:${tag.tag}`),
    })),
  );
  expect(confirmedTagsFromSelection(suggested, selected)).toEqual(inline);
  expect(confirmedTagsFromSelection([], selected)).toEqual(
    confirmedTagsFromCandidates([]),
  );
});
