"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  clearAdminSessionCookie,
  setAdminSessionCookie,
  verifyAdminPassword,
} from "@/lib/admin/auth";
import { ApiError } from "@/lib/security/api-error";
import { enforceRateLimit } from "@/lib/security/rate-limit";

function loginError(code: "configuration" | "invalid" | "rate-limited"): never {
  redirect(`/admin/login?error=${code}`);
}

export async function loginAdmin(formData: FormData): Promise<never> {
  const requestHeaders = new Headers(await headers());
  try {
    await enforceRateLimit(
      new Request("https://tcontext.invalid/admin/login", {
        headers: requestHeaders,
      }),
      "admin-login",
    );
  } catch (error) {
    if (error instanceof ApiError && error.code === "rate_limit_exceeded") {
      loginError("rate-limited");
    }
    throw error;
  }

  const raw = formData.get("password");
  const password = typeof raw === "string" ? raw : "";
  let verified = false;
  try {
    verified = await verifyAdminPassword(password);
  } catch (error) {
    if (error instanceof ApiError && error.code === "configuration_error") {
      loginError("configuration");
    }
    throw error;
  }
  if (!verified) loginError("invalid");

  await setAdminSessionCookie();
  redirect("/admin");
}

export async function logoutAdmin(): Promise<never> {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}
