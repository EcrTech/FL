import { Link } from "react-router-dom";
import logo from "@/assets/paisaa-saarthi-logo.jpeg";

const quickLinks = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Services", to: "/services" },
  { label: "How to Apply", to: "/how-to-apply" },
  { label: "FAQ", to: "/faq" },
  { label: "Contact", to: "/contact" },
];

const legalLinks = [
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms & Conditions", to: "/terms" },
];

export function MarketingFooter() {
  return (
    <footer className="text-white" style={{ background: "hsl(220, 13%, 12%)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src={logo} alt="Paisaa Saarthi" className="h-10 w-10 rounded-lg object-cover" />
              <div>
                <span className="font-heading font-bold text-lg block">Paisaa Saarthi</span>
                <span className="text-xs" style={{ color: "hsl(var(--gold-500))" }}>Chhote loans, badi udaan</span>
              </div>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              Your trusted companion for small-ticket personal loans. Quick, transparent, and hassle-free.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-heading font-semibold text-base mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-white/60 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-heading font-semibold text-base mb-4">Legal</h3>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-white/60 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading font-semibold text-base mb-4">Contact Us</h3>
            <div className="space-y-2 text-sm text-white/60">
              <p>📞 +91 79-82012776</p>
              <p>📧 info@paisaasaarthi.com</p>
              <p>📧 support@paisaasaarthi.com</p>
              <p className="leading-relaxed">📍 Paisaa Saarthi, Office no. 110, 1st floor, H-161, BSI Business Park Sec-63, Noida, UP-201301</p>
              <p>🕐 Mon - Sat, 9:00 AM - 6:00 PM</p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-6 text-center text-sm text-white/40">
          © {new Date().getFullYear()} Paisaa Saarthi Fintech Pvt Ltd. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
