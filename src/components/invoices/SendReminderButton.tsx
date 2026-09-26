'use client';

export function SendReminderButton({ clientPhone, message }: { clientPhone: string | null; message: string }) {
  if (!clientPhone) {
    return <span className="text-xs text-slate-500">No phone number</span>;
  }
  const whatsappHref = `https://wa.me/${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
  return (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
    >
      Send reminder
    </a>
  );
}
