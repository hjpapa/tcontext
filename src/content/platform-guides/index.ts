import { CHATGPT_GUIDE } from "./chatgpt";
import { GEMINI_GUIDE } from "./gemini";
import { CLAUDE_GUIDE } from "./claude";
import type { PlatformGuide } from "./schema";
export const PLATFORM_GUIDES: PlatformGuide[] = [
  CHATGPT_GUIDE,
  GEMINI_GUIDE,
  CLAUDE_GUIDE,
];
export function findPlatformGuide(id: string): PlatformGuide | undefined {
  return PLATFORM_GUIDES.find((guide) => guide.id === id);
}
