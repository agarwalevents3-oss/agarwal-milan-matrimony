"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";

export interface FaqRow {
  id: string; question: string; answer: string; sortOrder: number; isActive: boolean;
}

/**
 * FAQ management (PRD §4.4): add, edit, delete, reorder, enable and disable.
 *
 * Reordering sends the complete ordered list in one request rather than a
 * series of swaps, so the saved order is always exactly what is on screen.
 */
export function FaqManager({ initial }: { initial: FaqRow[] }) {
  const router = useRouter();
  const [faqs, setFaqs] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ question: "", answer: "" });

  async function call(payload: Record<string, unknown>, optimistic?: () => void) {
    setBusy(true);
    setError(null);
    optimistic?.();
    try {
      await apiPost("/api/admin/faqs", payload);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "That change could not be saved.");
      router.refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (draft.question.trim().length < 3 || draft.answer.trim().length < 3) {
      setError("Both the question and the answer are required.");
      return;
    }
    const ok = await call({ action: "create", ...draft });
    if (ok) {
      setDraft({ question: "", answer: "" });
      setAdding(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= faqs.length) return;

    const next = [...faqs];
    [next[index], next[target]] = [next[target], next[index]];
    await call({ action: "reorder", ids: next.map((f) => f.id) }, () => setFaqs(next));
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <CardHeader
          title={`${faqs.length} ${faqs.length === 1 ? "question" : "questions"}`}
          description="Shown on the contact page in this order"
          action={
            !adding && (
              <Button size="sm" onClick={() => setAdding(true)} disabled={busy}>
                <Plus className="h-4 w-4" aria-hidden />
                Add
              </Button>
            )
          }
        />

        {adding && (
          <div className="space-y-4 border-b border-line bg-canvas p-5 sm:p-6">
            <Field label="Question" required>
              {({ id }) => (
                <Input id={id} value={draft.question} autoFocus
                       onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))} />
              )}
            </Field>
            <Field label="Answer" required>
              {({ id }) => (
                <Textarea id={id} rows={3} value={draft.answer}
                          onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))} />
              )}
            </Field>
            <div className="flex gap-2.5">
              <Button onClick={create} disabled={busy}>{busy ? "Adding…" : "Add question"}</Button>
              <Button variant="ghost" onClick={() => { setAdding(false); setDraft({ question: "", answer: "" }); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {faqs.length === 0 && !adding ? (
          <p className="px-5 py-8 text-center text-sm text-muted sm:px-6">
            No questions yet. Add the first one.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {faqs.map((faq, index) => (
              <li key={faq.id} className="px-5 py-4 sm:px-6">
                {editing === faq.id ? (
                  <EditFaq
                    faq={faq} busy={busy}
                    onCancel={() => setEditing(null)}
                    onSave={async (question, answer) => {
                      const ok = await call({ action: "update", id: faq.id, question, answer }, () =>
                        setFaqs((current) =>
                          current.map((f) => (f.id === faq.id ? { ...f, question, answer } : f))),
                      );
                      if (ok) setEditing(null);
                    }}
                  />
                ) : (
                  <div className="flex gap-3">
                    <div className="flex shrink-0 flex-col gap-0.5 pt-0.5">
                      <button
                        type="button" onClick={() => move(index, -1)}
                        disabled={busy || index === 0}
                        className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-primary-soft hover:text-primary disabled:opacity-30"
                        aria-label={`Move "${faq.question}" up`}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button" onClick={() => move(index, 1)}
                        disabled={busy || index === faqs.length - 1}
                        className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-primary-soft hover:text-primary disabled:opacity-30"
                        aria-label={`Move "${faq.question}" down`}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-ink">{faq.question}</p>
                        {!faq.isActive && <Badge>Hidden</Badge>}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{faq.answer}</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(faq.id)} disabled={busy}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost" size="sm" disabled={busy}
                          onClick={() => call(
                            { action: "update", id: faq.id, isActive: !faq.isActive },
                            () => setFaqs((c) => c.map((f) => f.id === faq.id ? { ...f, isActive: !f.isActive } : f)),
                          )}
                        >
                          {faq.isActive
                            ? <><EyeOff className="h-3.5 w-3.5" aria-hidden /> Hide</>
                            : <><Eye className="h-3.5 w-3.5" aria-hidden /> Show</>}
                        </Button>
                        <Button
                          variant="ghost" size="sm" disabled={busy}
                          className="text-danger hover:bg-danger-soft"
                          onClick={() => call(
                            { action: "delete", id: faq.id },
                            () => setFaqs((c) => c.filter((f) => f.id !== faq.id)),
                          )}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function EditFaq({ faq, busy, onSave, onCancel }: {
  faq: FaqRow; busy: boolean;
  onSave: (question: string, answer: string) => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState(faq.question);
  const [answer, setAnswer] = useState(faq.answer);

  return (
    <div className="space-y-4">
      <Field label="Question" required>
        {({ id }) => <Input id={id} value={question} autoFocus onChange={(e) => setQuestion(e.target.value)} />}
      </Field>
      <Field label="Answer" required>
        {({ id }) => <Textarea id={id} rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} />}
      </Field>
      <div className="flex gap-2.5">
        <Button onClick={() => onSave(question, answer)} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}
