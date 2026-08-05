import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminProfileDocument } from "@/components/admin/profile-document";
import { FICTIONAL_PROFILES } from "@/content/examples";

describe("AdminProfileDocument", () => {
  it("renders canonical profile sections and escapes stored text", () => {
    const base = FICTIONAL_PROFILES[0];
    if (!base) throw new Error("profile fixture missing");
    const profile = structuredClone(base);
    const firstClaim = profile.modules[0]?.claims[0];
    if (!firstClaim) throw new Error("claim fixture missing");
    firstClaim.text = "<script>window.bad = true</script> 안전한 본문";

    const { container } = render(<AdminProfileDocument profile={profile} />);

    expect(container.querySelector("script")).toBeNull();
    expect(
      screen.getByText("<script>window.bad = true</script> 안전한 본문"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "수업 설계 원칙" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "교사가 확인한 태그" }),
    ).toBeInTheDocument();
  });
});
