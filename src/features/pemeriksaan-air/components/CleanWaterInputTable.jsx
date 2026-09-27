import { Fragment } from 'react';
import { CLEAN_WATER_PARAMETERS } from '../waterHelpers';
import ParameterStatus from './ParameterStatus';

export default function CleanWaterInputTable({ rows, onResultChange }) {
  return <div>
    <div className="mb-3">
      <h4 className="text-sm font-black text-slate-700">Tabel Hasil Air Bersih</h4>
      <p className="mt-1 text-xs text-slate-500">Isi hasil Total coliform dan E. coli untuk setiap lokasi/bak. Status dihitung otomatis.</p>
    </div>
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-[900px] w-full text-left text-xs">
        <thead className="bg-slate-100 text-slate-600">
          <tr><th rowSpan="2" className="border-r border-slate-200 px-3 py-3">No.</th><th rowSpan="2" className="border-r border-slate-200 px-3 py-3">Lokasi / Bak</th>
            {CLEAN_WATER_PARAMETERS.map(parameter => <th key={parameter} colSpan="3" className="border-r border-slate-200 px-3 py-2 text-center">{parameter}</th>)}
          </tr>
          <tr>{CLEAN_WATER_PARAMETERS.flatMap(parameter => [<th key={`${parameter}-result`} className="px-3 py-2">Hasil</th>, <th key={`${parameter}-standard`} className="px-3 py-2">Baku mutu</th>, <th key={`${parameter}-status`} className="border-r border-slate-200 px-3 py-2">Status</th>])}</tr>
        </thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={row.locationId} className="border-t border-slate-200 bg-white">
          <td className="border-r border-slate-100 px-3 py-3 text-slate-500">{rowIndex + 1}</td>
          <td className="border-r border-slate-100 px-3 py-3 font-bold text-slate-800">{row.locationName}</td>
          {row.parameters.map((parameter, parameterIndex) => <Fragment key={parameter.standard_id || parameter.parameter}>
            <td className="px-2 py-2"><input value={parameter.result} onChange={event => onResultChange('clean', row.locationId, parameterIndex, event.target.value)} aria-label={`Hasil ${parameter.parameter} ${row.locationName}`} className="w-28 rounded-lg border border-slate-300 px-2 py-2 text-sm" placeholder="Hasil" /></td>
            <td className="whitespace-nowrap px-3 py-2 text-slate-500">{parameter.standard || '-'} {parameter.unit}</td>
            <td className="border-r border-slate-100 px-3 py-2"><ParameterStatus status={parameter.status} /></td>
          </Fragment>)}</tr>)}</tbody>
      </table>
    </div>
  </div>;
}
