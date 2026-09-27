'use client';

export function NotifyClientButton({
  publicUrl,
  clientPhone,
  clientFirstName,
  businessName,
  suburb,
  date,
  time,
  technicianFirstNames,
  enRoute,
}: {
  publicUrl: string;
  clientPhone: string | null;
  clientFirstName: string;
  businessName: string;
  suburb: string | null;
  date: string;
  time: string;
  technicianFirstNames: string[];
  enRoute: boolean;
}) {
  if (!clientPhone) return null;

  const who = technicianFirstNames.length > 0 ? technicianFirstNames.join(' and ') : 'Our technician';
  const where = suburb ? ` ${suburb}` : '';
  const message = enRoute
    ? `Hi ${clientFirstName}, ${who} from ${businessName} is on the way to your${where} appointment now. See who's coming: ${publicUrl}`
    : `Hi ${clientFirstName}, ${who} from ${businessName} is booked for your${where} appointment at ${time} on ${date}. See who's coming: ${publicUrl}`;

  const whatsappHref = `https://wa.me/${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-md bg-emerald-600/90 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-600"
    >
      Notify client
    </a>
  );
}
