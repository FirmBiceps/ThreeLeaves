import { COMPANY_HQ } from '../../data/company';

export function CompanyHeader() {
  return (
    <div className="mb-8 border-b border-slate-900 pb-6 text-center">
      <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-900">{COMPANY_HQ.name}</h1>
      <h2 className="mb-2 text-lg font-semibold text-slate-800">{COMPANY_HQ.chineseName}</h2>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">CO.REG NO.{COMPANY_HQ.regNo} | GST REG NO. {COMPANY_HQ.gstNo}</p>
      <p className="mb-1 text-xs font-medium text-slate-600">{COMPANY_HQ.address}</p>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{COMPANY_HQ.contact}</p>
    </div>
  );
}
