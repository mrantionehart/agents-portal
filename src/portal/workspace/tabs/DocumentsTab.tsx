// ============================================================================
// AGENT PORTAL 3.0 — Workflow 3.2.A — Documents tab
// ============================================================================
// Composes the existing R4 DocumentsPanel with the W3.2.A per-form
// FormDetailDrawer. The drawer is server-rendered and only shown when
// the parent page resolves `?form=<form_id>` to a valid form in scope.
// Tab itself remains read-only.
// ============================================================================

import DocumentsPanel from "@/src/portal/documents/DocumentsPanel";
import FormDetailDrawer from "@/src/portal/documents/details/FormDetailDrawer";
import ChecklistTable from "@/src/portal/documents/checklist/ChecklistTable";
import type { DocumentRow } from "@/src/portal/documents/types";
import type { FormDetailBundle } from "@/src/portal/documents/details/types";
import type { CoachRecommendation } from "@/src/portal/workspace/types";

export interface DocumentsTabProps {
  transactionId: string;
  documents: DocumentRow[];
  documentsError: string | null;
  paperworkPackageUrl: string;
  /** When set, the drawer renders for this form_id. */
  activeFormId: string | null;
  /** Drawer payload — loaded by the parent page when activeFormId !== null. */
  activeFormDocument: DocumentRow | null;
  activeFormInstanceId: string | null;
  activeFormDetail: FormDetailBundle | null;
  /** AGENT.SIGN.1C — Coach recommendation for the checklist header. */
  coachRecommendation?: CoachRecommendation | null;
}

export default function DocumentsTab({
  transactionId,
  documents,
  documentsError,
  paperworkPackageUrl,
  activeFormId,
  activeFormDocument,
  activeFormInstanceId,
  activeFormDetail,
  coachRecommendation,
}: DocumentsTabProps) {
  return (
    <div className="relative space-y-6">
      {/* AGENT.SIGN.1C — Vault-powered required-document checklist. */}
      <ChecklistTable
        transactionId={transactionId}
        coachRecommendation={coachRecommendation}
      />
      <DocumentsPanel
        documents={documents}
        error={documentsError}
        paperworkPackageUrl={paperworkPackageUrl}
        transactionId={transactionId}
        activeFormId={activeFormId}
      />
      {activeFormId && activeFormDocument && activeFormDetail && (
        <FormDetailDrawer
          transactionId={transactionId}
          document={activeFormDocument}
          formInstanceId={activeFormInstanceId}
          detail={activeFormDetail}
        />
      )}
    </div>
  );
}
