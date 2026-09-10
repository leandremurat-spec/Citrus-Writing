/** Structured character-sheet fields (Role/Wants/Fears/Tell, or whatever a writer names them). */

export interface SheetField {
  label: string;
  value: string;
}

/** Stored as a JSON array on `CodexEntry.sheetFields`; `null` means "no sheet yet". */
export function parseSheetFields(raw: string | null): SheetField[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SheetField =>
        typeof item === "object" && item !== null && typeof item.label === "string" && typeof item.value === "string",
    );
  } catch {
    return [];
  }
}
