import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  CheckCircle2,
  Eye,
  FileText,
  History,
  Layers,
  MessageSquare,
  RefreshCcw,
  Save,
  ScanBarcode,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { CompanyHeader } from '../../components/shared/CompanyHeader';
import { UNIT_OPTIONS } from '../../data/company';
import { formatMoney } from '../../utils/format';
import { getTodayString } from '../../utils/date';
import { supabase } from '../../lib/supabaseClient';
import { InvoicePreview } from './InvoicePreview';

const DEFAULT_UNIT = '箱';
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled', 'void', 'voided']);

function getProductName(item) {
  return String(item?.Name || item?.name || item?.Items || item?.productName || '');
}

function getProductSku(item) {
  return String(item?.SKU || item?.sku || '');
}

function getItemUnit(item) {
  return String(item?.unit || item?.Unit || DEFAULT_UNIT);
}

function getCustomerName(customer) {
  return String(customer?.name || customer?.companyName || customer?.company_name || '');
}

function getCustomerAddress(customer) {
  return String(
    customer?.address ||
      customer?.deliveryAddress ||
      customer?.delivery_address ||
      customer?.shippingAddress ||
      customer?.shipping_address ||
      ''
  );
}

function getCustomerPhone(customer) {
  return String(customer?.phone || customer?.mobile || customer?.contact_number || '');
}

function getCustomerCode(customer) {
  return String(customer?.uen || customer?.UEN || customer?.customer_code || customer?.code || '');
}

function isUsableInvoiceHistoryRecord(invoice) {
  const status = String(invoice?.status || '').trim().toLowerCase();
  return !CANCELLED_STATUSES.has(status);
}

function getInvoiceTimestamp(invoice) {
  const value = new Date(String(invoice?.date || ''));
  return Number.isNaN(value.getTime()) ? 0 : value.getTime();
}

function formatShortDate(value) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('en-SG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function normalisePhrase(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Extract a likely order quantity without treating packaging measurements
 * such as "500g", "3kg" or "400g x 20" as the order quantity.
 */
function extractOrderQuantity(line) {
  const original = String(line || '').trim();
  if (!original) return { qty: 1, searchText: '' };

  const explicitEndPatterns = [
    /(?:^|\s)(?:qty|quantity)\s*[:x-]?\s*(\d+(?:\.\d+)?)\s*$/i,
    /(\d+(?:\.\d+)?)\s*(箱|包|袋|瓶|桶|罐|板|个|盒|条|支|pcs?|pieces?|ctns?|cartons?|bags?|packs?|packets?|bottles?|tins?|boxes?)\s*$/i,
  ];

  for (const pattern of explicitEndPatterns) {
    const match = original.match(pattern);
    if (match) {
      const qty = Number(match[1]);
      const searchText = original.slice(0, match.index).trim();
      return {
        qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        searchText: searchText || original,
      };
    }
  }

  // A leading x quantity is safe to interpret because it cannot be confused
  // with a packaging expression later in the product name, e.g.
  // "x2 番薯粉 500g x 20".
  const leadingXMatch = original.match(/^\s*[x×]\s*(\d+(?:\.\d+)?)\s+(?=\S)/i);
  if (leadingXMatch) {
    const qty = Number(leadingXMatch[1]);
    const searchText = original.slice(leadingXMatch[0].length).trim();
    return {
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      searchText: searchText || original,
    };
  }

  // A leading standalone number is also commonly used as quantity:
  // "2 番薯粉 500g x 20". The required whitespace prevents "500g" from
  // being interpreted as 500 units.
  const leadingMatch = original.match(/^\s*(\d+(?:\.\d+)?)\s+(?=\S)/);
  if (leadingMatch) {
    const qty = Number(leadingMatch[1]);
    const searchText = original.slice(leadingMatch[0].length).trim();
    return {
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      searchText: searchText || original,
    };
  }

  return { qty: 1, searchText: original };
}

function ProductSearchSelect({ value, inventory, onChange, isAutoFilled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const safeInventory = Array.isArray(inventory) ? inventory : [];
  const selectedProduct = safeInventory.find(
    (entry) => String(entry?.id || '') === String(value || '')
  );

  const getDisplayName = (item) => {
    if (!item) return '';
    const name = getProductName(item) || 'Unnamed Product';
    const sku = getProductSku(item);
    return sku ? `[${sku}] ${name}` : name;
  };

  const displayName = getDisplayName(selectedProduct);
  const searchLower = String(searchTerm).trim().toLowerCase();

  const filteredInventory = safeInventory.filter((item) => {
    if (!item) return false;
    if (!searchLower) return true;

    const searchable = [
      getProductName(item),
      getProductSku(item),
      item?.Description,
      item?.description,
      item?.Packing,
      item?.packaging,
      item?.Supplier,
      item?.supplier,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchable.includes(searchLower);
  });

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setSearchTerm('');
          }}
          className={`w-full rounded-lg border border-transparent px-2 py-1.5 text-left text-sm font-bold leading-5 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-100 ${
            displayName
              ? isAutoFilled
                ? 'text-indigo-600'
                : 'text-slate-900'
              : 'text-slate-400'
          }`}
        >
          {displayName || '- Search Product or SKU -'}
        </button>
      ) : (
        <div className="absolute left-0 top-0 z-[5000] w-[420px] max-w-[70vw] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center border-b border-slate-200 bg-slate-50 p-2">
            <Search size={14} className="ml-1 mr-2 shrink-0 text-slate-400" />
            <input
              autoFocus
              type="text"
              className="w-full border-none bg-transparent p-1.5 text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
              placeholder="Name, SKU, description, packing..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredInventory.length > 0 ? (
              filteredInventory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-blue-50"
                  onClick={() => {
                    onChange(item.id);
                    setIsOpen(false);
                  }}
                >
                  <p className="text-sm font-bold leading-5 text-slate-800">{getDisplayName(item)}</p>
                  {(item?.Description || item?.description || item?.Packing || item?.packaging) && (
                    <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-400">
                      {[item?.Description || item?.description, item?.Packing || item?.packaging]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  )}
                </button>
              ))
            ) : (
              <div className="p-3 text-center text-xs font-medium text-slate-400">
                No products found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerSearchSelect({ value, customers, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const safeCustomers = Array.isArray(customers) ? customers : [];
  const selectedCustomer = safeCustomers.find(
    (customer) => String(customer?.id || '') === String(value || '')
  );
  const displayName = selectedCustomer ? getCustomerName(selectedCustomer) : '';
  const searchLower = String(searchTerm).trim().toLowerCase();

  const filteredCustomers = safeCustomers.filter((customer) => {
    if (!customer) return false;
    if (!searchLower) return true;

    const searchable = [
      getCustomerName(customer),
      getCustomerAddress(customer),
      getCustomerPhone(customer),
      getCustomerCode(customer),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchable.includes(searchLower);
  });

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      {!isOpen ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setIsOpen(true);
            setSearchTerm('');
          }}
          className={`mt-1 w-full border border-transparent bg-transparent p-0 text-left text-lg font-black leading-6 transition-colors focus:outline-none ${
            displayName ? 'text-slate-900' : 'text-slate-400'
          } ${
            disabled
              ? 'cursor-not-allowed opacity-70'
              : 'cursor-pointer hover:text-blue-600'
          }`}
        >
          {displayName || 'Select Entity...'}
        </button>
      ) : (
        <div className="absolute left-0 top-8 z-[5000] w-[390px] max-w-[80vw] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center border-b border-slate-200 bg-slate-50 p-3">
            <Search size={16} className="ml-1 mr-2 shrink-0 text-slate-400" />
            <input
              autoFocus
              type="text"
              className="w-full border-none bg-transparent p-1 text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
              placeholder="Name, address, phone or customer code..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => {
                const name = getCustomerName(customer) || 'Unnamed customer';
                const address = getCustomerAddress(customer);
                const phone = getCustomerPhone(customer);

                return (
                  <button
                    key={customer.id}
                    type="button"
                    className="w-full border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-blue-50"
                    onClick={() => {
                      onChange(customer.id);
                      setIsOpen(false);
                    }}
                  >
                    <p className="text-sm font-bold text-slate-800">{name}</p>
                    {(address || phone) && (
                      <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-4 text-slate-400">
                        {[address, phone].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-sm font-medium text-slate-400">
                No customers found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function InvoiceGenerator({
  sys,
  groups,
  setGroups,
  existingInvoice = null,
  onClose,
}) {
  const todayString = getTodayString();

  const [invoiceDate, setInvoiceDate] = useState(
    existingInvoice ? String(existingInvoice.date || '') : todayString
  );
  const [customerId, setCustomerId] = useState(existingInvoice?.customerId || '');
  const [isAutofillEnabled, setIsAutofillEnabled] = useState(false);
  const [invoiceStatus] = useState(existingInvoice?.status || 'Unpaid');
  const [isSpecialFormat, setIsSpecialFormat] = useState(
    existingInvoice?.isSpecialFormat || false
  );
  const [poNumber, setPoNumber] = useState(existingInvoice?.poNumber || '');
  const [carPlateNo, setCarPlateNo] = useState(existingInvoice?.carPlateNo || '');
  const [invoiceRemarks, setInvoiceRemarks] = useState(existingInvoice?.remarks || '');
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseText, setParseText] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [autoFillNotif, setAutoFillNotif] = useState(false);
  const [priceModal, setPriceModal] = useState(null);
  const [pendingCustomerChange, setPendingCustomerChange] = useState(null);
  const [priceRefreshNotice, setPriceRefreshNotice] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedHistoryKeys, setSelectedHistoryKeys] = useState([]);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [invoiceNumberManuallyEdited, setInvoiceNumberManuallyEdited] = useState(false);

  const rowRefs = useRef({});
  const saveLockRef = useRef(false);

  const safeInventory = useMemo(
    () => (Array.isArray(sys?.inventory) ? sys.inventory : []),
    [sys?.inventory]
  );
  const safeCustomers = useMemo(
    () => (Array.isArray(sys?.customers) ? sys.customers : []),
    [sys?.customers]
  );
  const safeInvoices = useMemo(
    () => (Array.isArray(sys?.invoices) ? sys.invoices : []),
    [sys?.invoices]
  );
  const safeGroups = useMemo(
    () => (Array.isArray(groups) ? groups : []),
    [groups]
  );

  const [items, setItems] = useState(() => {
    if (existingInvoice && Array.isArray(existingInvoice.items)) {
      return JSON.parse(
        JSON.stringify(
          existingInvoice.items.filter(Boolean).map((item) => ({
            ...item,
            manualPriceOverride: false,
          }))
        )
      );
    }
    return [];
  });

  const [paymentTerms, setPaymentTerms] = useState(
    existingInvoice?.paymentTerms || '30_days'
  );

  const customer = safeCustomers.find(
    (entry) => String(entry?.id || '') === String(customerId || '')
  );

  const assignedCustomerGroup = customer?.pricing_group_id
    ? safeGroups.find(
        (group) => String(group?.id || '') === String(customer.pricing_group_id)
      )
    : null;

  const resolvePriceInfo = useCallback(
    (product, unit = DEFAULT_UNIT, targetCustomer = customer) => {
      if (!product) {
        return { price: 0, source: 'missing', label: 'No product' };
      }

      const resolvedUnit = String(unit || DEFAULT_UNIT);
      const ruleKey = `${product.id}|${resolvedUnit}`;

      if (
        targetCustomer?.custom_prices &&
        typeof targetCustomer.custom_prices === 'object' &&
        targetCustomer.custom_prices[ruleKey] !== undefined
      ) {
        return {
          price: Number(targetCustomer.custom_prices[ruleKey]) || 0,
          source: 'customer',
          label: 'Customer price',
        };
      }

      if (targetCustomer?.pricing_group_id) {
        const group = safeGroups.find(
          (entry) =>
            String(entry?.id || '') === String(targetCustomer.pricing_group_id)
        );

        if (
          group?.prices &&
          typeof group.prices === 'object' &&
          group.prices[ruleKey] !== undefined
        ) {
          return {
            price: Number(group.prices[ruleKey]) || 0,
            source: 'group',
            label: `${group.name || 'Group'} price`,
          };
        }
      }

      const price =
        product.Price || product.unitPrice || product['Unit Price (SG)'] || 0;

      return {
        price: Number(price) || 0,
        source: 'global',
        label: 'Default price',
      };
    },
    [customer, safeGroups]
  );

  const getSafePrice = useCallback(
    (product, unit = DEFAULT_UNIT, targetCustomer = customer) =>
      resolvePriceInfo(product, unit, targetCustomer).price,
    [customer, resolvePriceInfo]
  );

  // AUTO-SYNC PAYMENT TERMS: preserve the existing behaviour, but only when
  // creating a new invoice.
  useEffect(() => {
    if (customerId && !existingInvoice) {
      const selectedCust = safeCustomers.find(
        (entry) => String(entry?.id || '') === String(customerId)
      );

      if (selectedCust?.payment_terms) {
        setPaymentTerms(selectedCust.payment_terms);
      } else {
        setPaymentTerms('30_days');
      }
    }
  }, [customerId, safeCustomers, existingInvoice]);

  const autoInvoiceNumber = useMemo(() => {
    if (existingInvoice) return String(existingInvoice.number || '');

    const dateMatch = String(invoiceDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) return '';

    const yy = dateMatch[1].slice(-2);
    const mm = dateMatch[2];
    const prefix = `${yy}${mm}`;

    const monthlyInvoices = safeInvoices.filter((invoice) =>
      String(invoice?.number || '').startsWith(prefix)
    );
    let maxSequence = 0;

    monthlyInvoices.forEach((invoice) => {
      const seqStr = String(invoice?.number || '').slice(4);
      const seqNum = parseInt(seqStr, 10);
      if (!Number.isNaN(seqNum) && seqNum > maxSequence) {
        maxSequence = seqNum;
      }
    });

    return `${prefix}${String(maxSequence + 1).padStart(3, '0')}`;
  }, [safeInvoices, existingInvoice, invoiceDate]);

  const [invoiceNumber, setInvoiceNumber] = useState(autoInvoiceNumber);

  useEffect(() => {
    if (existingInvoice || !invoiceNumberManuallyEdited) {
      setInvoiceNumber(autoInvoiceNumber);
    }
  }, [autoInvoiceNumber, existingInvoice, invoiceNumberManuallyEdited]);

  const isDuplicateNumber = useMemo(() => {
    return safeInvoices.some(
      (invoice) =>
        String(invoice?.number || '') === String(invoiceNumber) &&
        invoice?.id !== (existingInvoice ? existingInvoice.id : null)
    );
  }, [invoiceNumber, safeInvoices, existingInvoice]);

  const cleanDraftItems = useMemo(
    () => (Array.isArray(items) ? items.filter(Boolean) : []),
    [items]
  );

  const subtotal = cleanDraftItems.reduce(
    (sum, item) =>
      sum +
      (Number(item?.qty || item?.quantity) || 0) *
        (Number(item?.unitPrice) || 0),
    0
  );
  const gst = subtotal * 0.09;
  const total = subtotal + gst;

  const customerInvoiceHistory = useMemo(() => {
    if (!customerId) return [];

    return safeInvoices
      .filter(
        (invoice) =>
          String(invoice?.customerId ?? invoice?.customer_id ?? '') ===
            String(customerId) && isUsableInvoiceHistoryRecord(invoice)
      )
      .sort((a, b) => getInvoiceTimestamp(b) - getInvoiceTimestamp(a));
  }, [customerId, safeInvoices]);

  const duplicateRowMap = useMemo(() => {
    const map = new Map();

    cleanDraftItems.forEach((item, index) => {
      if (!item?.itemId) return;
      const key = `${item.itemId}|${getItemUnit(item)}`;
      const indexes = map.get(key) || [];
      indexes.push(index);
      map.set(key, indexes);
    });

    return map;
  }, [cleanDraftItems]);

  const invoiceIssues = useMemo(() => {
    const errors = [];
    const warnings = [];

    if (!customerId) {
      errors.push({ message: 'Select a customer before previewing the invoice.' });
    }

    if (!invoiceDate) {
      errors.push({ message: 'Invoice date is required.' });
    }

    if (!String(invoiceNumber || '').trim()) {
      errors.push({ message: 'Invoice number is required.' });
    }

    if (isDuplicateNumber) {
      errors.push({ message: 'The invoice number already exists.' });
    }

    if (cleanDraftItems.length === 0) {
      errors.push({ message: 'Add at least one invoice item.' });
    }

    cleanDraftItems.forEach((item, index) => {
      const rowNumber = index + 1;
      const qty = Number(item?.qty || item?.quantity || 0);
      const unitPrice = Number(item?.unitPrice);

      if (!item?.itemId) {
        errors.push({
          rowIndex: index,
          message: `Row ${rowNumber} does not have a confirmed product.`,
        });
      }

      if (!Number.isFinite(qty) || qty <= 0) {
        errors.push({
          rowIndex: index,
          message: `Row ${rowNumber} must have a quantity greater than 0.`,
        });
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        errors.push({
          rowIndex: index,
          message: `Row ${rowNumber} has an invalid unit price.`,
        });
      } else if (unitPrice === 0 && item?.itemId) {
        warnings.push({
          rowIndex: index,
          message: `Row ${rowNumber} has a $0.00 unit price. Confirm this is intentional.`,
        });
      }
    });

    duplicateRowMap.forEach((indexes) => {
      if (indexes.length > 1) {
        warnings.push({
          rowIndex: indexes[1],
          message: `Rows ${indexes.map((index) => index + 1).join(', ')} contain the same product and unit.`,
        });
      }
    });

    if (isSpecialFormat && !String(poNumber || '').trim()) {
      warnings.push({ message: 'Special format is enabled but PO Number is blank.' });
    }

    if (isSpecialFormat && !String(carPlateNo || '').trim()) {
      warnings.push({ message: 'Special format is enabled but Car Plate No. is blank.' });
    }

    return { errors, warnings };
  }, [
    carPlateNo,
    cleanDraftItems,
    customerId,
    duplicateRowMap,
    invoiceDate,
    invoiceNumber,
    isDuplicateNumber,
    isSpecialFormat,
    poNumber,
  ]);

  const hasUnsavedChanges = useMemo(() => {
    if (!existingInvoice) {
      return Boolean(
        customerId ||
          cleanDraftItems.length > 0 ||
          invoiceRemarks ||
          isSpecialFormat ||
          poNumber ||
          carPlateNo ||
          invoiceDate !== todayString ||
          (invoiceNumberManuallyEdited && invoiceNumber !== autoInvoiceNumber)
      );
    }

    const currentComparable = {
      date: String(invoiceDate || ''),
      customerId: String(customerId || ''),
      paymentTerms: String(paymentTerms || ''),
      isSpecialFormat: Boolean(isSpecialFormat),
      poNumber: String(poNumber || ''),
      carPlateNo: String(carPlateNo || ''),
      remarks: String(invoiceRemarks || ''),
      number: String(invoiceNumber || ''),
      items: cleanDraftItems.map((item) => ({
        itemId: item?.itemId || '',
        name: item?.name || '',
        unit: getItemUnit(item),
        qty: Number(item?.qty || item?.quantity || 0),
        unitPrice: Number(item?.unitPrice || 0),
        picked: Boolean(item?.picked),
      })),
    };

    const originalComparable = {
      date: String(existingInvoice?.date || ''),
      customerId: String(existingInvoice?.customerId || ''),
      paymentTerms: String(existingInvoice?.paymentTerms || '30_days'),
      isSpecialFormat: Boolean(existingInvoice?.isSpecialFormat),
      poNumber: String(existingInvoice?.poNumber || ''),
      carPlateNo: String(existingInvoice?.carPlateNo || ''),
      remarks: String(existingInvoice?.remarks || ''),
      number: String(existingInvoice?.number || ''),
      items: (Array.isArray(existingInvoice?.items)
        ? existingInvoice.items.filter(Boolean)
        : []
      ).map((item) => ({
        itemId: item?.itemId || '',
        name: item?.name || '',
        unit: getItemUnit(item),
        qty: Number(item?.qty || item?.quantity || 0),
        unitPrice: Number(item?.unitPrice || 0),
        picked: Boolean(item?.picked),
      })),
    };

    return JSON.stringify(currentComparable) !== JSON.stringify(originalComparable);
  }, [
    autoInvoiceNumber,
    carPlateNo,
    cleanDraftItems,
    customerId,
    existingInvoice,
    invoiceDate,
    invoiceNumber,
    invoiceNumberManuallyEdited,
    invoiceRemarks,
    isSpecialFormat,
    paymentTerms,
    poNumber,
    todayString,
  ]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const requestClose = () => {
    if (hasUnsavedChanges) {
      setIsDiscardConfirmOpen(true);
      return;
    }
    onClose();
  };

  const requestCustomerChange = (nextCustomerId) => {
    if (existingInvoice) return;

    const nextId = String(nextCustomerId || '');
    if (nextId === String(customerId || '')) return;

    const hasExistingProductRows = cleanDraftItems.some((item) => item?.itemId);

    if (hasExistingProductRows) {
      setPendingCustomerChange({
        fromId: customerId,
        toId: nextId,
      });
      return;
    }

    setCustomerId(nextId);
  };

  const applyCustomerChange = (refreshPrices) => {
    if (!pendingCustomerChange) return;

    const nextCustomer = safeCustomers.find(
      (entry) =>
        String(entry?.id || '') === String(pendingCustomerChange.toId || '')
    );

    let refreshedCount = 0;
    let preservedManualCount = 0;

    const manualRows = cleanDraftItems.filter((item) => item && !item.isAutoFilled);
    const nextItems = refreshPrices
      ? manualRows.map((item) => {
          if (!item?.itemId) return item;

          if (item.manualPriceOverride) {
            preservedManualCount += 1;
            return item;
          }

          const product = safeInventory.find(
            (entry) => String(entry?.id || '') === String(item.itemId)
          );
          if (!product) return item;

          refreshedCount += 1;
          return {
            ...item,
            unitPrice: getSafePrice(product, getItemUnit(item), nextCustomer),
            manualPriceOverride: false,
          };
        })
      : manualRows;

    setItems(nextItems);
    setCustomerId(pendingCustomerChange.toId);
    setPendingCustomerChange(null);

    setPriceRefreshNotice(
      refreshPrices
        ? `${refreshedCount} price${refreshedCount === 1 ? '' : 's'} refreshed for ${
            getCustomerName(nextCustomer) || 'the selected customer'
          }${
            preservedManualCount > 0
              ? `; ${preservedManualCount} invoice-only price${
                  preservedManualCount === 1 ? '' : 's'
                } kept.`
              : '.'
          }`
        : `Customer changed to ${
            getCustomerName(nextCustomer) || 'the selected customer'
          }. Existing manual rows kept their current prices.`
    );
  };

  useEffect(() => {
    if (!priceRefreshNotice) return undefined;
    const timer = window.setTimeout(() => setPriceRefreshNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [priceRefreshNotice]);

  // AUTO-PREDICT: preserve manual rows at all times. Only rows added by
  // Auto-Predict are replaced when the customer or prediction state changes.
  useEffect(() => {
    if (existingInvoice) return;

    if (!customerId || !isAutofillEnabled) {
      setItems((currentItems) =>
        (Array.isArray(currentItems) ? currentItems : []).filter(
          (item) => item && !item.isAutoFilled
        )
      );
      setAutoFillNotif(false);
      return;
    }

    const history = customerInvoiceHistory;

    if (history.length === 0) {
      setItems((currentItems) =>
        (Array.isArray(currentItems) ? currentItems : []).filter(
          (item) => item && !item.isAutoFilled
        )
      );
      setAutoFillNotif(false);
      return;
    }

    const itemStats = {};

    history.forEach((invoice) => {
      const perInvoice = new Map();

      (Array.isArray(invoice?.items) ? invoice.items.filter(Boolean) : []).forEach(
        (item) => {
          const itemId = item?.itemId;
          if (!itemId) return;

          const unit = getItemUnit(item);
          const key = `${itemId}|${unit}`;
          const currentQty = perInvoice.get(key) || 0;
          perInvoice.set(key, currentQty + (Number(item?.qty || item?.quantity) || 0));
        }
      );

      perInvoice.forEach((invoiceQty, key) => {
        const separatorIndex = key.indexOf('|');
        const itemId = key.slice(0, separatorIndex);
        const unit = key.slice(separatorIndex + 1);

        if (!itemStats[key]) {
          itemStats[key] = {
            itemId,
            unit,
            invoiceCount: 0,
            totalQty: 0,
          };
        }

        itemStats[key].invoiceCount += 1;
        itemStats[key].totalQty += invoiceQty;
      });
    });

    setItems((currentItems) => {
      const manualRows = (Array.isArray(currentItems) ? currentItems : []).filter(
        (item) => item && !item.isAutoFilled
      );
      const manualKeys = new Set(
        manualRows
          .filter((item) => item?.itemId)
          .map((item) => `${item.itemId}|${getItemUnit(item)}`)
      );

      const autoFilled = [];

      Object.entries(itemStats).forEach(([key, stats]) => {
        if (stats.invoiceCount / history.length < 0.9 || manualKeys.has(key)) {
          return;
        }

        const product = safeInventory.find(
          (entry) => String(entry?.id || '') === String(stats.itemId)
        );
        if (!product) return;

        autoFilled.push({
          itemId: stats.itemId,
          name: getProductName(product),
          unit: stats.unit || getItemUnit(product),
          qty: Math.max(1, Math.round(stats.totalQty / stats.invoiceCount)),
          unitPrice: getSafePrice(product, stats.unit || getItemUnit(product)),
          picked: false,
          isAutoFilled: true,
          suggestions: [],
          manualPriceOverride: false,
        });
      });

      if (autoFilled.length > 0) {
        setAutoFillNotif(true);
        return [...manualRows, ...autoFilled];
      }

      setAutoFillNotif(false);
      return manualRows;
    });
  }, [
    customerId,
    customerInvoiceHistory,
    existingInvoice,
    getSafePrice,
    isAutofillEnabled,
    safeInventory,
  ]);

  useEffect(() => {
    if (!autoFillNotif) return undefined;
    const timer = window.setTimeout(() => setAutoFillNotif(false), 4000);
    return () => window.clearTimeout(timer);
  }, [autoFillNotif]);

  const suggestions = useMemo(() => {
    if (!customerId || customerInvoiceHistory.length === 0) return [];

    const counts = {};

    customerInvoiceHistory.forEach((invoice) => {
      const invoiceKeys = new Set();

      (Array.isArray(invoice?.items) ? invoice.items.filter(Boolean) : []).forEach(
        (item) => {
          if (!item?.itemId) return;
          invoiceKeys.add(`${item.itemId}|${getItemUnit(item)}`);
        }
      );

      invoiceKeys.forEach((key) => {
        counts[key] = (counts[key] || 0) + 1;
      });
    });

    const existingKeys = new Set(
      cleanDraftItems
        .filter((item) => item?.itemId)
        .map((item) => `${item.itemId}|${getItemUnit(item)}`)
    );

    return Object.entries(counts)
      .filter(([, count]) => {
        const confidence = count / customerInvoiceHistory.length;
        return confidence >= 0.3 && confidence < 0.9;
      })
      .map(([key]) => {
        const separatorIndex = key.indexOf('|');
        const itemId = key.slice(0, separatorIndex);
        const unit = key.slice(separatorIndex + 1);
        const product = safeInventory.find(
          (entry) => String(entry?.id || '') === String(itemId)
        );
        return product ? { product, unit, key } : null;
      })
      .filter((entry) => entry && !existingKeys.has(entry.key));
  }, [
    cleanDraftItems,
    customerId,
    customerInvoiceHistory,
    safeInventory,
  ]);

  const persistLearnedPhrase = useCallback(
    async (product, phrase, delta) => {
      if (!product || !phrase || !delta) return;

      const normalised = normalisePhrase(phrase);
      if (!normalised) return;

      const currentMap =
        product.learned_phrases && typeof product.learned_phrases === 'object'
          ? { ...product.learned_phrases }
          : {};
      const nextValue = Math.max(0, (Number(currentMap[normalised]) || 0) + delta);

      if (nextValue === 0) delete currentMap[normalised];
      else currentMap[normalised] = nextValue;

      try {
        const productId = String(product?.id || '');
        const isUUID = productId.length === 36 && productId.includes('-');
        let error;

        if (isUUID) {
          ({ error } = await supabase
            .from('product_list')
            .update({ learned_phrases: currentMap })
            .eq('id', productId));
        } else {
          ({ error } = await supabase
            .from('product_list')
            .update({ learned_phrases: currentMap })
            .eq('Name', getProductName(product)));
        }

        if (error) throw error;

        if (typeof sys?.setInventory === 'function') {
          sys.setInventory(
            safeInventory.map((entry) =>
              String(entry?.id || '') === String(product?.id || '')
                ? { ...entry, learned_phrases: currentMap }
                : entry
            )
          );
        }
      } catch (error) {
        // Learning is deliberately non-blocking. A failure here should never
        // prevent invoice entry or saving.
        console.warn('Unable to update learned product phrase:', error);
      }
    },
    [safeInventory, sys]
  );

  const learnFromCorrection = useCallback(
    (rawPhrase, selectedId, previousPredictedId) => {
      const phrase = normalisePhrase(rawPhrase);
      if (!phrase || !selectedId) return;

      const selectedProduct = safeInventory.find(
        (entry) => String(entry?.id || '') === String(selectedId)
      );
      const previousProduct = previousPredictedId
        ? safeInventory.find(
            (entry) => String(entry?.id || '') === String(previousPredictedId)
          )
        : null;

      if (
        previousProduct &&
        String(previousProduct.id) !== String(selectedProduct?.id || '')
      ) {
        void persistLearnedPhrase(previousProduct, phrase, -1);
      }

      if (selectedProduct) {
        void persistLearnedPhrase(selectedProduct, phrase, 1);
      }
    },
    [persistLearnedPhrase, safeInventory]
  );

  const handleSmartExtract = () => {
    const lines = String(parseText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const nextDraftItems = [...cleanDraftItems];

    lines.forEach((line) => {
      const { qty, searchText } = extractOrderQuantity(line);
      const searchString = normalisePhrase(searchText);
      if (!searchString) return;

      const scoredItems = safeInventory
        .map((inventoryItem) => {
          if (!inventoryItem) return { item: null, score: 0 };

          const itemName = getProductName(inventoryItem).toLowerCase();
          const itemSku = getProductSku(inventoryItem).toLowerCase();
          const itemDescription = String(
            inventoryItem?.Description || inventoryItem?.description || ''
          ).toLowerCase();
          let score = 0;

          if (itemName === searchString || itemSku === searchString) {
            score += 50;
          } else if (
            itemName.includes(searchString) ||
            searchString.includes(itemName) ||
            (itemSku && searchString.includes(itemSku))
          ) {
            score += 10;
          } else if (itemDescription && itemDescription.includes(searchString)) {
            score += 6;
          } else {
            const searchChars = new Set(searchString.replace(/\s/g, '').split(''));
            if (searchChars.size > 0) {
              let matchCount = 0;
              searchChars.forEach((character) => {
                if (itemName.includes(character)) matchCount += 1;
              });
              if (matchCount / searchChars.size >= 0.5) {
                score += (matchCount / searchChars.size) * 5;
              }
            }
          }

          if (
            inventoryItem.learned_phrases &&
            typeof inventoryItem.learned_phrases === 'object' &&
            inventoryItem.learned_phrases[searchString]
          ) {
            score +=
              (Number(inventoryItem.learned_phrases[searchString]) || 0) * 20;
          }

          return { item: inventoryItem, score };
        })
        .filter((entry) => entry.item !== null)
        .sort((a, b) => b.score - a.score);

      const bestMatch = scoredItems[0];

      if (bestMatch && bestMatch.score >= 10) {
        const determinedUnit = getItemUnit(bestMatch.item);
        nextDraftItems.push({
          itemId: bestMatch.item.id,
          name: getProductName(bestMatch.item),
          unit: determinedUnit,
          qty,
          unitPrice: getSafePrice(bestMatch.item, determinedUnit),
          picked: false,
          rawSearchString: searchString,
          originalPredictedId: bestMatch.item.id,
          suggestions: [],
          isAutoFilled: true,
          manualPriceOverride: false,
        });
      } else {
        const topSuggestions = scoredItems
          .filter((entry) => entry.score > 0)
          .slice(0, 3)
          .map((entry) => entry.item);

        nextDraftItems.push({
          itemId: '',
          name: '',
          unit: DEFAULT_UNIT,
          qty,
          unitPrice: 0,
          picked: false,
          rawSearchString: searchString,
          originalPredictedId: null,
          suggestions: topSuggestions,
          isAutoFilled: true,
          manualPriceOverride: false,
        });
      }
    });

    setItems(nextDraftItems);
    setIsParsing(false);
    setParseText('');
  };

  const customerHistoryRows = useMemo(() => {
    const aggregate = new Map();

    customerInvoiceHistory.forEach((invoice) => {
      const invoiceSeen = new Set();
      const invoiceTimestamp = getInvoiceTimestamp(invoice);

      (Array.isArray(invoice?.items) ? invoice.items.filter(Boolean) : []).forEach(
        (item) => {
          const itemId = item?.itemId;
          if (!itemId) return;

          const unit = getItemUnit(item);
          const key = `${itemId}|${unit}`;
          const product = safeInventory.find(
            (entry) => String(entry?.id || '') === String(itemId)
          );

          if (!aggregate.has(key)) {
            aggregate.set(key, {
              key,
              itemId,
              unit,
              product,
              name: product ? getProductName(product) : String(item?.name || itemId),
              sku: product ? getProductSku(product) : '',
              orderCount: 0,
              totalQty: 0,
              lastDate: '',
              lastTimestamp: 0,
              lastInvoice: '',
              lastQty: 1,
              lastPrice: Number(item?.unitPrice || 0),
            });
          }

          const entry = aggregate.get(key);
          entry.totalQty += Number(item?.qty || item?.quantity || 0);

          if (!invoiceSeen.has(key)) {
            entry.orderCount += 1;
            invoiceSeen.add(key);
          }

          if (invoiceTimestamp >= entry.lastTimestamp) {
            entry.lastTimestamp = invoiceTimestamp;
            entry.lastDate = String(invoice?.date || '');
            entry.lastInvoice = String(invoice?.number || '');
            entry.lastQty = Number(item?.qty || item?.quantity || 1) || 1;
            entry.lastPrice = Number(item?.unitPrice || 0);
          }
        }
      );
    });

    return Array.from(aggregate.values())
      .map((entry) => ({
        ...entry,
        currentPrice: entry.product
          ? getSafePrice(entry.product, entry.unit)
          : entry.lastPrice,
      }))
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }, [customerInvoiceHistory, getSafePrice, safeInventory]);

  const filteredCustomerHistoryRows = useMemo(() => {
    const search = String(historySearch || '').trim().toLowerCase();
    if (!search) return customerHistoryRows;

    return customerHistoryRows.filter((entry) =>
      [entry.name, entry.sku, entry.unit, entry.lastInvoice]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search)
    );
  }, [customerHistoryRows, historySearch]);

  const latestCustomerInvoice = customerInvoiceHistory[0] || null;

  const toggleHistorySelection = (key) => {
    setSelectedHistoryKeys((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key]
    );
  };

  const addSelectedHistoryItems = () => {
    const selectedRows = customerHistoryRows.filter((entry) =>
      selectedHistoryKeys.includes(entry.key)
    );

    if (selectedRows.length === 0) return;

    const rowsToAdd = selectedRows.map((entry) => ({
      itemId: entry.itemId,
      name: entry.name,
      unit: entry.unit,
      qty: 1,
      unitPrice: entry.currentPrice,
      picked: false,
      suggestions: [],
      isAutoFilled: false,
      manualPriceOverride: false,
    }));

    setItems((current) => [
      ...(Array.isArray(current) ? current.filter(Boolean) : []),
      ...rowsToAdd,
    ]);
    setSelectedHistoryKeys([]);
    setIsHistoryModalOpen(false);
  };

  const addLastOrderItems = () => {
    if (!latestCustomerInvoice) return;

    const rowsToAdd = (Array.isArray(latestCustomerInvoice.items)
      ? latestCustomerInvoice.items.filter(Boolean)
      : []
    ).map((historyItem) => {
      const product = safeInventory.find(
        (entry) => String(entry?.id || '') === String(historyItem?.itemId || '')
      );
      const unit = getItemUnit(historyItem);

      return {
        itemId: historyItem?.itemId || '',
        name: product ? getProductName(product) : String(historyItem?.name || ''),
        unit,
        qty: Number(historyItem?.qty || historyItem?.quantity || 1) || 1,
        unitPrice: product
          ? getSafePrice(product, unit)
          : Number(historyItem?.unitPrice || 0),
        picked: false,
        suggestions: [],
        isAutoFilled: false,
        manualPriceOverride: false,
      };
    });

    setItems((current) => [
      ...(Array.isArray(current) ? current.filter(Boolean) : []),
      ...rowsToAdd,
    ]);
    setIsHistoryModalOpen(false);
  };

  const mergeDuplicateRow = (rowIndex) => {
    const row = cleanDraftItems[rowIndex];
    if (!row?.itemId) return;

    const key = `${row.itemId}|${getItemUnit(row)}`;
    const indexes = duplicateRowMap.get(key) || [];
    const targetIndex = indexes.find((index) => index !== rowIndex);
    if (targetIndex === undefined) return;

    const target = cleanDraftItems[targetIndex];
    if (Number(target?.unitPrice || 0) !== Number(row?.unitPrice || 0)) {
      window.alert(
        'These duplicate rows have different unit prices, so they were not merged automatically.'
      );
      return;
    }

    setItems((current) => {
      const next = [...(Array.isArray(current) ? current.filter(Boolean) : [])];
      if (!next[targetIndex] || !next[rowIndex]) return next;

      next[targetIndex] = {
        ...next[targetIndex],
        qty:
          (Number(next[targetIndex].qty || next[targetIndex].quantity) || 0) +
          (Number(next[rowIndex].qty || next[rowIndex].quantity) || 0),
      };
      next.splice(rowIndex, 1);
      return next;
    });
  };

  const scrollToRow = (rowIndex) => {
    const row = rowRefs.current[rowIndex];
    if (row?.scrollIntoView) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleRegister = async (printAfter = false) => {
    if (saveLockRef.current) return;

    if (invoiceIssues.errors.length > 0) {
      window.alert(
        `Please fix the following before saving:\n\n${invoiceIssues.errors
          .map((issue) => `• ${issue.message}`)
          .join('\n')}`
      );
      return;
    }

    saveLockRef.current = true;
    setIsSaving(true);

    const cleanItems = cleanDraftItems.map((item) => {
      const {
        suggestions,
        originalPredictedId,
        manualPriceOverride,
        ...rest
      } = item;
      return rest;
    });

    const finalItems = cleanItems.filter(
      (item) => item.itemId || item.rawSearchString || item.name
    );

    const invoice = {
      id: existingInvoice ? existingInvoice.id : `INV-${invoiceNumber}`,
      number: String(invoiceNumber),
      customerId,
      customer: String(
        getCustomerName(customer) || existingInvoice?.customer || 'Unknown Customer'
      ),
      region: String(customer?.region || existingInvoice?.region || ''),
      date: String(invoiceDate),
      items: finalItems,
      total,
      status: invoiceStatus,
      deliveryStatus: existingInvoice
        ? String(existingInvoice.deliveryStatus || 'Pending')
        : 'Pending',
      paymentTerms: String(paymentTerms),
      isSpecialFormat: Boolean(isSpecialFormat),
      poNumber: poNumber || null,
      carPlateNo: carPlateNo || null,
      remarks: invoiceRemarks,
    };

    try {
      // Final database-side duplicate check. The in-browser check remains for
      // immediate feedback, while this reduces the chance of two users saving
      // the same number at nearly the same time.
      const { data: duplicateRows, error: duplicateCheckError } = await supabase
        .from('invoices')
        .select('id, number')
        .eq('number', String(invoiceNumber))
        .limit(5);

      if (duplicateCheckError) {
        console.warn('Final invoice-number duplicate check failed:', duplicateCheckError);
      } else {
        const conflictingInvoice = (Array.isArray(duplicateRows) ? duplicateRows : []).find(
          (entry) =>
            String(entry?.id || '') !== String(existingInvoice?.id || '')
        );

        if (conflictingInvoice) {
          throw new Error(
            `Invoice number ${invoiceNumber} was just used by another invoice. Choose a different number and try again.`
          );
        }
      }

      const { error } = await supabase.from('invoices').upsert([invoice]);
      if (error) throw error;

      if (existingInvoice) {
        sys.setInvoices(
          safeInvoices.map((entry) =>
            entry?.id === existingInvoice.id ? invoice : entry
          )
        );
      } else {
        sys.setInvoices([...safeInvoices, invoice]);
      }

      if (printAfter) {
        window.setTimeout(() => {
          window.print();
          onClose();
        }, 500);
      } else {
        onClose();
      }
    } catch (error) {
      window.alert(
        `CRITICAL ERROR: Failed to save invoice to database.\n\n${
          error?.message || 'Unknown error'
        }`
      );
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
    }
  };

  const executePriceSave = async (type, newPriceStr) => {
    if (!priceModal) return;

    const { index, item, product, assignedGroup } = priceModal;
    const newPrice = Number(newPriceStr) || 0;
    const ruleKey = `${product.id}|${item.unit}`;

    try {
      if (type === 'CUSTOMER') {
        const updatedCustomPrices = {
          ...(customer?.custom_prices || {}),
          [ruleKey]: newPrice,
        };
        const { error } = await supabase
          .from('customers')
          .update({ custom_prices: updatedCustomPrices })
          .eq('id', customer.id);
        if (error) throw error;

        sys.setCustomers(
          safeCustomers.map((entry) =>
            entry?.id === customer.id
              ? { ...entry, custom_prices: updatedCustomPrices }
              : entry
          )
        );
      } else if (type === 'GROUP' && assignedGroup) {
        const updatedGroupPrices = {
          ...(assignedGroup.prices || {}),
          [ruleKey]: newPrice,
        };
        const { error } = await supabase
          .from('pricing_groups')
          .update({ prices: updatedGroupPrices })
          .eq('id', assignedGroup.id);
        if (error) throw error;

        setGroups(
          safeGroups.map((group) =>
            group.id === assignedGroup.id
              ? { ...group, prices: updatedGroupPrices }
              : group
          )
        );
      } else if (type === 'GLOBAL') {
        const productId = String(product?.id || '');
        const isUUID = productId.length === 36 && productId.includes('-');
        let dbError;

        if (isUUID) {
          const { error } = await supabase
            .from('product_list')
            .update({ Price: newPrice })
            .eq('id', product.id);
          dbError = error;
        } else {
          const legacyName = getProductName(product);
          const { error } = await supabase
            .from('product_list')
            .update({ Price: newPrice })
            .eq('Name', legacyName);
          dbError = error;
        }

        if (dbError) throw dbError;

        sys.setInventory(
          safeInventory.map((entry) =>
            entry?.id === product.id ? { ...entry, Price: newPrice } : entry
          )
        );
      } else if (type === 'REMOVE_CUSTOMER') {
        const updatedCustomPrices = { ...(customer?.custom_prices || {}) };
        delete updatedCustomPrices[ruleKey];

        const { error } = await supabase
          .from('customers')
          .update({ custom_prices: updatedCustomPrices })
          .eq('id', customer.id);
        if (error) throw error;

        const updatedCustomer = {
          ...customer,
          custom_prices: updatedCustomPrices,
        };

        sys.setCustomers(
          safeCustomers.map((entry) =>
            entry?.id === customer.id ? updatedCustomer : entry
          )
        );

        // IMPORTANT: calculate the fallback against the updated customer
        // object, not the stale React customer object that still contains the
        // removed individual override.
        const fallbackPrice = getSafePrice(product, item.unit, updatedCustomer);

        const nextItems = [...cleanDraftItems];
        if (nextItems[index]) {
          nextItems[index] = {
            ...nextItems[index],
            unitPrice: fallbackPrice,
            manualPriceOverride: false,
          };
        }
        setItems(nextItems);
        setPriceModal(null);
        return;
      }

      const nextItems = [...cleanDraftItems];
      if (nextItems[index]) {
        nextItems[index] = {
          ...nextItems[index],
          unitPrice: newPrice,
          manualPriceOverride: false,
        };
      }
      setItems(nextItems);
      setPriceModal(null);
    } catch (error) {
      window.alert(`Database Update Failed: ${error?.message || 'Unknown error'}`);
    }
  };

  if (previewMode) {
    return (
      <InvoicePreview
        mode="generator"
        customer={customer}
        gst={gst}
        invoiceNumber={invoiceNumber}
        invoiceDate={invoiceDate}
        items={items}
        remarks={invoiceRemarks}
        onBack={() => setPreviewMode(false)}
        onRegister={handleRegister}
        paymentTerms={paymentTerms}
        setItems={setItems}
        subtotal={subtotal}
        sys={sys}
        total={total}
        existingInvoice={existingInvoice}
        isSpecialFormat={isSpecialFormat}
        poNumber={poNumber}
        carPlateNo={carPlateNo}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/90 p-0 backdrop-blur-md xl:p-3">
      <div className="flex h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl xl:h-[calc(100dvh-24px)] xl:w-[calc(100vw-24px)] xl:rounded-2xl xl:border xl:border-white/20">
        <div className="flex shrink-0 items-center justify-between gap-4 bg-slate-900 px-5 py-3 text-white sm:px-6 xl:px-8">
          <div className="flex items-center space-x-3">
            <FileText className="text-blue-500" />
            <div>
              <h2 className="text-base font-black uppercase tracking-wider">
                {existingInvoice ? 'Edit Existing Invoice' : 'Draft Invoice Workspace'}
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">
                {cleanDraftItems.length} item{cleanDraftItems.length === 1 ? '' : 's'} • ${formatMoney(total)}
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              className="flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
              onClick={() => setIsParsing(true)}
              type="button"
            >
              <MessageSquare className="mr-2" size={16} /> Paste Order
            </button>
            <button
              className="rounded-full p-1.5 transition-colors hover:bg-slate-800"
              onClick={requestClose}
              type="button"
              aria-label="Close invoice generator"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-3 sm:p-4 lg:p-5">
          {priceRefreshNotice && (
            <div className="mx-auto mb-4 flex w-full max-w-[1600px] items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 shadow-sm">
              <RefreshCcw size={17} className="mt-0.5 shrink-0" />
              <p className="text-xs font-bold leading-5">{priceRefreshNotice}</p>
            </div>
          )}

          {isParsing && (
            <div className="mx-auto mb-5 w-full max-w-[1600px] rounded-2xl bg-blue-600 p-5 text-white shadow-xl sm:p-6">
              <h3 className="mb-2 flex items-center text-lg font-black">
                <BrainCircuit className="mr-3" size={24} /> Smart Order Extractor
              </h3>
              <p className="mb-4 text-xs font-medium leading-5 text-blue-100">
                Paste an order message below. Quantities such as “2箱”, “qty 2”, “2 product-name” and leading “x2 product-name” are recognised without confusing package sizes such as “500g” or “400g x 20”. Corrections can also improve future matching.
              </p>
              <textarea
                className="mb-4 h-28 w-full rounded-xl border border-blue-400 bg-blue-700/50 p-4 text-base font-medium leading-6 outline-none placeholder:text-blue-300"
                onChange={(event) => setParseText(event.target.value)}
                placeholder="Paste order details here..."
                value={parseText}
              />
              <div className="flex justify-end space-x-3">
                <button
                  className="px-6 py-2 text-xs font-bold text-blue-200"
                  onClick={() => setIsParsing(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded bg-white px-8 py-2 text-xs font-black text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleSmartExtract}
                  disabled={!String(parseText || '').trim()}
                  type="button"
                >
                  Extract Order
                </button>
              </div>
            </div>
          )}

          <div className="mx-auto mb-4 w-full max-w-[1600px] border-b-4 border-blue-600 bg-white p-5 text-base text-gray-800 shadow-xl sm:p-6 lg:p-7">
            <CompanyHeader />

            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm font-bold text-blue-800">
                <FileText size={15} className="shrink-0 text-blue-600" />
                <span>Invoice workspace</span>
                <span className="font-medium text-blue-500">• Search products, edit quantities and prices directly in the table.</span>
              </div>
              <div className="text-xs font-black uppercase tracking-wider text-blue-600">
                {cleanDraftItems.length} item{cleanDraftItems.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="mb-5 flex flex-wrap justify-between gap-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 xl:flex-nowrap xl:gap-y-0">
              <div className="w-full border-b border-slate-200 pb-4 xl:w-[36%] xl:border-b-0 xl:border-r xl:pb-0 xl:pr-6">
                <div className="mb-1 flex items-end justify-between">
                  <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Customer Account:
                  </label>
                  {!existingInvoice && (
                    <label className="flex cursor-pointer items-center space-x-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 transition-colors hover:bg-slate-100">
                      <input
                        type="checkbox"
                        checked={isAutofillEnabled}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setIsAutofillEnabled(checked);
                          if (!checked) {
                            setItems((current) =>
                              (Array.isArray(current) ? current : []).filter(
                                (item) => item && !item.isAutoFilled
                              )
                            );
                            setAutoFillNotif(false);
                          }
                        }}
                        className="h-3 w-3 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                        Auto-Predict
                      </span>
                    </label>
                  )}
                </div>

                <CustomerSearchSelect
                  value={customerId}
                  customers={safeCustomers}
                  onChange={requestCustomerChange}
                  disabled={Boolean(existingInvoice)}
                />

                {customer && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    {customer?.region && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5">
                        {String(customer.region)}
                      </span>
                    )}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">
                      {customer?.custom_prices &&
                      Object.keys(customer.custom_prices || {}).length > 0
                        ? 'Individual pricing'
                        : assignedCustomerGroup
                          ? `${assignedCustomerGroup.name || 'Group'} pricing`
                          : 'Default pricing'}
                    </span>
                  </div>
                )}

                {autoFillNotif && (
                  <p className="mt-2 flex items-center text-[10px] font-black uppercase tracking-widest text-indigo-500">
                    <Sparkles className="mr-1" size={12} /> Predictions Added — Verify Before Saving
                  </p>
                )}
              </div>

              <div className="w-[48%] border-r border-slate-200 px-3 sm:w-[32%] xl:w-[18%] xl:px-6">
                <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Invoice Date:
                </label>
                <input
                  type="date"
                  className="mt-1 w-full cursor-pointer border-none bg-transparent p-0 text-lg font-black text-slate-800 outline-none focus:ring-0"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                />
              </div>

              <div className="w-[48%] border-r border-slate-200 px-3 sm:w-[32%] xl:w-[18%] xl:px-6">
                <label className="text-[10px] font-black uppercase text-gray-400">
                  Terms:
                </label>
                <select
                  className="mt-1 w-full cursor-pointer border-none bg-transparent p-0 text-lg font-black text-slate-800 outline-none focus:ring-0"
                  onChange={(event) => setPaymentTerms(event.target.value)}
                  value={paymentTerms}
                >
                  <option value="30_days">30 Days</option>
                  <option value="cod">C.O.D</option>
                  {!['30_days', 'cod'].includes(paymentTerms) && (
                    <option value={paymentTerms}>{String(paymentTerms).replaceAll('_', ' ')}</option>
                  )}
                </select>
              </div>

              <div className="relative w-full pt-2 text-right sm:w-[32%] sm:pl-4 sm:pt-0 xl:w-[28%] xl:pl-6">
                <label className="text-[10px] font-black uppercase text-gray-400">
                  Serial No.
                </label>
                <div className="mt-1 flex items-center justify-end text-3xl font-black tracking-tighter text-red-600">
                  <span className="mr-1">#</span>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(event) => {
                      setInvoiceNumber(event.target.value);
                      setInvoiceNumberManuallyEdited(true);
                    }}
                    className={`m-0 w-full max-w-[140px] border-b-2 bg-transparent p-0 text-right outline-none focus:ring-0 ${
                      isDuplicateNumber
                        ? 'border-red-500 text-red-600'
                        : 'border-transparent hover:border-red-200 focus:border-red-600'
                    }`}
                  />
                </div>
                {isDuplicateNumber && (
                  <p className="mt-1 text-[10px] font-black uppercase text-red-500">
                    Number Already Exists!
                  </p>
                )}
              </div>
            </div>

            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Invoice Options
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-slate-500">
                    Optional settings; normal invoices can be left unchanged.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRemarkModalOpen(true)}
                  className="flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <MessageSquare size={12} className="mr-1.5" />
                  {invoiceRemarks ? 'Edit Remarks' : 'Add Remarks'}
                </button>
              </div>

              <label className="mt-4 flex w-max cursor-pointer items-center space-x-2">
                <input
                  type="checkbox"
                  checked={isSpecialFormat}
                  onChange={(event) => setIsSpecialFormat(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="flex items-center text-sm font-bold text-slate-700">
                  <ScanBarcode size={14} className="mr-1 text-purple-500" /> Enable Special Format (Barcode & Car Plate)
                </span>
              </label>

              {isSpecialFormat && (
                <div className="mt-4 flex space-x-6 border-t border-slate-200 pt-4">
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">
                      PO Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. POC121950"
                      value={poNumber}
                      onChange={(event) => setPoNumber(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-bold outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">
                      Car Plate No.
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. GBF4684U"
                      value={carPlateNo}
                      onChange={(event) => setCarPlateNo(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-bold outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {suggestions.length > 0 && !existingInvoice && (
              <div className="mb-5 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-4">
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-blue-500">
                  Secondary Recommendations
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map(({ product, unit, key }) => (
                    <button
                      key={key}
                      className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
                      onClick={() =>
                        setItems((current) => [
                          ...(Array.isArray(current) ? current.filter(Boolean) : []),
                          {
                            itemId: product.id,
                            name: getProductName(product),
                            unit,
                            qty: 1,
                            unitPrice: getSafePrice(product, unit),
                            picked: false,
                            suggestions: [],
                            manualPriceOverride: false,
                          },
                        ])
                      }
                      type="button"
                    >
                      + {getProductName(product)} ({unit})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative z-10 w-full overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[1180px] text-left">
              <thead className="sticky top-0 z-20 border-y-2 border-slate-900 bg-slate-50/95 shadow-sm backdrop-blur">
                <tr className="text-xs font-black uppercase tracking-wider text-slate-500">
                  <th className="w-14 p-3 text-center">No.</th>
                  <th className="min-w-[430px] p-3">Description</th>
                  <th className="w-28 p-3 text-center">Unit</th>
                  <th className="w-24 p-3 text-center">Qty</th>
                  <th className="w-32 p-3 text-right">Unit Price</th>
                  <th className="w-32 p-3 text-right">Total</th>
                  <th className="w-12 p-3" />
                </tr>
              </thead>
              <tbody>
                {cleanDraftItems.map((item, index) => {
                  const safeItemUnit = getItemUnit(item);
                  const ruleKey = `${item.itemId}|${safeItemUnit}`;

                  const hasIndividualPrice = Boolean(
                    customer?.custom_prices &&
                      typeof customer.custom_prices === 'object' &&
                      customer.custom_prices[ruleKey] !== undefined
                  );
                  const assignedGroup = customer?.pricing_group_id
                    ? safeGroups.find(
                        (group) =>
                          String(group?.id || '') ===
                          String(customer.pricing_group_id)
                      )
                    : null;
                  const hasGroupPrice = Boolean(
                    assignedGroup?.prices &&
                      typeof assignedGroup.prices === 'object' &&
                      assignedGroup.prices[ruleKey] !== undefined
                  );

                  const selectedProduct = safeInventory.find(
                    (product) => String(product?.id || '') === String(item.itemId || '')
                  );
                  let rowUnitOptions = [];

                  if (selectedProduct) {
                    const defaultUnit = getItemUnit(selectedProduct);
                    rowUnitOptions.push({ value: defaultUnit, label: defaultUnit });

                    if (
                      customer?.custom_prices &&
                      typeof customer.custom_prices === 'object'
                    ) {
                      Object.keys(customer.custom_prices).forEach((key) => {
                        const [productId, productUnit] = key.split('|');
                        if (
                          String(productId) === String(selectedProduct.id) &&
                          productUnit !== defaultUnit &&
                          !rowUnitOptions.find((option) => option.value === productUnit)
                        ) {
                          rowUnitOptions.push({
                            value: productUnit,
                            label: `${productUnit} (Custom)`,
                          });
                        }
                      });
                    }

                    if (
                      safeItemUnit &&
                      !rowUnitOptions.find((option) => option.value === safeItemUnit)
                    ) {
                      rowUnitOptions.push({ value: safeItemUnit, label: safeItemUnit });
                    }
                  } else {
                    rowUnitOptions = Array.isArray(UNIT_OPTIONS) ? [...UNIT_OPTIONS] : [];
                    if (
                      safeItemUnit &&
                      !rowUnitOptions.find((option) => option.value === safeItemUnit)
                    ) {
                      rowUnitOptions.push({ value: safeItemUnit, label: safeItemUnit });
                    }
                  }

                  const isPredicted = Boolean(item.isAutoFilled);
                  const duplicateIndexes = item?.itemId
                    ? duplicateRowMap.get(`${item.itemId}|${safeItemUnit}`) || []
                    : [];
                  const isDuplicate = duplicateIndexes.length > 1;

                  const rowClass = isPredicted
                    ? 'bg-indigo-50/40 border-indigo-200 text-indigo-700'
                    : !item.itemId && item.rawSearchString
                      ? 'bg-amber-50/30 border-amber-100'
                      : 'border-gray-100';

                  return (
                    <tr
                      ref={(node) => {
                        rowRefs.current[index] = node;
                      }}
                      className={`border-b font-bold transition-colors ${rowClass}`}
                      key={`${item.itemId || 'row'}-${index}`}
                    >
                      <td className="p-3 pt-4 text-center align-top font-mono text-sm font-bold text-slate-400">
                        {index + 1}
                      </td>

                      <td className="relative p-2.5 align-top">
                        <div className="flex items-center space-x-2">
                          <input
                            checked={item.picked || false}
                            className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            onChange={(event) => {
                              const nextItems = [...cleanDraftItems];
                              if (nextItems[index]) {
                                nextItems[index] = {
                                  ...nextItems[index],
                                  picked: event.target.checked,
                                };
                              }
                              setItems(nextItems);
                            }}
                            type="checkbox"
                          />

                          <ProductSearchSelect
                            value={item.itemId}
                            inventory={safeInventory}
                            isAutoFilled={isPredicted}
                            onChange={(selectedId) => {
                              const product = safeInventory.find(
                                (entry) =>
                                  String(entry?.id || '') === String(selectedId || '')
                              );
                              if (!product) return;

                              if (item.rawSearchString) {
                                learnFromCorrection(
                                  item.rawSearchString,
                                  selectedId,
                                  item.originalPredictedId
                                );
                              }

                              const nextItems = [...cleanDraftItems];
                              const determinedUnit = getItemUnit(product);
                              if (nextItems[index]) {
                                nextItems[index] = {
                                  ...nextItems[index],
                                  itemId: selectedId,
                                  name: getProductName(product),
                                  unit: determinedUnit,
                                  unitPrice: getSafePrice(product, determinedUnit),
                                  suggestions: [],
                                  isAutoFilled: false,
                                  rawSearchString: null,
                                  originalPredictedId: selectedId,
                                  manualPriceOverride: false,
                                };
                              }
                              setItems(nextItems);
                            }}
                          />
                        </div>

                        {isPredicted && (
                          <div className="ml-6 mt-1.5 flex items-center">
                            <button
                              onClick={() => {
                                const next = [...cleanDraftItems];
                                if (next[index]) {
                                  if (next[index].rawSearchString && next[index].itemId) {
                                    learnFromCorrection(
                                      next[index].rawSearchString,
                                      next[index].itemId,
                                      next[index].originalPredictedId
                                    );
                                  }
                                  next[index] = {
                                    ...next[index],
                                    isAutoFilled: false,
                                    rawSearchString: null,
                                  };
                                }
                                setItems(next);
                              }}
                              className="flex items-center rounded bg-indigo-200 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-800 shadow-sm transition-colors hover:bg-indigo-300"
                              type="button"
                            >
                              <Check size={10} className="mr-1" /> Verify Match
                            </button>
                          </div>
                        )}

                        {item.rawSearchString && item.itemId && !isPredicted && (
                          <p className="ml-6 mt-1.5 flex items-center text-[9px] font-medium text-blue-400">
                            <BrainCircuit size={10} className="mr-1" /> Predicted from: “{item.rawSearchString}”
                          </p>
                        )}

                        {!item.itemId && item.suggestions && item.suggestions.length > 0 && (
                          <div className="ml-6 mb-1 mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 shadow-sm">
                            <p className="mb-2 flex items-center text-[9px] font-black uppercase tracking-widest text-amber-700">
                              <AlertTriangle size={12} className="mr-1.5" /> Did you mean?
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {item.suggestions.map((suggestion) => {
                                const suggestionName = getProductName(suggestion);
                                const suggestionUnit = getItemUnit(suggestion);

                                return (
                                  <button
                                    key={suggestion.id}
                                    type="button"
                                    onClick={() => {
                                      if (item.rawSearchString) {
                                        learnFromCorrection(
                                          item.rawSearchString,
                                          suggestion.id,
                                          item.originalPredictedId
                                        );
                                      }

                                      const nextItems = [...cleanDraftItems];
                                      if (nextItems[index]) {
                                        nextItems[index] = {
                                          ...nextItems[index],
                                          itemId: suggestion.id,
                                          name: suggestionName,
                                          unit: suggestionUnit,
                                          unitPrice: getSafePrice(
                                            suggestion,
                                            suggestionUnit
                                          ),
                                          suggestions: [],
                                          originalPredictedId: suggestion.id,
                                          isAutoFilled: false,
                                          rawSearchString: null,
                                          manualPriceOverride: false,
                                        };
                                      }
                                      setItems(nextItems);
                                    }}
                                    className="rounded border border-amber-300 bg-white px-2 py-1 text-[11px] font-bold text-amber-900 shadow-sm transition-colors hover:bg-amber-200"
                                  >
                                    {suggestionName}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {!item.itemId &&
                          item.rawSearchString &&
                          (!item.suggestions || item.suggestions.length === 0) && (
                            <p className="ml-6 mt-1.5 flex items-center text-[9px] font-medium text-amber-500">
                              <AlertTriangle size={10} className="mr-1" /> No matches found for “{item.rawSearchString}”
                            </p>
                          )}

                        {isDuplicate && (
                          <div className="ml-6 mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[9px] font-bold text-amber-700">
                            <AlertTriangle size={11} className="shrink-0" />
                            <span>
                              Same product/unit also appears on row{duplicateIndexes.length > 2 ? 's' : ''} {duplicateIndexes
                                .filter((row) => row !== index)
                                .map((row) => row + 1)
                                .join(', ')}.
                            </span>
                            <button
                              type="button"
                              onClick={() => mergeDuplicateRow(index)}
                              className="ml-auto shrink-0 rounded bg-amber-100 px-2 py-1 font-black uppercase hover:bg-amber-200"
                            >
                              Merge Qty
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="p-2 pt-4 align-top">
                        <select
                          className={`m-0 w-full cursor-pointer rounded-lg border border-transparent bg-transparent px-1 py-1.5 text-center text-sm font-bold focus:border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-100 ${
                            isPredicted ? 'text-indigo-600' : ''
                          }`}
                          onChange={(event) => {
                            const nextItems = [...cleanDraftItems];
                            const newUnit = event.target.value;
                            if (nextItems[index]) {
                              nextItems[index] = {
                                ...nextItems[index],
                                unit: newUnit,
                                manualPriceOverride: false,
                              };
                              const product = safeInventory.find(
                                (entry) =>
                                  String(entry?.id || '') ===
                                  String(nextItems[index].itemId || '')
                              );
                              if (product) {
                                nextItems[index].unitPrice = getSafePrice(product, newUnit);
                              }
                            }
                            setItems(nextItems);
                          }}
                          value={safeItemUnit}
                        >
                          {rowUnitOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2 pt-3 align-top">
                        <input
                          className={`m-0 w-full rounded-lg border border-transparent bg-transparent p-1.5 text-center text-base font-black focus:border-blue-200 focus:bg-white focus:ring-2 focus:ring-blue-100 ${
                            isPredicted ? 'text-indigo-700' : 'text-blue-600'
                          }`}
                          onChange={(event) => {
                            const nextItems = [...cleanDraftItems];
                            if (nextItems[index]) {
                              nextItems[index] = {
                                ...nextItems[index],
                                qty: event.target.value,
                              };
                            }
                            setItems(nextItems);
                          }}
                          min="0"
                          step="1"
                          type="number"
                          value={item.qty || item.quantity || ''}
                        />
                      </td>

                      <td className="p-2 pt-3 text-right align-top">
                        <input
                          className={`m-0 w-full rounded-lg border border-transparent bg-transparent p-1.5 text-right text-base font-black leading-none focus:border-blue-200 focus:bg-white focus:ring-2 focus:ring-blue-100 ${
                            isPredicted ? 'text-indigo-900' : ''
                          }`}
                          onChange={(event) => {
                            const nextItems = [...cleanDraftItems];
                            if (nextItems[index]) {
                              nextItems[index] = {
                                ...nextItems[index],
                                unitPrice: event.target.value,
                                manualPriceOverride: true,
                              };
                            }
                            setItems(nextItems);
                          }}
                          min="0"
                          step="0.01"
                          type="number"
                          value={item.unitPrice ?? ''}
                        />

                        {item.itemId && customer && (
                          <button
                            type="button"
                            onClick={() => {
                              const product = safeInventory.find(
                                (entry) =>
                                  String(entry?.id || '') === String(item.itemId || '')
                              );
                              if (product) {
                                setPriceModal({
                                  index,
                                  item,
                                  product,
                                  hasIndividualPrice,
                                  assignedGroup,
                                });
                              }
                            }}
                            className={`mt-0.5 flex w-full items-center justify-end rounded px-2 py-1 text-[9px] uppercase tracking-widest transition-colors ${
                              item.manualPriceOverride
                                ? 'font-black text-amber-600 hover:bg-amber-50'
                                : hasIndividualPrice
                                  ? isPredicted
                                    ? 'text-indigo-600 hover:bg-indigo-100'
                                    : 'font-black text-emerald-500 hover:bg-emerald-50'
                                  : hasGroupPrice
                                    ? 'font-black text-indigo-500 hover:bg-indigo-50'
                                    : 'font-semibold text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            {item.manualPriceOverride ? (
                              <>Invoice-only</>
                            ) : hasIndividualPrice ? (
                              '★ Customer'
                            ) : hasGroupPrice ? (
                              <>
                                <Layers size={10} className="mr-1" /> Group
                              </>
                            ) : (
                              <>
                                <Settings size={10} className="mr-1" /> Default
                              </>
                            )}
                          </button>
                        )}

                        {item.itemId && !customer && item.manualPriceOverride && (
                          <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-amber-600">
                            Invoice-only
                          </p>
                        )}

                        {item.itemId && customer && item.manualPriceOverride && (
                          <p className="mt-1 text-[10px] font-medium text-amber-500">
                            Current customer price: ${formatMoney(
                              resolvePriceInfo(selectedProduct, safeItemUnit).price
                            )}
                          </p>
                        )}
                      </td>

                      <td
                        className={`p-3 pt-3 text-right align-top font-mono text-xl font-black tracking-tighter ${
                          isPredicted ? 'text-indigo-900' : 'text-slate-900'
                        }`}
                      >
                        ${formatMoney(
                          (Number(item.qty || item.quantity) || 0) *
                            (Number(item.unitPrice) || 0)
                        )}
                      </td>

                      <td className="w-12 p-1 pt-4 text-center align-top">
                        <button
                          className={`ml-2 hover:text-red-500 ${
                            isPredicted
                              ? 'text-indigo-300 hover:bg-indigo-100'
                              : 'text-red-200'
                          }`}
                          onClick={() =>
                            setItems(cleanDraftItems.filter((_, itemIndex) => itemIndex !== index))
                          }
                          type="button"
                          aria-label={`Delete row ${index + 1}`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-blue-700 shadow-sm transition-all hover:bg-blue-100"
                onClick={() =>
                  setItems([
                    ...cleanDraftItems,
                    {
                      itemId: '',
                      name: '',
                      unit: DEFAULT_UNIT,
                      qty: 1,
                      unitPrice: 0,
                      picked: false,
                      suggestions: [],
                      manualPriceOverride: false,
                    },
                  ])
                }
                type="button"
              >
                + Add Row Manually
              </button>

              <button
                className="flex items-center rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-indigo-700 shadow-sm transition-all hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => {
                  setHistorySearch('');
                  setSelectedHistoryKeys([]);
                  setIsHistoryModalOpen(true);
                }}
                disabled={!customerId}
                type="button"
              >
                <History size={12} className="mr-1.5" /> Previously Ordered
              </button>

              <button
                className="flex items-center rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={addLastOrderItems}
                disabled={!latestCustomerInvoice}
                type="button"
                title={latestCustomerInvoice ? `Add items from invoice #${String(latestCustomerInvoice.number || '')}` : 'No previous order found'}
              >
                <ShoppingCart size={13} className="mr-1.5" /> Add Last Order
              </button>

              <button
                className="flex items-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-slate-700 shadow-sm transition-all hover:bg-slate-200"
                onClick={() => setIsRemarkModalOpen(true)}
                type="button"
              >
                <MessageSquare size={12} className="mr-1.5" /> Add / Edit Invoice Remarks
              </button>
            </div>

            {invoiceIssues.errors.length > 0 || invoiceIssues.warnings.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck
                    size={17}
                    className={
                      invoiceIssues.errors.length > 0 ? 'text-red-500' : 'text-amber-500'
                    }
                  />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                    Invoice Check
                  </p>
                  <span
                    className={`ml-auto rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                      invoiceIssues.errors.length > 0
                        ? 'bg-red-100 text-red-600'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {invoiceIssues.errors.length > 0
                      ? `${invoiceIssues.errors.length} action required`
                      : `${invoiceIssues.warnings.length} warning${
                          invoiceIssues.warnings.length === 1 ? '' : 's'
                        }`}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {invoiceIssues.errors.map((issue, issueIndex) => (
                    <button
                      key={`error-${issueIndex}-${issue.message}`}
                      type="button"
                      onClick={() =>
                        issue.rowIndex !== undefined && scrollToRow(issue.rowIndex)
                      }
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold text-red-600 ${
                        issue.rowIndex !== undefined ? 'hover:bg-red-50' : 'cursor-default'
                      }`}
                    >
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      {issue.message}
                    </button>
                  ))}

                  {invoiceIssues.warnings.map((issue, issueIndex) => (
                    <button
                      key={`warning-${issueIndex}-${issue.message}`}
                      type="button"
                      onClick={() =>
                        issue.rowIndex !== undefined && scrollToRow(issue.rowIndex)
                      }
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold text-amber-700 ${
                        issue.rowIndex !== undefined ? 'hover:bg-amber-50' : 'cursor-default'
                      }`}
                    >
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      {issue.message}
                    </button>
                  ))}
                </div>
              </div>
            ) : customerId && cleanDraftItems.length > 0 ? (
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
                <CheckCircle2 size={17} />
                <p className="text-xs font-black uppercase tracking-wider">
                  Ready to preview
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-4 border-t-2 border-slate-900 pt-5 lg:flex-row lg:justify-between">
              <div className="w-full lg:w-[55%]">
                {invoiceRemarks && (
                  <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                    <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-yellow-600">
                      Invoice Remarks
                    </h4>
                    <p className="whitespace-pre-wrap text-sm font-medium text-slate-700">
                      {invoiceRemarks}
                    </p>
                  </div>
                )}
              </div>

              <div className="w-full max-w-sm space-y-2 lg:w-80">
                <div className="flex justify-between text-xs font-black uppercase tracking-wider text-slate-400">
                  <span>Sub-Total ($)</span>
                  <span className="text-slate-900">${formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs font-black uppercase tracking-wider text-slate-400">
                  <span>GST 9%</span>
                  <span className="text-slate-900">${formatMoney(gst)}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-black uppercase">Total Due</span>
                  <span className="text-3xl font-black tracking-tighter">
                    ${formatMoney(total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t bg-white px-5 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] sm:px-6 xl:rounded-b-2xl xl:px-8">
          <div className="flex items-center justify-between gap-4">
            <button
              className="rounded-xl px-4 py-2.5 text-sm font-black uppercase tracking-wider text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
              onClick={requestClose}
              type="button"
            >
              Discard
            </button>

            <div className="hidden text-center sm:block">
              <p className="text-xs font-black text-slate-700">
                {cleanDraftItems.length} item{cleanDraftItems.length === 1 ? '' : 's'} • ${formatMoney(total)}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                {invoiceIssues.errors.length > 0
                  ? `${invoiceIssues.errors.length} issue${invoiceIssues.errors.length === 1 ? '' : 's'} must be fixed`
                  : invoiceIssues.warnings.length > 0
                    ? `${invoiceIssues.warnings.length} warning${invoiceIssues.warnings.length === 1 ? '' : 's'} to review`
                    : 'Invoice check passed'}
              </p>
            </div>

            <button
              className="flex items-center rounded-xl bg-indigo-600 px-7 py-3 text-sm font-black uppercase tracking-wider text-white shadow-xl transition-all hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={invoiceIssues.errors.length > 0 || isSaving}
              onClick={() => setPreviewMode(true)}
              type="button"
            >
              <Eye className="mr-2" size={18} /> Preview Invoice
            </button>
          </div>
        </div>
      </div>

      {pendingCustomerChange && (
        <div className="fixed inset-0 z-[6500] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="bg-slate-900 px-6 py-4 text-white">
              <h2 className="flex items-center text-sm font-black uppercase tracking-widest">
                <RefreshCcw size={16} className="mr-2 text-blue-400" /> Customer Changed
              </h2>
            </div>

            <div className="p-6">
              <p className="text-sm leading-6 text-slate-600">
                This invoice already contains products. Prices may have been calculated using the previous customer&apos;s individual or group pricing.
              </p>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-bold text-slate-400">Change customer</p>
                <p className="mt-1 font-black text-slate-800">
                  {getCustomerName(
                    safeCustomers.find(
                      (entry) => String(entry?.id || '') === String(pendingCustomerChange.fromId || '')
                    )
                  ) || 'No customer'}
                  {' → '}
                  {getCustomerName(
                    safeCustomers.find(
                      (entry) => String(entry?.id || '') === String(pendingCustomerChange.toId || '')
                    )
                  ) || 'Selected customer'}
                </p>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Refreshing will recalculate normal rows using the new customer&apos;s pricing cascade. Prices manually typed for this invoice are preserved.
              </p>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => applyCustomerChange(true)}
                  className="flex w-full items-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700"
                >
                  <RefreshCcw size={16} className="mr-3" />
                  Refresh Using New Customer Pricing
                </button>
                <button
                  type="button"
                  onClick={() => applyCustomerChange(false)}
                  className="flex w-full items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Keep Existing Prices
                </button>
                <button
                  type="button"
                  onClick={() => setPendingCustomerChange(null)}
                  className="w-full px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  Cancel Customer Change
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[6200] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
              <div>
                <h2 className="flex items-center text-sm font-black uppercase tracking-widest">
                  <History size={16} className="mr-2 text-indigo-400" /> Previously Ordered
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {getCustomerName(customer) || 'Selected customer'} • {customerInvoiceHistory.length} historical invoice{customerInvoiceHistory.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="rounded-full p-1.5 hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-slate-100 p-5">
              {latestCustomerInvoice ? (
                <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                      Last Order
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-800">
                      Invoice #{String(latestCustomerInvoice.number || '—')} • {formatShortDate(latestCustomerInvoice.date)}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">
                      {(Array.isArray(latestCustomerInvoice.items) ? latestCustomerInvoice.items.filter(Boolean).length : 0)} item rows
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addLastOrderItems}
                    className="flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-blue-700"
                  >
                    <ShoppingCart size={14} className="mr-2" /> Add Last Order Items
                  </button>
                </div>
              ) : (
                <div className="mb-4 rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm font-medium text-slate-400">
                  No previous invoices found for this customer.
                </div>
              )}

              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3">
                <Search size={16} className="mr-2 shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="Search previous products, SKU, unit or invoice..."
                  className="w-full border-none bg-transparent py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-0"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {filteredCustomerHistoryRows.length > 0 ? (
                <div className="space-y-2">
                  {filteredCustomerHistoryRows.map((entry) => {
                    const selected = selectedHistoryKeys.includes(entry.key);
                    const source = entry.product
                      ? resolvePriceInfo(entry.product, entry.unit)
                      : { label: 'Last invoiced price' };

                    return (
                      <label
                        key={entry.key}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                          selected
                            ? 'border-indigo-200 bg-indigo-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleHistorySelection(entry.key)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-black text-slate-800">
                                {entry.sku ? `[${entry.sku}] ` : ''}{entry.name}
                              </p>
                              <p className="mt-1 text-[11px] font-semibold text-slate-400">
                                {entry.unit} • Ordered on {entry.orderCount} invoice{entry.orderCount === 1 ? '' : 's'} • Total qty {entry.totalQty}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                Last: {formatShortDate(entry.lastDate)}{entry.lastInvoice ? ` • #${entry.lastInvoice}` : ''}
                              </p>
                            </div>
                            <div className="shrink-0 text-left sm:text-right">
                              <p className="text-base font-black text-blue-700">
                                ${formatMoney(entry.currentPrice)}
                              </p>
                              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                {source.label}
                              </p>
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
                  <History size={24} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-500">
                    No matching historical products
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
              <p className="text-xs font-bold text-slate-500">
                {selectedHistoryKeys.length} selected
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedHistoryKeys.length === 0}
                  onClick={addSelectedHistoryItems}
                  className="flex items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ShoppingCart size={15} className="mr-2" /> Add Selected Items
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {priceModal && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
              <h2 className="flex items-center text-sm font-black uppercase tracking-widest">
                <Settings size={16} className="mr-2 text-blue-400" /> Pricing Cascade
              </h2>
              <button
                onClick={() => setPriceModal(null)}
                className="rounded-full p-1 transition-colors hover:bg-slate-800"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              <p className="mb-1 text-sm text-slate-500">Editing price for:</p>
              <p className="mb-4 text-base font-bold text-slate-900">
                {getProductName(priceModal.product)} ({String(priceModal.item?.unit || '')})
              </p>

              <div className="mb-6">
                <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Price to save ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full rounded-xl border-2 border-blue-100 bg-blue-50/50 p-4 text-2xl font-black text-blue-600 outline-none focus:border-blue-500"
                  defaultValue={priceModal.item?.unitPrice}
                  id="pricingManagerInput"
                />
                <p className="mt-2 text-[11px] leading-4 text-slate-400">
                  Choose where this price should be saved permanently. Typing directly in the invoice row remains invoice-only.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() =>
                    executePriceSave(
                      'CUSTOMER',
                      document.getElementById('pricingManagerInput').value
                    )
                  }
                  className="flex w-full items-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-700"
                  type="button"
                >
                  <User size={16} className="mr-3 shrink-0" />
                  <span className="flex-1 text-left">
                    Save for {getCustomerName(customer) || 'Customer'}
                  </span>
                </button>

                {priceModal.assignedGroup && (
                  <button
                    onClick={() =>
                      executePriceSave(
                        'GROUP',
                        document.getElementById('pricingManagerInput').value
                      )
                    }
                    className="flex w-full items-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-700"
                    type="button"
                  >
                    <Layers size={16} className="mr-3 shrink-0" />
                    <span className="flex-1 text-left">
                      Save for {priceModal.assignedGroup.name} Group
                    </span>
                  </button>
                )}

                <button
                  onClick={() =>
                    executePriceSave(
                      'GLOBAL',
                      document.getElementById('pricingManagerInput').value
                    )
                  }
                  className="flex w-full items-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700"
                  type="button"
                >
                  <Settings size={16} className="mr-3 shrink-0" />
                  <span className="flex-1 text-left">Update Global Catalog</span>
                </button>

                {priceModal.hasIndividualPrice && (
                  <button
                    onClick={() => executePriceSave('REMOVE_CUSTOMER')}
                    className="mt-4 flex w-full items-center rounded-xl border-2 border-red-100 bg-white px-4 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
                    type="button"
                  >
                    <Trash2 size={16} className="mr-3 shrink-0" />
                    <span className="flex-1 text-left">Clear Individual Override</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isRemarkModalOpen && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
              <h2 className="flex items-center text-sm font-black uppercase tracking-widest">
                <MessageSquare size={16} className="mr-2 text-blue-400" /> Invoice Remarks
              </h2>
              <button
                onClick={() => setIsRemarkModalOpen(false)}
                className="rounded-full p-1 transition-colors hover:bg-slate-800"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              <p className="mb-4 text-sm text-slate-500">
                Add notes or special instructions for this invoice. These will appear in the bottom-left corner of the normal invoice template.
              </p>

              <div className="mb-6">
                <textarea
                  id="invoiceRemarkInput"
                  rows={5}
                  className="w-full resize-none rounded-xl border-2 border-blue-100 bg-blue-50/50 p-4 text-sm font-medium text-slate-800 shadow-inner outline-none focus:border-blue-500"
                  defaultValue={invoiceRemarks}
                  placeholder="Enter any special instructions, backorder notes, or highlights..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsRemarkModalOpen(false)}
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setInvoiceRemarks(
                      document.getElementById('invoiceRemarkInput').value
                    );
                    setIsRemarkModalOpen(false);
                  }}
                  className="flex flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700"
                  type="button"
                >
                  <Save size={16} className="mr-2 shrink-0" /> Save Remarks
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDiscardConfirmOpen && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                <AlertTriangle size={24} />
              </div>
              <h2 className="mt-4 text-lg font-black text-slate-900">
                Discard unsaved changes?
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                This invoice has unsaved changes. Closing now will remove the current draft changes from this workspace.
              </p>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsDiscardConfirmOpen(false)}
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDiscardConfirmOpen(false);
                    onClose();
                  }}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700"
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSaving && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[8000] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-2xl">
          Saving invoice…
        </div>
      )}
    </div>
  );
}
