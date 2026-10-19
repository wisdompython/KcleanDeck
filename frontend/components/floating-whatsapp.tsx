import { WhatsAppIcon } from "@/components/icons";
import { getSite } from "@/lib/api";
import { whatsappLink } from "@/lib/format";

export async function FloatingWhatsApp() {
  const site = await getSite().catch(() => null);
  return (
    <a
      href={whatsappLink(site?.whatsapp_number, "Hello Kleandeck, I'd like a quote for a cleaning job.")}
      aria-label="Chat with Kleandeck on WhatsApp"
      className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-50 inline-flex h-14 items-center gap-2 rounded-full bg-whatsapp px-4 font-display text-sm font-semibold text-white shadow-whatsapp transition hover:-translate-y-0.5 md:right-6 md:bottom-6 md:px-5"
    >
      <WhatsAppIcon className="size-6" />
      <span className="hidden sm:inline">Chat on WhatsApp</span>
    </a>
  );
}
