import { getTodayString } from '../utils/date';

export const INITIAL_CUSTOMERS = [
  { id: 'c1', name: '57麻辣香锅 (ADMIRALTY)', contactPerson: 'Mr Ye', contactNumber: '97578869', address: '70 Woodlands Ave 7, #01-02 Admiralty MRT Station, Singapore 738344', lat: 1.44, lng: 103.801, region: 'North' },
  { id: 'c2', name: '探烤记火锅', contactPerson: 'Min', contactNumber: '91113505', address: '4190 Ang Mo Kio Ave 6, #01-05 Broadway Plaza, Singapore 569841', lat: 1.375, lng: 103.848, region: 'North' },
  { id: 'c3', name: 'CXL Pte Ltd', contactPerson: '', contactNumber: '', address: 'Jurong West St 91, Singapore', lat: 1.34, lng: 103.682, region: 'West' },
  { id: 'c4', name: '鲜得来', contactPerson: '', contactNumber: '', address: '18 Liang Seah Street, Singapore 189039', lat: 1.298, lng: 103.856, region: 'Central' },
  { id: 'c5', name: '老成都', contactPerson: '', contactNumber: '', address: '60 Paya Lebar Rd, #B1/01-05, Singapore 409051', lat: 1.318, lng: 103.893, region: 'East' },
  { id: 'c6', name: 'Inactive Cafe (Demo)', contactPerson: '', contactNumber: '', address: '10 Tampines Central, Singapore', lat: 1.352, lng: 103.944, region: 'East' },
];

export const INITIAL_SUPPLIERS = [
  { id: 'sup1', name: 'BH Bee Hlang Food Industries', lat: 1.332, lng: 103.714, region: 'West' },
  { id: 'sup2', name: 'BWY Wilmar Pte Ltd', lat: 1.35, lng: 103.9, region: 'East' },
];

export const INITIAL_INVENTORY = [
  { id: 'i1', sku: 'SKU-001', name: '(加工)当归粉', unit: 'kg', price: 1.8, stock: 50, customerPrices: {} },
  { id: 'i2', sku: 'SKU-002', name: '(加工)红花椒粉', unit: 'kg', price: 1.8, stock: 30, customerPrices: {} },
  { id: 'i3', sku: 'SKU-365', name: '海天老抽酱油', unit: '箱', price: 20, stock: 15, customerPrices: { c1: 18 } },
  { id: 'i4', sku: 'SKU-366', name: '玲玲卷', unit: '箱', price: 18.5, stock: 10, customerPrices: {} },
  { id: 'i5', sku: 'SKU-370', name: '黑糖', unit: '包', price: 17, stock: 100, customerPrices: {} },
  { id: 'i6', sku: 'SKU-371', name: '梅林午餐肉', unit: '箱', price: 53, stock: 25, customerPrices: { c2: 50 } },
];

export const INITIAL_GST = [
  { id: 'g1', date: getTodayString(), type: 'input', desc: 'Monthly Warehouse Rental', amount: 2200, gst: 198, category: 'Overheads' },
  { id: 'g2', date: getTodayString(), type: 'input', desc: 'Purchase from BH Bee Hlang', amount: 800, gst: 72, category: 'Purchases' },
];

export function buildDemoInvoices() {
  const today = new Date();
  const invoices = [];
  let number = 2601000;

  const scenarios = [
    {
      cid: 'c1',
      cname: '57麻辣香锅 (ADMIRALTY)',
      region: 'North',
      monthOffsets: [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5],
      items: [
        [{ id: 'i3', u: '箱', q: 5, p: 18 }, { id: 'i4', u: '箱', q: 3, p: 18.5 }],
        [{ id: 'i3', u: '箱', q: 8, p: 18 }, { id: 'i6', u: '箱', q: 2, p: 53 }],
        [{ id: 'i3', u: '箱', q: 4, p: 18 }],
      ],
    },
    {
      cid: 'c2',
      cname: '探烤记火锅',
      region: 'North',
      monthOffsets: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
      items: [
        [{ id: 'i6', u: '箱', q: 4, p: 50 }, { id: 'i5', u: '包', q: 6, p: 17 }],
        [{ id: 'i6', u: '箱', q: 3, p: 50 }],
      ],
    },
    {
      cid: 'c3',
      cname: 'CXL Pte Ltd',
      region: 'West',
      monthOffsets: [1, 2, 3, 3, 4, 4, 4, 5, 5, 5],
      items: [
        [{ id: 'i5', u: '包', q: 10, p: 17 }, { id: 'i1', u: 'kg', q: 5, p: 1.8 }],
        [{ id: 'i5', u: '包', q: 5, p: 17 }],
        [{ id: 'i5', u: '包', q: 2, p: 17 }],
      ],
    },
    {
      cid: 'c4',
      cname: '鲜得来',
      region: 'Central',
      monthOffsets: [2, 3, 3, 4, 5],
      items: [[{ id: 'i2', u: 'kg', q: 8, p: 1.8 }, { id: 'i4', u: '箱', q: 4, p: 18.5 }]],
    },
    {
      cid: 'c5',
      cname: '老成都',
      region: 'East',
      monthOffsets: [1, 2, 3, 4, 5],
      items: [[{ id: 'i1', u: 'kg', q: 10, p: 1.8 }, { id: 'i3', u: '箱', q: 6, p: 20 }]],
    },
    {
      cid: 'c6',
      cname: 'Inactive Cafe (Demo)',
      region: 'East',
      monthOffsets: [4, 5, 5],
      items: [[{ id: 'i5', u: '包', q: 4, p: 17 }]],
    },
  ];

  scenarios.forEach((scenario) => {
    scenario.monthOffsets.forEach((monthOffset, index) => {
      const date = new Date(today.getFullYear(), today.getMonth() - monthOffset, 10 + (index % 15));
      const itemSet = scenario.items[index % scenario.items.length];
      const subtotal = itemSet.reduce((sum, item) => sum + item.q * item.p, 0);
      invoices.push({
        id: `inv_${number}`,
        number: String(number),
        customerId: scenario.cid,
        customer: scenario.cname,
        region: scenario.region,
        date: date.toISOString().split('T')[0],
        total: subtotal * 1.09,
        paymentTerms: index % 3 === 0 ? 'cod' : '30_days',
        items: itemSet.map((item) => ({
          itemId: item.id,
          name: '',
          unit: item.u,
          qty: item.q,
          unitPrice: item.p,
          picked: false,
        })),
      });
      number += 1;
    });
  });

  const todayString = getTodayString();
  invoices.push({
    id: 'inv_td1',
    number: String(number++),
    customerId: 'c1',
    customer: '57麻辣香锅 (ADMIRALTY)',
    region: 'North',
    date: todayString,
    total: 150 * 1.09,
    paymentTerms: '30_days',
    items: [
      { itemId: 'i3', name: '海天老抽酱油', unit: '箱', qty: 5, unitPrice: 18, picked: true },
      { itemId: 'i4', name: '玲玲卷', unit: '箱', qty: 3, unitPrice: 18.5, picked: false },
    ],
  });
  invoices.push({
    id: 'inv_td2',
    number: String(number++),
    customerId: 'c3',
    customer: 'CXL Pte Ltd',
    region: 'West',
    date: todayString,
    total: 45 * 1.09,
    paymentTerms: 'cod',
    items: [{ itemId: 'i5', name: '黑糖', unit: '包', qty: 2, unitPrice: 17, picked: false }],
  });

  return invoices.sort((a, b) => new Date(b.date) - new Date(a.date));
}
