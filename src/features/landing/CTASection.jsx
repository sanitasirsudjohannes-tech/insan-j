import { Link } from 'react-router-dom';
import { useLandingContent } from './useLandingContent';

export default function CTASection() {
  const { content } = useLandingContent();
  const { badge, title, description, buttonText } = content.cta;

  return (
    <section className="px-5 py-20 sm:px-8 lg:px-10">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-cyan-300/15 bg-linear-to-br from-blue-900/70 to-emerald-900/45 p-8 text-center sm:p-14">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-emerald-300/10 blur-3xl" />
        <p className="relative text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">{badge}</p>
        <h2 className="relative mt-3 text-3xl font-bold sm:text-4xl">{title}</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300 whitespace-pre-wrap">
          {description}
        </p>
        <Link to="/login" className="relative mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-slate-900 transition hover:bg-cyan-50">
          {buttonText} <i className="fas fa-arrow-right text-xs" />
        </Link>
      </div>
    </section>
  );
}
