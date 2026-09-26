                              : '30 Days'}
                          </span>
                        </div>

                        <div className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-400">
                          {row.invoices.length} Invoices
                        </div>
                      </td>

                      <td
                        className="px-5 py-4 text-right text-[15px] font-semibold text-slate-950"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatDashboardMoney(row.totalBilled)}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        {row.invoices.length > 0 ? (
                          <div className="relative inline-flex items-center">
                            <select
                              value={row.monthStatus}
                              onChange={(e) =>
                                handleStatusChange(
                                  row.customer?.id,
                                  e.target.value
                                )
                              }
                              className={`cursor-pointer appearance-none rounded-lg py-1.5 pl-8 pr-8 text-[10px] font-black uppercase tracking-widest outline-none transition-all ${
                                row.monthStatus === 'Paid'
                                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                              }`}
                            >
                              <option value="Paid">PAID</option>
                              <option value="Unpaid">UNPAID</option>
                            </select>

                            <div className="pointer-events-none absolute left-2.5">
                              {row.monthStatus === 'Paid' ? (
                                <CheckCircle
                                  size={12}
                                  className="text-emerald-600"
                                />
                              ) : (
                                <AlertCircle
                                  size={12}
                                  className="text-amber-600"
                                />
                              )}
                            </div>

                            <div className="pointer-events-none absolute right-2.5">
                              <ChevronDown
                                size={12}
                                className={
                                  row.monthStatus === 'Paid'
                                    ? 'text-emerald-600'
                                    : 'text-amber-600'
                                }
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-medium italic text-slate-400">
                            No new invoices
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 pr-6 text-right">
                        <button
                          onClick={() => handlePrint(row.customer?.id)}
                          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-900 hover:text-white"
                        >
                          <Printer size={12} className="mr-1" />
                          Print
                        </button>
                      </td>
                    </tr>
                  ))}

                  {visibleAnalytics.displayList.length === 0 && (
                    <tr>
                      <td
                        className="p-12 text-center text-sm font-bold text-slate-400"
                        colSpan="4"
                      >
                        No transactions or outstanding balances found.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RENDER THE SECURE PRINT PORTAL OUTSIDE THE REACT ROOT */}
      {printTarget && createPortal(printContent, document.body)}
    </div>
  );
}
