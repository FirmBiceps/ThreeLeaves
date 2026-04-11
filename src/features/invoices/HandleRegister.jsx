const handleRegister = (printAfter = false) => {
    const invoice = {
      id: existingInvoice ? existingInvoice.id : `INV-${invoiceNumber}`,
      number: String(invoiceNumber),
      customerId,
      customer: customer.name,
      region: customer.region,
      date: existingInvoice ? existingInvoice.date : new Date().toISOString().split('T')[0],
      items,
      total,
      status: existingInvoice ? existingInvoice.status : 'Paid',
      paymentTerms,
      deliveryStatus: existingInvoice ? existingInvoice.deliveryStatus : 'Pending'
    };

    // If editing, map over the array and replace it. If new, push it to the end.
    let nextInvoices;
    if (existingInvoice) {
      nextInvoices = sys.invoices.map(inv => inv.id === invoice.id ? invoice : inv);
    } else {
      nextInvoices = [...sys.invoices, invoice];
      
      // Only deduct inventory stock if it's a BRAND NEW invoice
      const nextInventory = [...sys.inventory];
      items.forEach((item) => {
        const index = nextInventory.findIndex((entry) => entry.id === item.itemId);
        if (index > -1) {
          nextInventory[index].stock -= Number(item.qty) || 0;
        }
      });
      sys.setInventory(nextInventory);
    }

    sys.setInvoices(nextInvoices);

    if (printAfter) {
      setTimeout(() => {
        window.print();
        onClose();
      }, 500);
    } else {
      onClose();
    }
  };
