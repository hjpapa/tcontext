export const SKILL_FORMAT = {
  source: "https://agentskills.io/specification",
  verifiedAt: "2026-10-30",
  namePattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/u,
  nameMaxLength: 64,
  descriptionMaxLength: 1024,
  allowedFrontmatterKeys: [
    "name",
    "description",
    "license",
    "compatibility",
    "metadata",
    "allowed-tools",
  ],
  bodyMaxLines: 500,
  bodyMaxCharacters: 8000,
} as const;
