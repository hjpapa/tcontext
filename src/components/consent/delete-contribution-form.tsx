"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, LoaderCircle, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteContributionForm() {
  const [submissionId, setSubmissionId] = useState("");
  const [deletionToken, setDeletionToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/submissions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submissionId.trim(),
          deletionToken: deletionToken.trim(),
        }),
      });
      if (!response.ok) {
        throw new Error(
          "제출 ID 또는 삭제 코드를 확인해 주세요. 보안을 위해 어느 값이 틀렸는지는 구분해 알려드리지 않습니다.",
        );
      }
      setDeleted(true);
      setSubmissionId("");
      setDeletionToken("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "삭제하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (deleted) {
    return (
      <div
        role="status"
        className="border-l-4 border-[#3b7a57] bg-[#edf5ef] p-6"
      >
        <Check aria-hidden="true" className="size-7 text-[#28684c]" />
        <h2 className="mt-3 text-2xl font-bold">기여 데이터를 삭제했습니다.</h2>
        <p className="mt-2 leading-7 text-[#536159]">
          같은 ID와 삭제 코드로는 더 이상 조회하거나 삭제할 데이터가 없습니다.
        </p>
        <Button asChild variant="outline" className="mt-5 bg-white">
          <Link href="/">처음으로 돌아가기</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="space-y-2">
        <Label htmlFor="submission-id" className="text-base font-bold">
          제출 ID
        </Label>
        <Input
          id="submission-id"
          name="submissionId"
          value={submissionId}
          onChange={(event) => setSubmissionId(event.target.value)}
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="예: 123e4567-e89b-12d3-a456-426614174000"
          className="min-h-12 border-[#aebbb0] bg-white text-base"
          aria-describedby="delete-help"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="deletion-token" className="text-base font-bold">
          삭제 코드
        </Label>
        <Input
          id="deletion-token"
          name="deletionToken"
          type="password"
          value={deletionToken}
          onChange={(event) => setDeletionToken(event.target.value)}
          required
          minLength={32}
          autoComplete="off"
          spellCheck={false}
          placeholder="기여 완료 화면에서 받은 삭제 코드"
          className="min-h-12 border-[#aebbb0] bg-white text-base"
        />
      </div>
      <p id="delete-help" className="text-sm leading-6 text-[#536159]">
        두 값은 기여 완료 시 한 번만 표시됩니다. TContext는 이름이나 이메일로
        제출 내역을 찾지 않으므로 코드를 잃어버리면 개별 요청으로 찾을 수
        없습니다.
      </p>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>삭제하지 못했습니다</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="submit"
        variant="destructive"
        size="lg"
        disabled={
          busy || !submissionId.trim() || deletionToken.trim().length < 32
        }
        className="min-h-12 px-6 text-base"
      >
        {busy ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <Trash2 aria-hidden="true" />
        )}
        {busy ? "영구 삭제 중" : "기여 데이터 영구 삭제"}
      </Button>
    </form>
  );
}
