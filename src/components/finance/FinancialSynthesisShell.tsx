"use client";

import { useState } from "react";
import { FinancialSynthesis } from "@/components/finance/FinancialSynthesis";
import { NewAmendmentModal } from "@/components/finance/NewAmendmentModal";
import { AmendmentDocumentModal } from "@/components/finance/AmendmentDocumentModal";
import { buildAmendmentDocumentHtml, linesFromAmendment } from "@/lib/finance/amendment-document";
import { getAmendmentDocument } from "@/lib/actions/finance";
import type {
  FinancialAmendment,
  LotWithFinancials,
  Project,
} from "@/lib/types/database";

type FinancialSynthesisShellProps = {
  project: Project;
  lots: LotWithFinancials[];
  m365Ready: boolean;
};

export function FinancialSynthesisShell({
  project,
  lots,
  m365Ready,
}: FinancialSynthesisShellProps) {
  const [showNewAmendment, setShowNewAmendment] = useState(false);
  const [documentHtml, setDocumentHtml] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [showDocument, setShowDocument] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);

  async function handleAmendmentClick(amendment: FinancialAmendment, lot: LotWithFinancials) {
    setLoadingDoc(true);
    try {
      let html = amendment.document_html;
      if (!html) {
        const result = await getAmendmentDocument(project.id, amendment.id);
        html = result.html;
        if (!html && result.amendment?.lines?.length) {
          html = buildAmendmentDocumentHtml({
            project,
            lot,
            amendmentNumber: amendment.amendment_number,
            amendmentType: amendment.amendment_type,
            lines: linesFromAmendment(result.amendment.lines),
          });
        }
      }
      setDocumentHtml(html);
    } finally {
      setLoadingDoc(false);
    }

    setDocumentTitle(
      `Avenant n°${amendment.amendment_number} — ${lot.name} (${amendment.amendment_type.toUpperCase()})`
    );
    setShowDocument(true);
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setShowNewAmendment(true)}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Nouvelle avenant
        </button>
      </div>

      <FinancialSynthesis
        project={project}
        lots={lots}
        onAmendmentClick={handleAmendmentClick}
      />

      {loadingDoc && (
        <p className="fixed bottom-4 right-4 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white shadow-lg">
          Chargement de l&apos;avenant…
        </p>
      )}

      <NewAmendmentModal
        project={project}
        lots={lots}
        open={showNewAmendment}
        m365Ready={m365Ready}
        onClose={() => setShowNewAmendment(false)}
      />

      <AmendmentDocumentModal
        html={documentHtml}
        title={documentTitle}
        open={showDocument}
        onClose={() => {
          setShowDocument(false);
          setDocumentHtml(null);
        }}
      />
    </>
  );
}
