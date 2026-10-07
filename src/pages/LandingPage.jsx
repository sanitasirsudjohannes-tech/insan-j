import { useEffect, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar';
import BottomNavigation from '../components/BottomNavigation';
import HeroSection from '../features/landing/HeroSection';
import AboutSection from '../features/landing/AboutSection';
import ModulesSection from '../features/landing/ModulesSection';
import VideoSection from '../features/landing/VideoSection';
import WorkflowSection from '../features/landing/WorkflowSection';
import CTASection from '../features/landing/CTASection';
import LandingFooter from '../features/landing/LandingFooter';
import { LandingContentProvider } from '../features/landing/useLandingContent';

export default function LandingPage() {
  const observerRef = useRef(null);

  useEffect(() => {
    const nodes = document.querySelectorAll('[data-landing-reveal]');
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(node => node.classList.add('opacity-100', 'translate-y-0'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.12 }
    );
    observerRef.current = observer;
    nodes.forEach(node => observer.observe(node));

    return () => observer.disconnect();
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <LandingContentProvider>
      <main className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
        <Sidebar variant="landing" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <BottomNavigation variant="landing" />
        
        <HeroSection setSidebarOpen={setSidebarOpen} />
        <AboutSection />
        <ModulesSection />
        <VideoSection />
        <WorkflowSection />
        <CTASection />
        <LandingFooter />
      </main>
    </LandingContentProvider>
  );
}
