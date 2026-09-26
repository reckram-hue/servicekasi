'use client';

export function ReversePaymentButton() {
  return (
    <button
      type="submit"
      onClick={(ev) => {
        if (!window.confirm('Reverse this payment? This corrects a mistake — it cannot be undone, and a fresh payment must be recorded if money is still owed.')) {
          ev.preventDefault();
        }
      }}
      className="rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10"
    >
      Reverse
    </button>
  );
}
