"use client";

export function ReceiptPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-white/20 px-4 py-2 text-sm text-white hover:border-white/40 print:hidden"
    >
      Print / save PDF
    </button>
  );
}
