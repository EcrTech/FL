import { MessageCircle, Phone } from "lucide-react";

const WHATSAPP_NUMBER = "919876543210";
const CALL_NUMBER = "+919876543210";

export function FloatingButtons() {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center h-14 w-14 rounded-full bg-[#25D366] text-white shadow-lg hover:scale-110 transition-transform animate-bounce"
        aria-label="WhatsApp"
        style={{ animationDuration: "2s" }}
      >
        <MessageCircle className="h-6 w-6" />
      </a>
      <a
        href={`tel:${CALL_NUMBER}`}
        className="flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform"
        aria-label="Call us"
      >
        <Phone className="h-6 w-6" />
      </a>
    </div>
  );
}
