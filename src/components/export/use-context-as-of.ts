"use client";

import { useEffect, useState } from "react";
import {
  useInterviewSession,
  type LocalProfileLink,
} from "@/components/layout/interview-session-provider";
import { useLocalProfiles } from "@/components/local-profiles/local-profiles-provider";
import { sameProfileContent } from "@/lib/profile/versions";
import { contextAsOf, type ContextAsOf } from "@/lib/export/profile-variants";
import {
  getLocalProfile,
  type LocalProfileRepositoryOptions,
} from "@/lib/storage/profiles/repository";
import type { TeacherContextProfile } from "@/types/profile";

type ConfirmedDate = {
  profile: TeacherContextProfile;
  link: LocalProfileLink;
  options: LocalProfileRepositoryOptions;
  confirmedAt: string | null;
};

export function useContextAsOf(profile: TeacherContextProfile): ContextAsOf;
export function useContextAsOf(profile: null): null;
export function useContextAsOf(
  profile: TeacherContextProfile | null,
): ContextAsOf | null;
export function useContextAsOf(
  profile: TeacherContextProfile | null,
): ContextAsOf | null {
  const { localProfileLink } = useInterviewSession();
  const { availability, options } = useLocalProfiles();
  const [confirmed, setConfirmed] = useState<ConfirmedDate | null>(null);

  useEffect(() => {
    if (!profile || !localProfileLink || availability !== "enabled") return;
    let active = true;
    void getLocalProfile(localProfileLink.recordId, options)
      .then((result) => {
        if (active) {
          const stored = result.ok ? result.value.confirmed : null;
          // A failed confirmed save leaves an older version behind; its date
          // must not be attached to content the teacher has since changed.
          const current =
            stored !== null && sameProfileContent(stored.profile, profile);
          setConfirmed({
            profile,
            link: localProfileLink,
            options,
            confirmedAt: current ? stored.confirmedAt : null,
          });
        }
      })
      .catch(() => {
        if (active) {
          setConfirmed({
            profile,
            link: localProfileLink,
            options,
            confirmedAt: null,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [profile, localProfileLink, availability, options]);

  if (!profile) return null;
  const confirmedAt =
    availability === "enabled" &&
    confirmed?.profile === profile &&
    confirmed.link === localProfileLink &&
    confirmed.options === options
      ? confirmed.confirmedAt
      : null;
  return contextAsOf(profile, confirmedAt);
}
