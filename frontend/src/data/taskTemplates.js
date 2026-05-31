export const TASK_TEMPLATES = [
  { id: 'tpl-01', title: 'Check high-demand product display', category: 'Sales', priority: 'medium', description: 'Verify all high-demand products are properly displayed and stocked at counter.' },
  { id: 'tpl-02', title: 'Follow up pending customer orders', category: 'Sales', priority: 'high', description: 'Call customers with pending/ready orders for pickup.' },
  { id: 'tpl-03', title: 'Review near-short products', category: 'Purchase', priority: 'high', description: 'Identify products below minimum stock level and add to purchase list.' },
  { id: 'tpl-04', title: 'Prepare supplier purchase list', category: 'Purchase', priority: 'medium', description: "Compile final purchase order list for today's supplier call." },
  { id: 'tpl-05', title: 'Audit selected rack/shelf', category: 'Stock Audit', priority: 'medium', description: 'Physical count of assigned rack. Report mismatches.' },
  { id: 'tpl-06', title: 'Check pending RGHS prescriptions', category: 'RGHS', priority: 'critical', description: 'Review all pending RGHS prescriptions for OPD date, seal, and doctor signature.' },
  { id: 'tpl-07', title: 'Track unpaid RGHS bills', category: 'RGHS', priority: 'high', description: 'Check status of submitted RGHS bills and follow up on unpaid claims.' },
  { id: 'tpl-08', title: 'Pack and dispatch online orders', category: 'Delivery', priority: 'high', description: 'Pack all confirmed online orders and hand over to delivery partner.' },
  { id: 'tpl-09', title: 'Check near-expiry stock', category: 'Expiry Return', priority: 'critical', description: 'Identify products expiring within 60 days and flag for return.' },
  { id: 'tpl-10', title: 'Prepare supplier return list', category: 'Expiry Return', priority: 'high', description: 'Compile expiry return items with batch/quantity for supplier.' },
  { id: 'tpl-11', title: 'Daily cash handover', category: 'Admin', priority: 'critical', description: 'Count, verify, and hand over daily cash to manager with slip.' },
  { id: 'tpl-12', title: 'Daily issue report to manager', category: 'Admin', priority: 'medium', description: "Submit summary of today's issues, complaints, and pending items." },
  { id: 'tpl-13', title: 'Refrigerator temperature check', category: 'Cleaning / Store Maintenance', priority: 'high', description: 'Record fridge temperature. Escalate if outside normal range.' },
  { id: 'tpl-14', title: 'Morning store cleaning verification', category: 'Cleaning / Store Maintenance', priority: 'medium', description: 'Confirm all areas cleaned before store opens.' },
]

export const TEMPLATE_CATEGORIES = [...new Set(TASK_TEMPLATES.map((t) => t.category))]
