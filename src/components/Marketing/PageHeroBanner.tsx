interface PageHeroBannerProps {
  title: string;
  highlightedWord: string;
  subtitle: string;
}

export function PageHeroBanner({ title, highlightedWord, subtitle }: PageHeroBannerProps) {
  return (
    <section
      className="py-16 md:py-20 text-center text-white"
      style={{ background: "linear-gradient(135deg, hsl(var(--teal-600)) 0%, hsl(var(--teal-500)) 50%, hsl(var(--teal-400)) 100%)" }}
    >
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="font-heading text-4xl md:text-5xl font-extrabold">
          {title} <span style={{ color: "hsl(var(--gold-500))" }}>{highlightedWord}</span>
        </h1>
        <p className="mt-4 text-lg text-white/80">{subtitle}</p>
      </div>
    </section>
  );
}
