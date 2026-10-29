import { useState, useEffect, createContext, useContext } from 'react';
import { getLandingContent, DEFAULT_LANDING_CONTENT } from '../admin/landing/landingSettingsService';

const LandingContentContext = createContext(DEFAULT_LANDING_CONTENT);

export function LandingContentProvider({ children }) {
  const [content, setContent] = useState(DEFAULT_LANDING_CONTENT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getLandingContent().then(data => {
      if (mounted && data) {
        // Gabungkan dengan default jika ada properti yang hilang (backward compatibility)
        setContent({
          hero: { ...DEFAULT_LANDING_CONTENT.hero, ...data.hero },
          about: { ...DEFAULT_LANDING_CONTENT.about, ...data.about },
          modules: { ...DEFAULT_LANDING_CONTENT.modules, ...data.modules },
          workflow: { ...DEFAULT_LANDING_CONTENT.workflow, ...data.workflow },
          cta: { ...DEFAULT_LANDING_CONTENT.cta, ...data.cta }
        });
      }
      if (mounted) setLoading(false);
    }).catch(err => {
      console.error('Gagal mengambil konfigurasi landing:', err);
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <LandingContentContext.Provider value={{ content, loading }}>
      {children}
    </LandingContentContext.Provider>
  );
}

export function useLandingContent() {
  return useContext(LandingContentContext);
}
