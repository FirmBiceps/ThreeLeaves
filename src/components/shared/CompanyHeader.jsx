import { COMPANY_HQ } from '../../data/company';

export function CompanyHeader() {
  return (
    <div className="mb-10 border-b-2 border-slate-900 pb-8 text-center">
      <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900">
        {COMPANY_HQ.name}
      </h1>
      <h2 className="mb-2 text-xl font-bold">{COMPANY_HQ.chineseName}</h2>
      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        CO.REG NO.{COMPANY_HQ.regNo} | GST REG NO. {COMPANY_HQ.gstNo}
      </p>
      <p className="mb-1 text-xs font-bold text-slate-600">{COMPANY_HQ.address}</p>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
        {COMPANY_HQ.contact}
      </p>
    </div>
  );
}
