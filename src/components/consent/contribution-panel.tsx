"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Clipboard,
  Database,
  Download,
  LoaderCircle,
} from "lucide-react";

import {
  type ContributionReceipt,
  useInterviewSession,
} from "@/components/layout/interview-session-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { TeacherContextProfile } from "@/types/profile";

export function ContributionPanel({
  profile,
  markdown,
  consentVersion,
  retentionDays,
}: {
  profile: TeacherContextProfile;
  markdown: string;
  consentVersion: string;
  retentionDays: number;
}) {
  const { contributionReceipt, setContributionReceipt } = useInterviewSession();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"id" | "token" | null>(null);

  const contribute = async () => {
    if (!accepted || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/submissions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentAccepted: true,
          profile,
          profileMarkdown: markdown,
          confirmedTags: profile.confirmedTags,
          privacyReview: profile.privacyReview,
          consentVersion,
        }),
      });
      if (!response.ok) {
        throw new Error(
          "기여 데이터를 저장하지 못했습니다. 문서 다운로드에는 영향이 없습니다.",
        );
      }
      setContributionReceipt((await response.json()) as ContributionReceipt);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "기여 데이터를 저장하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string, type: "id" | "token") => {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const downloadReceipt = (receipt: ContributionReceipt) => {
    const deletionUrl = new URL("/delete", window.location.origin).toString();
    const text = [
      "TContext 선택적 데이터 기여 영수증",
      "",
      `제출 ID: ${receipt.submissionId}`,
      `삭제 코드: ${receipt.deletionToken}`,
      `기여 시각: ${receipt.createdAt}`,
      `자동 삭제 대상 전환: ${receipt.retentionUntil}`,
      "",
      `삭제 페이지: ${deletionUrl}`,
      "삭제 방법: 삭제 페이지에서 제출 ID와 삭제 코드를 입력하세요.",
      "삭제 코드를 분실하면 로그인이나 이메일로 제출 데이터를 찾거나 삭제하기 어렵습니다.",
      "이 영수증은 다시 발급되지 않습니다.",
    ].join("\n");
    const blob = new Blob(["\uFEFF", text], {
      type: "text/plain;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `tcontext-submission-receipt-${receipt.submissionId}.txt`;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  if (profile.privacyReview.status !== "clear") {
    return (
      <section
        aria-labelledby="contribution-disabled-title"
        className="border-t border-[#cfd8d0] pt-10"
      >
        <div className="border-l-4 border-[#b66a2c] bg-[#fff8ec] p-5">
          <p className="text-sm font-bold text-[#8a4d1d]">선택적 기여 꺼짐</p>
          <h2
            id="contribution-disabled-title"
            className="mt-1 text-xl font-bold"
          >
            개인정보 경고가 남아 있어 이 문서는 서버에 기여할 수 없습니다.
          </h2>
          <p className="mt-2 leading-7 text-[#653f20]">
            다운로드와 복사는 그대로 사용할 수 있습니다. 기여하려면 검토
            화면으로 돌아가 해당 표현을 수정한 뒤 개인정보 검사를 다시 진행해
            주세요.
          </p>
        </div>
      </section>
    );
  }

  if (contributionReceipt) {
    return (
      <section
        aria-labelledby="receipt-title"
        className="border-l-4 border-[#3b7a57] bg-[#edf5ef] p-5 sm:p-6"
      >
        <div className="flex gap-3">
          <Check
            aria-hidden="true"
            className="mt-0.5 size-6 shrink-0 text-[#28684c]"
          />
          <div className="min-w-0 flex-1">
            <h2 id="receipt-title" className="text-xl font-bold">
              선택적 기여가 완료되었습니다.
            </h2>
            <p className="mt-2 leading-7 text-[#536159]">
              아래 두 값은 서버에서 다시 보여드릴 수 없습니다. 안전한 곳에
              복사해 두어야 나중에 직접 삭제할 수 있습니다.
            </p>
          </div>
        </div>
        <dl className="mt-5 space-y-4">
          <div>
            <dt className="font-bold">제출 ID</dt>
            <dd className="mt-1 flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 bg-white px-3 py-2 text-sm break-all">
                {contributionReceipt.submissionId}
              </code>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void copy(contributionReceipt.submissionId, "id")
                }
              >
                <Clipboard aria-hidden="true" />
                {copied === "id" ? "복사됨" : "ID 복사"}
              </Button>
            </dd>
          </div>
          <div>
            <dt className="font-bold">삭제 코드</dt>
            <dd className="mt-1 flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 bg-white px-3 py-2 text-sm break-all">
                {contributionReceipt.deletionToken}
              </code>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void copy(contributionReceipt.deletionToken, "token")
                }
              >
                <Clipboard aria-hidden="true" />
                {copied === "token" ? "복사됨" : "코드 복사"}
              </Button>
            </dd>
          </div>
          <div>
            <dt className="font-bold">자동 삭제 대상 전환</dt>
            <dd className="mt-1">
              {new Date(contributionReceipt.retentionUntil).toLocaleDateString(
                "ko-KR",
              )}
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            className="bg-[#153f2e] text-white"
            onClick={() => downloadReceipt(contributionReceipt)}
          >
            <Download aria-hidden="true" />
            삭제 정보 영수증 다운로드
          </Button>
          <Button asChild variant="outline" className="bg-white">
            <Link href="/delete">지금 삭제 화면 열기</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="contribution-title"
      className="border-t border-[#cfd8d0] pt-10"
    >
      <div className="max-w-3xl">
        <p className="text-sm font-bold text-[#6a736d]">선택 사항</p>
        <h2 id="contribution-title" className="mt-1 text-2xl font-bold">
          익명 프로필을 서비스 개선에 기여하기
        </h2>
        <p className="mt-3 leading-7 text-[#536159]">
          다운로드와 완전히 별개의 선택입니다. 동의하지 않아도 모든 내보내기
          기능을 사용할 수 있습니다.
        </p>
      </div>

      <div className="mt-5 bg-[#f1f2ed] p-5">
        <h3 className="font-bold">저장되는 것</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 leading-7">
          <li>검토를 마친 최종 프로필과 Markdown</li>
          <li>직접 선택한 태그와 개인정보 검사 결과</li>
          <li>동의 시각·버전, 생성 모델·스키마 버전</li>
        </ul>
        <h3 className="mt-5 font-bold">저장되지 않는 것</h3>
        <p className="mt-2 leading-7">
          인터뷰 원문, 이름, 이메일, IP 주소, 사용자 에이전트, 쿠키
        </p>
        <p className="mt-4 text-sm leading-6 text-[#536159]">
          실제 보유 기간은 최대 {retentionDays}일입니다.{" "}
          {retentionDays === 1
            ? "제출 즉시 자동 삭제 대상으로 전환되며 다음 일일 정리 주기 안에 삭제됩니다."
            : `매일 실행되는 정리 시간을 포함하기 위해 제출 ${retentionDays - 1}일 뒤 자동 삭제 대상으로 전환됩니다.`}{" "}
          제출 뒤 제공되는 ID와 삭제 코드로 언제든 즉시 삭제할 수 있습니다.
        </p>
      </div>

      <div className="mt-5 flex items-start gap-3">
        <Checkbox
          id="contribution-consent"
          checked={accepted}
          onCheckedChange={(value) => setAccepted(value === true)}
          className="mt-1 size-5"
        />
        <Label
          htmlFor="contribution-consent"
          className="cursor-pointer text-base leading-7"
        >
          위 저장 항목과 보유 기간을 확인했으며, 검토한 최종 프로필을 선택적으로
          기여하는 데 동의합니다.
        </Label>
      </div>

      {error ? (
        <Alert variant="destructive" className="mt-5" role="alert">
          <AlertTitle>저장하지 못했습니다</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={!accepted || busy}
        onClick={() => void contribute()}
        className="mt-5 min-h-12 bg-white"
      >
        {busy ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <Database aria-hidden="true" />
        )}
        {busy ? "선택한 데이터 저장 중" : "동의하고 데이터 기여"}
      </Button>
    </section>
  );
}
