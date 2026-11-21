import {
  CLEAN_WATER_PARAMETERS,
  createCleanWaterParameters,
  parameterFromStandard,
  todayInMakassar,
} from '../waterHelpers';

export const currentWaterMonth = () => todayInMakassar().slice(0, 7);

export const createWaterForm = (waterType = 'clean') => ({
  id: null,
  water_type: waterType,
  clean_water_location_id: '',
  sample_point: 'Inlet',
  sampled_at: todayInMakassar(),
  resulted_at: '',
  laboratory: '',
  report_number: '',
  notes: '',
  parameters: waterType === 'clean' ? createCleanWaterParameters() : [],
});

export const standardsForType = (standards, waterType) => (
  standards.filter(item => item.water_type === waterType)
);

export const createParametersFromStandards = (standards, waterType) => {
  const available = standardsForType(standards, waterType);
  if (waterType === 'wastewater') return available.map(standard => parameterFromStandard(standard));
  return CLEAN_WATER_PARAMETERS.map(name => {
    const standard = available.find(item => item.parameter === name);
    return standard
      ? parameterFromStandard(standard)
      : createCleanWaterParameters().find(item => item.parameter === name);
  });
};

export const summarizeWaterRecords = records => ({
  all: records.length,
  clean: records.filter(item => item.water_type === 'clean').length,
  wastewater: records.filter(item => item.water_type === 'wastewater').length,
  failed: records.filter(item => item.parameters?.some(parameter => parameter.status === 'tidak_memenuhi')).length,
});
