const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

export const normalizeGeminiModel = value => String(value || '')
  .trim()
  .replace(/^models\//, '');

const modelScore = model => {
  const name = normalizeGeminiModel(model).toLowerCase();
  if (name === DEFAULT_MODEL) return 0;
  if (name === 'gemini-2.5-flash') return 1;
  if (name.includes('flash-lite') && !name.includes('preview')) return 2;
  if (name.includes('flash') && !name.includes('preview')) return 3;
  if (name.includes('flash-lite')) return 4;
  if (name.includes('flash')) return 5;
  if (!name.includes('preview')) return 6;
  return 7;
};

export const selectGeminiModels = (models, configuredModel) => {
  const configured = normalizeGeminiModel(configuredModel || DEFAULT_MODEL);
  const available = (Array.isArray(models) ? models : [])
    .filter(model => model?.supportedGenerationMethods?.includes('generateContent'))
    .map(model => normalizeGeminiModel(model.name))
    .filter(Boolean)
    .sort((left, right) => modelScore(left) - modelScore(right) || left.localeCompare(right));

  return [...new Set([
    ...(available.includes(configured) ? [configured] : []),
    ...available,
  ])];
};

export const configuredGeminiModel = value => normalizeGeminiModel(value || DEFAULT_MODEL);
