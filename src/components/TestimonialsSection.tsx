import { Star } from "lucide-react";

const testimonials = [
  {
    quote: "SynaPilot transformed how we manage our 50+ clients. The AI-powered automation saves us 20 hours per week.",
    author: "Sarah Chen",
    role: "CEO, Digital Spark Agency",
    avatar: "SC",
  },
  {
    quote: "The best investment we've made. Our team's productivity doubled within the first month of using SynaPilot.",
    author: "Marcus Johnson",
    role: "Founder, Pixel Perfect Studios",
    avatar: "MJ",
  },
  {
    quote: "Finally, a platform that understands agency workflows. The client portal alone is worth the price.",
    author: "Elena Rodriguez",
    role: "Operations Director, Creative Minds",
    avatar: "ER",
  },
];

const TestimonialsSection = () => {
  return (
    <section className="relative py-24 md:py-32">
      <div className="container relative z-10">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <span className="inline-block px-4 py-1.5 mb-6 text-sm font-medium text-primary bg-primary/10 rounded-full border border-primary/20">
            Testimonials
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Loved by agencies{" "}
            <span className="gradient-text">worldwide</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.author}
              className="relative p-6 rounded-2xl glass transition-all duration-500 hover:glow-border"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-foreground mb-6 leading-relaxed">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-medium text-foreground">{testimonial.author}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
