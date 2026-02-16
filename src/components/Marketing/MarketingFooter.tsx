import { Link } from "react-router-dom";
import logo from "@/assets/paisaa-saarthi-logo.jpeg";

const quickLinks = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Services", to: "/services" },
  { label: "How to Apply", to: "/how-to-apply" },
  { label: "Contact", to: "/contact" },
  { label: "FAQ", to: "/faq" },
];

const legalLinks = [
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms & Conditions", to: "/terms" },
];

export function MarketingFooter() {
  return (
    <footer className="bg-foreground text-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={logo} alt="Paisa Saarthi" className="h-10 w-10 rounded-lg object-cover" />
              <span className="font-heading font-bold text-xl">Paisa Saarthi</span>
            </div>
            <p className="text-sm opacity-70 leading-relaxed">
              Your trusted financial partner for personal and business loans. Quick disbursals, transparent processes, and customer-first approach.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm opacity-70 hover:opacity-100 transition-opacity">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Legal */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Contact Us</h3>
            <div className="space-y-2 text-sm opacity-70">
              <p>📧 info@paisasaarthi.com</p>
              <p>📞 +91 98765 43210</p>
              <p>📍 Mumbai, Maharashtra, India</p>
            </div>
            <div className="mt-6">
              <h4 className="font-heading font-semibold text-sm mb-2">Legal</h4>
              <ul className="space-y-1">
                {legalLinks.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="text-sm opacity-70 hover:opacity-100 transition-opacity">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-background/20 mt-8 pt-8 text-center text-sm opacity-50">
          © {new Date().getFullYear()} Paisa Saarthi. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
