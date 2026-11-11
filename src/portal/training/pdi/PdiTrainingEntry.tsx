// Entry card on the AP Training hub. Renders NOTHING while the PDI surface is
// dark (flag off). Whether any course is actually available is decided by
// Vault's assignment gate on the landing page, not here.
import Link from "next/link";
import { Map as MapIcon } from "lucide-react";

import { PDI_CATEGORY_LABEL, pdiTrainingEnabled } from "./pdi-config";

export function PdiTrainingEntry() {
  if (!pdiTrainingEnabled()) return null;
  return (
    <Link
      href="/training/property-intelligence"
      className="mb-6 block rounded-xl border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-4 py-3 hover:bg-[#C9A84C]/15"
    >
      <div className="flex items-center gap-2 text-[#F1F1F3] font-semibold">
        <MapIcon className="h-4 w-4 text-[#C9A84C]" />
        {PDI_CATEGORY_LABEL}
      </div>
      <p className="text-sm text-[#A1A1AA] mt-1">
        Research ownership, folios, zoning and development opportunities from official public records.
      </p>
    </Link>
  );
}
