import { Fragment } from 'react';
import ParameterStatus from './ParameterStatus';

export default function WastewaterInputTable({ rows, onResultChange }) {
  return <div>
    <div className="mb-3"><h4 className="text-sm font-black text-slate-700">Tabel Hasil Air Limbah</h4><p className="mt-1 text-xs text-slate-500">Isi hasil untuk Inlet dan Outlet. Baku mutu dan status dihitung dari pengaturan admin.</p></div>
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-[900px] w-full text-left text-xs">
        <thead className="bg-slate-100 text-slate-600">
          <tr><th rowSpan="2" className="border-r border-slate-200 px-3 py-3">No.</th><th rowSpan="2" className="border-r border-slate-200 px-3 py-3">Parameter</th><th rowSpan="2" className="border-r border-slate-200 px-3 py-3">Satuan</th><th rowSpan="2" className="border-r border-slate-200 px-3 py-3">Baku Mutu</th>{rows.map(row => <th key={row.samplePoint} colSpan="2" className="border-r border-slate-200 px-3 py-2 text-center">{row.samplePoint}</th>)}</tr>
          <tr>{rows.flatMap(row => [<th key={`${row.samplePoint}-result`} className="px-3 py-2">Hasil</th>, <th key={`${row.samplePoint}-status`} className="border-r border-slate-200 px-3 py-2">Status</th>])}</tr>
        </thead>
        <tbody>{(rows[0]?.parameters || []).map((parameter, parameterIndex) => <tr key={parameter.standard_id || parameter.parameter} className="border-t border-slate-200 bg-white">
          <td className="border-r border-slate-100 px-3 py-3 text-slate-500">{parameterIndex + 1}</td><td className="border-r border-slate-100 px-3 py-3 font-bold text-slate-800">{parameter.parameter}</td><td className="border-r border-slate-100 px-3 py-3 text-slate-500">{parameter.unit || '-'}</td><td className="border-r border-slate-100 px-3 py-3 text-slate-500">{parameter.standard || '-'}</td>
          {rows.map(row => { const pointParameter = row.parameters[parameterIndex]; return <Fragment key={`${row.samplePoint}-${pointParameter.standard_id || pointParameter.parameter}`}><td className="px-2 py-2"><input value={pointParameter.result} onChange={event => onResultChange('wastewater', row.samplePoint, parameterIndex, event.target.value)} aria-label={`Hasil ${pointParameter.parameter} ${row.samplePoint}`} className="w-28 rounded-lg border border-slate-300 px-2 py-2 text-sm" placeholder="Hasil" /></td><td className="border-r border-slate-100 px-3 py-2"><ParameterStatus status={pointParameter.status} /></td></Fragment>; })}
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}
