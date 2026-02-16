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

const loanTypes = [
  "Personal Loan",
  "Short Term Personal Loan",
  "Instant Personal Loan",
  "Quick Personal Loan",
  "Emergency Loan",
  "Quick Loans For Medical Emergency",
];

export function MarketingFooter() {
  return (
    <footer className="text-white" style={{ background: "hsl(220, 13%, 12%)" }}>
      {/* Fraud Warning */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="rounded-xl border border-yellow-600/40 p-6" style={{ background: "hsl(220, 13%, 15%)" }}>
          <p className="text-center font-bold text-yellow-400 mb-4">⚠️ NEVER PAY IN CASH OR INTO ANYONE'S PERSONAL ACCOUNT ⚠️</p>
          <div className="space-y-2 text-sm text-white/70">
            <p>• We never ask to deposit any cash/funds in any personal bank account. If anyone claims to be Paisaa Saarthi's representative and asks you to deposit funds in their bank account, please be aware that they are not associated with Paisaa Saarthi.</p>
            <p>• We will not be held liable for any loss arising out of any such deposits made in any personal bank account.</p>
            <p>• We never entertain any demand to pay any commission to process a loan. If you come across any such demand, please report it to us immediately.</p>
          </div>
          <p className="mt-4 text-sm text-white/70">
            📞 Report suspicious activity: <a href="tel:+917982012776" className="font-semibold" style={{ color: "hsl(var(--gold-500))" }}>+91 79-82012776</a> | 📧 Email: <a href="mailto:info@paisaasaarthi.com" className="font-semibold" style={{ color: "hsl(var(--gold-500))" }}>info@paisaasaarthi.com</a>
          </p>
        </div>
      </div>

      {/* NBFC & Grievance */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
        <p className="font-bold text-lg">A unit of Skyrise Credit and Marketing Limited</p>
        <p className="text-sm mt-1" style={{ color: "hsl(var(--gold-500))" }}>RBI Licence No: B-14.02284</p>
        <p className="font-bold text-base mt-3">Paisaa Saarthi</p>
        <p className="font-bold mt-1" style={{ color: "hsl(var(--gold-500))" }}>GRIEVANCE REDRESSAL CELL</p>
        <p className="text-sm text-white/70 mt-3 max-w-3xl mx-auto">We at Paisaa Saarthi follow all the directives of RBI for grievance redressal.</p>
        <p className="text-sm text-white/70 mt-2 max-w-3xl mx-auto">We practice responsible lending within the regulatory framework in the best interests of our customers. In case you are not satisfied with our services, our dedicated grievance redressal team is always there to look into the matter and address issues within 5 working days.</p>
        <p className="mt-4 text-sm text-white/70">
          📞 Call us at: <a href="tel:+917982012776" className="font-semibold" style={{ color: "hsl(var(--gold-500))" }}>+91 79-82012776</a> | 📧 Email us at: <a href="mailto:info@paisaasaarthi.com" className="font-semibold" style={{ color: "hsl(var(--gold-500))" }}>info@paisaasaarthi.com</a>
        </p>
      </div>

      {/* Main footer grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-white/10">
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
      </div>

      {/* Loan type links */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap justify-center gap-x-2 text-sm text-white/50">
          {loanTypes.map((t, i) => (
            <span key={t}>
              <Link to="/services" className="hover:text-white transition-colors">{t}</Link>
              {i < loanTypes.length - 1 && <span className="mx-2">|</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Important disclaimer */}
      <div style={{ background: "hsl(220, 13%, 8%)" }} className="py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-white/50">
          <p><span className="font-bold" style={{ color: "hsl(var(--gold-500))" }}>Important*</span> – As a registered entity, Paisaa Saarthi adheres to all regulatory guidelines and offers loans to eligible customers through our website and CRM platform. We would like to inform our customers and the general public that we do not have any mobile app on Android or the App Store, nor do we disburse loans through any mobile application. Please be cautious of any unauthorized lending apps using our name, and notify us immediately if you encounter such fraudulent activities where our name and logo are being misused.</p>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-white/10 py-4 text-center text-sm text-white/40">
        © {new Date().getFullYear()} Paisaa Saarthi Fintech Pvt Ltd. All rights reserved.
      </div>
    </footer>
  );
}
