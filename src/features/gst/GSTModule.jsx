          <div className="p-5">
            <GstQuarterReport
              report={report}
              monthlyReport={monthlyReport}
              salesRows={salesRows}
              purchaseRows={purchaseRows}
            />
          </div>
        )}

        {activeTab === 'purchases' && (
          <div className="space-y-5 p-5">
            {sys?.hasPerm?.('manage_gst') && (
              <PurchaseEntryTable
                suppliers={safeSuppliers}
                inventory={safeInventory}
                onPost={handleSavePurchase}
              />
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Posted Purchase GST</h3>
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    Saved supplier purchases for the selected quarter.
                  </p>
                </div>
                <div className="flex w-full max-w-lg items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-emerald-100">
                  <Search size={16} className="mr-2 text-slate-400" />
                  <input
                    value={purchaseSearch}
                    onChange={(event) => setPurchaseSearch(event.target.value)}
                    placeholder="Search supplier, category, invoice, or date..."
                    className="w-full bg-transparent text-sm font-medium outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-left">
                  <thead className="border-b bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="p-4 pl-6">Date</th>
                      <th className="p-4">Supplier / Purchase Details</th>
                      <th className="p-4">Category</th>
                      <th className="p-4 text-right">Value ex-GST</th>
                      <th className="p-4 text-right">Input GST</th>
                      <th className="p-4 text-right">Total</th>
                      <th className="p-4 pr-6 text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredPurchaseRows.map((record) => {
                      const amount = toMoneyNumber(record?.amount);
                      const gst = toMoneyNumber(record?.gst);
                      return (
                        <tr key={record.id} className="hover:bg-emerald-50/40">
                          <td className="p-4 pl-6 font-bold text-slate-500">{record.date || '-'}</td>
                          <td className="p-4 font-black text-slate-800">{record.desc || 'Supplier purchase'}</td>
                          <td className="p-4 font-bold text-slate-500">{record.category || 'Purchase'}</td>
                          <td className="p-4 text-right font-mono font-bold text-slate-600">${formatMoney(amount)}</td>
                          <td className="p-4 text-right font-mono font-black text-emerald-600">${formatMoney(gst)}</td>
                          <td className="p-4 text-right font-mono font-black text-slate-900">${formatMoney(amount + gst)}</td>
                          <td className="p-4 pr-6 text-center">
                            {sys?.hasPerm?.('manage_gst') ? (
                              <button
                                type="button"
                                onClick={() => handleDeletePurchaseRecord(record)}
                                className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={17} />
                              </button>
                            ) : (
                              <Info size={16} className="inline text-slate-300" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredPurchaseRows.length === 0 && (
                      <tr>
                        <td colSpan="7">
                          <EmptyState title="No purchase GST records" description="Enter a purchase in the spreadsheet above to capture input GST." />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-800">
        <div className="flex items-start gap-3">
          <Info size={19} className="mt-0.5 shrink-0 text-blue-600" />
          <div>
            <p className="font-black">Temporary database compatibility mode</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-blue-700">
              Purchase GST is stored in your existing <code>gst_records</code> table and stock is updated in <code>product_list</code>. Sales exclusions are browser-local until the Supabase adjustment table is added. Formal purchase invoices, line items, stock movements, and shared exclusions should be added in the next database migration.
            </p>
          </div>
        </div>
      </div>

      {exclusionInvoice && (
        <SalesExclusionModal
          invoice={exclusionInvoice}
          existing={salesExclusions[String(exclusionInvoice?.id || exclusionInvoice?.number || '')]}
          onClose={() => setExclusionInvoice(null)}
          onSave={(details) => handleExcludeInvoice(exclusionInvoice, details)}
        />
      )}

      {notification && (
        <div className={`fixed bottom-8 left-1/2 z-[8000] flex -translate-x-1/2 items-center rounded-xl px-6 py-3 text-sm font-bold text-white shadow-2xl ${
          notification.type === 'error'
            ? 'bg-red-600'
            : notification.type === 'warning'
              ? 'bg-amber-600'
              : 'bg-emerald-600'
        }`}>
          {notification.type === 'error' ? <AlertCircle size={18} className="mr-2" /> : <CheckCircle2 size={18} className="mr-2" />}
          {notification.message}
        </div>
      )}
