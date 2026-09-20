import { supabase } from '../supabase';
import { normalizeSLPhone, isValidSLPhone } from '../utils/phone';

// Currency formatter for Sri Lankan Rupees
export const formatLKR = (amount) => {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString('en-LK')}`;
};

// ----------------------------------------------------
// NOTIFICATIONS ENGINE
// ----------------------------------------------------

export async function createNotification(sellerId, { title, message, type = 'order', link = '/orders' }) {
  if (!sellerId) return null;
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([{
        seller_id: sellerId,
        title,
        message,
        type,
        link,
        is_read: false
      }])
      .select()
      .single();

    if (error) {
      console.error('Failed to create notification:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Notification creation exception:', err);
    return null;
  }
}

export async function fetchNotifications(sellerId) {
  if (!sellerId) return [];
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Error in fetchNotifications:', err);
    return [];
  }
}

export async function markNotificationAsRead(id) {
  if (!id) return;
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsAsRead(sellerId) {
  if (!sellerId) return;
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('seller_id', sellerId)
    .eq('is_read', false);
  if (error) throw error;
}

// ----------------------------------------------------
// SELLERS & AUTH
// ----------------------------------------------------

export async function fetchCurrentSeller(authUserId) {
  if (!authUserId) return null;
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createSeller({ authUserId, shopName, handle, email, whatsappNumber }) {
  const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
  const cleanPhone = normalizeSLPhone(whatsappNumber);

  if (!isValidSLPhone(cleanPhone)) {
    throw new Error('Please enter a valid 10-digit Sri Lankan phone number.');
  }

  const { data, error } = await supabase
    .from('sellers')
    .insert([{
      auth_user_id: authUserId,
      shop_name: shopName.trim(),
      handle: cleanHandle,
      email: email.trim().toLowerCase(),
      whatsapp_number: cleanPhone,
      subscription_status: 'trial',
      subscription_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      next_order_number: 1,
    }])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Shop handle is already taken. Try a different one.');
    }
    throw error;
  }
  return data;
}

export async function fetchSellerByHandle(handle) {
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('handle', handle.trim().toLowerCase())
    .single();

  if (error) return null;
  return data;
}

export async function updateSellerProfile(sellerId, updates) {
  const { data, error } = await supabase
    .from('sellers')
    .update(updates)
    .eq('id', sellerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ----------------------------------------------------
// PRODUCTS & INVENTORY
// ----------------------------------------------------

export async function fetchProducts(sellerId) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createProduct({
  sellerId,
  title,
  price,
  compareAtPrice = null,
  costPrice = null,
  description = '',
  category = 'General',
  photoUrls = [],
  trackStock = true,
  stockCount = 0,
  variants = [],
  freeDelivery = false
}) {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).substring(2, 6);

  const { data, error } = await supabase
    .from('products')
    .insert([{
      seller_id: sellerId,
      title: title.trim(),
      slug,
      price: Number(price),
      compare_at_price: compareAtPrice ? Number(compareAtPrice) : null,
      cost_price: costPrice ? Number(costPrice) : null,
      description: description.trim(),
      category: category.trim() || 'General',
      photo_urls: photoUrls,
      track_stock: trackStock,
      stock_count: Number(stockCount) || 0,
      variants: variants,
      free_delivery: Boolean(freeDelivery)
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProduct(productId, updates) {
  const payload = { ...updates };
  if (payload.price !== undefined) payload.price = Number(payload.price);
  if (payload.compare_at_price !== undefined) {
    payload.compare_at_price = payload.compare_at_price ? Number(payload.compare_at_price) : null;
  }
  if (payload.cost_price !== undefined) {
    payload.cost_price = payload.cost_price ? Number(payload.cost_price) : null;
  }
  if (payload.stock_count !== undefined) {
    payload.stock_count = Number(payload.stock_count) || 0;
  }
  if (payload.free_delivery !== undefined) {
    payload.free_delivery = Boolean(payload.free_delivery);
  }

  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', productId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProductStock(productId, newStock) {
  const parsedStock = Math.max(0, parseInt(newStock, 10));
  const { data, error } = await supabase
    .from('products')
    .update({ stock_count: parsedStock })
    .eq('id', productId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProduct(productId) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) throw error;
}

export async function fetchProductBySlug(sellerId, slug) {
  if (!sellerId || !slug) return null;
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('slug', slug)
    .maybeSingle();

  if (error) return null;
  return data;
}

// ----------------------------------------------------
// CUSTOMERS (per-seller, scoped by seller_id)
// ----------------------------------------------------

export async function findCustomerByPhone(sellerId, phone) {
  if (!sellerId) return null;
  const cleanPhone = normalizeSLPhone(phone);
  if (!cleanPhone || cleanPhone.length < 9) return null;

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('phone', cleanPhone)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function getOrCreateCustomer({ sellerId, phone, secondaryPhone = '', name, city, deliveryAddress, district = '' }) {
  const cleanPhone = normalizeSLPhone(phone);
  const cleanSecondary = secondaryPhone ? normalizeSLPhone(secondaryPhone) : '';

  const { data: existing } = await supabase
    .from('customers')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('phone', cleanPhone)
    .maybeSingle();

  if (existing) {
    const { data: updated } = await supabase
      .from('customers')
      .update({
        name: name?.trim() || existing.name,
        secondary_phone: cleanSecondary || existing.secondary_phone,
        city: city?.trim() || existing.city,
        delivery_address: deliveryAddress?.trim() || existing.delivery_address,
        district: district?.trim() || existing.district
      })
      .eq('id', existing.id)
      .select()
      .single();
    return updated || existing;
  }

  const { data: created, error } = await supabase
    .from('customers')
    .insert([{
      seller_id: sellerId,
      phone: cleanPhone,
      secondary_phone: cleanSecondary,
      name: name?.trim() || 'New Customer',
      city: city?.trim() || '',
      delivery_address: deliveryAddress?.trim() || '',
      district: district?.trim() || ''
    }])
    .select()
    .single();

  if (error) throw error;
  return created;
}

export async function fetchCustomers(sellerId) {
  if (!sellerId) return [];
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('seller_id', sellerId)
    .order('total_orders', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateCustomer(customerId, updates) {
  const payload = { ...updates };
  if (payload.phone) {
    payload.phone = normalizeSLPhone(payload.phone);
  }
  if (payload.secondary_phone) {
    payload.secondary_phone = normalizeSLPhone(payload.secondary_phone);
  }

  const { data, error } = await supabase
    .from('customers')
    .update(payload)
    .eq('id', customerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCustomerSafe(customerId) {
  const { data: linkedOrders, error: checkErr } = await supabase
    .from('orders')
    .select('id')
    .eq('customer_id', customerId);

  if (checkErr) throw checkErr;

  if (linkedOrders && linkedOrders.length > 0) {
    await supabase
      .from('orders')
      .update({ customer_id: null })
      .eq('customer_id', customerId);
  }

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId);

  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// ORDERS
// ----------------------------------------------------

export async function fetchOrders(sellerId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(*)')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchOrderByUuid(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, sellers(*), customers(*)')
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data;
}

export async function createOrder({
  sellerId,
  customerName,
  customerPhone,
  secondaryPhone = '',
  deliveryAddress,
  city,
  district,
  items,
  deliveryFee = 0,
  paymentMethod = 'COD',
  source = 'manual_pos',
  autoConfirm = false
}) {
  const cleanPhone = normalizeSLPhone(customerPhone);
  const cleanSecondary = secondaryPhone ? normalizeSLPhone(secondaryPhone) : '';

  if (!isValidSLPhone(cleanPhone)) {
    throw new Error('Valid 10-digit Sri Lankan phone number is required.');
  }

  const customer = await getOrCreateCustomer({
    sellerId,
    phone: cleanPhone,
    secondaryPhone: cleanSecondary,
    name: customerName,
    city,
    deliveryAddress,
    district
  });

  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * (Number(item.quantity) || 1)), 0);
  const totalAmount = subtotal + Number(deliveryFee);

  // Atomic order code allocation via SECURITY DEFINER RPC (works for anon buyers)
  const { data: codeResult, error: codeErr } = await supabase.rpc('next_order_code', {
    p_seller_id: sellerId,
  });

  if (codeErr) {
    throw new Error('Failed to allocate order code: ' + codeErr.message);
  }

  const orderCode = String(codeResult);

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert([{
      order_code: orderCode,
      seller_id: sellerId,
      customer_id: customer.id,
      customer_name: customerName.trim(),
      customer_phone: cleanPhone,
      secondary_phone: cleanSecondary,
      delivery_address: deliveryAddress.trim(),
      city: city.trim(),
      district: district ? district.trim() : '',
      items,
      subtotal,
      delivery_fee: Number(deliveryFee),
      total_amount: totalAmount,
      advance_paid: (paymentMethod === 'Bank' && source !== 'storefront') ? totalAmount : 0,
      cod_balance: paymentMethod === 'COD' ? totalAmount : 0,
      payment_method: paymentMethod,
      payment_status: (paymentMethod === 'Bank' && source === 'storefront')
        ? 'Awaiting Payment'
        : (paymentMethod === 'Bank' ? 'Paid' : 'Unpaid'),
      status: 'received',
      source,
      buyer_confirmed: autoConfirm,
      buyer_confirmed_at: autoConfirm ? new Date().toISOString() : null
    }])
    .select()
    .single();

  if (orderErr) throw orderErr;

  // Inventory Decrement & Low Stock Alert
  for (const item of items) {
    if (item.id && item.track_stock !== false) {
      const { data: currentProd } = await supabase
        .from('products')
        .select('title, stock_count')
        .eq('id', item.id)
        .single();

      if (currentProd) {
        const remainingStock = Math.max(0, currentProd.stock_count - (item.quantity || 1));
        await supabase
          .from('products')
          .update({ stock_count: remainingStock })
          .eq('id', item.id);

        if (remainingStock <= 2) {
          await createNotification(sellerId, {
            title: 'Low Stock Alert',
            message: `"${currentProd.title}" is running low (${remainingStock} left in inventory).`,
            type: 'stock',
            link: '/products'
          });
        }
      }
    }
  }

  await supabase
    .from('customers')
    .update({ total_orders: (customer.total_orders || 0) + 1 })
    .eq('id', customer.id);

  await createNotification(sellerId, {
    title: `New Order #${order.order_code || order.id.slice(0, 4)}`,
    message: `${order.customer_name} placed an order for ${formatLKR(order.total_amount)} (${order.payment_method}).`,
    type: 'order',
    link: `/orders/${order.id}`
  });

  return order;
}

export async function updateOrderStatus(orderId, nextStatus, { courierName = null, trackingNumber = null } = {}) {
  const updates = { status: nextStatus };

  if (nextStatus === 'dispatched') {
    updates.dispatched_at = new Date().toISOString();
    if (courierName) updates.courier_name = courierName;
    if (trackingNumber) updates.tracking_number = trackingNumber;
  }

  if (nextStatus === 'delivered') {
    updates.delivered_at = new Date().toISOString();
    updates.payment_status = 'Paid';
    updates.cod_balance = 0;
  }

  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function confirmOrderAsBuyer(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .update({
      buyer_confirmed: true,
      buyer_confirmed_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  if (data?.seller_id) {
    await createNotification(data.seller_id, {
      title: `Order Verified #${data.order_code || data.id.slice(0, 4)}`,
      message: `${data.customer_name} verified delivery address. Ready to pack!`,
      type: 'verification',
      link: `/orders/${data.id}`
    });
  }

  return data;
}

export async function deleteOrdersBatch(orderIds) {
  if (!orderIds || !orderIds.length) return;

  for (const orderId of orderIds) {
    const { data: order } = await supabase
      .from('orders')
      .select('items, status')
      .eq('id', orderId)
      .single();

    if (order && order.status !== 'delivered' && order.status !== 'canceled') {
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        if (item.id) {
          const { data: liveProduct } = await supabase
            .from('products')
            .select('stock_count')
            .eq('id', item.id)
            .single();

          if (liveProduct) {
            const currentStock = Number(liveProduct.stock_count) || 0;
            const qtyToReturn = Number(item.quantity) || 1;
            await updateProductStock(item.id, currentStock + qtyToReturn);
          }
        }
      }
    }

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (error) throw error;
  }
  return true;
}

// ----------------------------------------------------
// SUPER-ADMIN MANAGEMENT
// ----------------------------------------------------

export async function fetchAllSellersAdmin() {
  const { data, error } = await supabase
    .from('sellers')
    .select('*, orders(id, total_amount, status)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function extendSubscription(sellerId, daysToAdd) {
  const { data: current, error: fetchErr } = await supabase
    .from('sellers')
    .select('subscription_expires_at')
    .eq('id', sellerId)
    .single();

  if (fetchErr) throw fetchErr;

  const baseDate = current.subscription_expires_at && new Date(current.subscription_expires_at) > new Date()
    ? new Date(current.subscription_expires_at)
    : new Date();

  baseDate.setDate(baseDate.getDate() + Number(daysToAdd));

  const { data, error } = await supabase
    .from('sellers')
    .update({
      subscription_status: 'active',
      subscription_expires_at: baseDate.toISOString(),
      is_active: true
    })
    .eq('id', sellerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setCustomSubscriptionExpiry(sellerId, customIsoDate) {
  const { data, error } = await supabase
    .from('sellers')
    .update({
      subscription_status: new Date(customIsoDate) > new Date() ? 'active' : 'expired',
      subscription_expires_at: new Date(customIsoDate).toISOString(),
      is_active: new Date(customIsoDate) > new Date()
    })
    .eq('id', sellerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function toggleStoreActiveStatus(sellerId, currentStatus) {
  const nextStatus = !currentStatus;
  const { data, error } = await supabase
    .from('sellers')
    .update({
      is_active: nextStatus,
      subscription_status: nextStatus ? 'active' : 'suspended'
    })
    .eq('id', sellerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSellerAdmin(sellerId) {
  const { error } = await supabase
    .from('sellers')
    .delete()
    .eq('id', sellerId);

  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// PUSH NOTIFICATIONS
// ----------------------------------------------------

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getPushStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription && Notification.permission === 'granted') return 'subscribed';
    return 'not_subscribed';
  } catch {
    return 'unsupported';
  }
}

export async function subscribeToPush(sellerId, vapidPublicKey) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported on this device.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied.');
  }

  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const subJson = subscription.toJSON();
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        seller_id: sellerId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
        user_agent: navigator.userAgent,
      },
      { onConflict: 'endpoint' }
    );

  if (error) throw error;
  return subscription;
}

export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  }
}

export async function triggerPushNotification(sellerId, { title, message, link, orderId }) {
  try {
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: {
        seller_id: sellerId,
        title,
        message,
        link,
        order_id: orderId,
      },
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('[Push] Trigger failed:', err.message || err);
    return null;
  }
}

// ----------------------------------------------------
// BANK PAYMENT CONFIRMATION
// ----------------------------------------------------

export async function markOrderPaymentReceived(orderId) {
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('id', orderId)
    .single();

  if (fetchErr) throw fetchErr;

  const { data, error } = await supabase
    .from('orders')
    .update({
      payment_status: 'Paid',
      advance_paid: Number(order.total_amount) || 0,
      cod_balance: 0,
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ----------------------------------------------------
// BUYER SELF-SERVICE
// ----------------------------------------------------

export async function updateBuyerOrderAddress(orderId, {
  customerName,
  customerPhone,
  secondaryPhone = '',
  deliveryAddress,
  city,
  district,
}) {
  const cleanPhone = normalizeSLPhone(customerPhone);
  const cleanSecondary = secondaryPhone ? normalizeSLPhone(secondaryPhone) : '';

  if (!isValidSLPhone(cleanPhone)) {
    throw new Error('Please enter a valid 10-digit Sri Lankan phone number (07XXXXXXXX).');
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('orders')
    .select('status, order_code, seller_id, customer_name')
    .eq('id', orderId)
    .single();

  if (fetchErr) throw fetchErr;
  if (!existing) throw new Error('Order not found.');
  if (existing.status !== 'received') {
    throw new Error('This order has already been processed. Contact the seller to make changes.');
  }

  const { data, error } = await supabase
    .from('orders')
    .update({
      customer_name: customerName.trim(),
      customer_phone: cleanPhone,
      secondary_phone: cleanSecondary,
      delivery_address: deliveryAddress.trim(),
      city: city.trim(),
      district: district ? district.trim() : '',
    })
    .eq('id', orderId)
    .select('*, sellers(*), customers(*)')
    .single();

  if (error) throw error;

  if (data?.seller_id) {
    await createNotification(data.seller_id, {
      title: `Order Details Updated #${data.order_code || data.id.slice(0, 4)}`,
      message: `${data.customer_name} updated their delivery details. Double-check before packing.`,
      type: 'order',
      link: `/orders/${data.id}`,
    });
  }

  return data;
}

export async function cancelOrderAsBuyer(orderId) {
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchErr) throw fetchErr;
  if (!order) throw new Error('Order not found.');
  if (order.status === 'canceled') throw new Error('This order is already canceled.');
  if (order.status !== 'received') {
    throw new Error('This order has already been packed or dispatched. Contact the seller directly.');
  }

  const items = Array.isArray(order.items) ? order.items : [];
  for (const item of items) {
    if (item.id) {
      const { data: liveProduct } = await supabase
        .from('products')
        .select('stock_count')
        .eq('id', item.id)
        .single();

      if (liveProduct) {
        const newStock = (Number(liveProduct.stock_count) || 0) + (Number(item.quantity) || 1);
        await supabase
          .from('products')
          .update({ stock_count: newStock })
          .eq('id', item.id);
      }
    }
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'canceled' })
    .eq('id', orderId)
    .select('*, sellers(*), customers(*)')
    .single();

  if (error) throw error;

  if (data?.seller_id) {
    const refundNote = (data.payment_method === 'Bank' && data.payment_status === 'Paid')
      ? ' Payment was already received — a refund may be needed.'
      : '';
    await createNotification(data.seller_id, {
      title: `Order Canceled by Buyer #${data.order_code || data.id.slice(0, 4)}`,
      message: `${data.customer_name} canceled their order. Stock returned to inventory.${refundNote}`,
      type: 'order',
      link: `/orders/${data.id}`,
    });
  }

  return data;
}

// ----------------------------------------------------
// BULK ORDER STATUS
// ----------------------------------------------------

export async function bulkUpdateOrderStatus(orderIds, nextStatus) {
  if (!orderIds || !orderIds.length) {
    return { updatedOrders: [], skipped: 0 };
  }

  if (nextStatus !== 'packed') {
    throw new Error('Bulk status changes are currently only supported for "packed".');
  }

  const { data: orders, error: fetchErr } = await supabase
    .from('orders')
    .select('id, status, buyer_confirmed, payment_method, payment_status')
    .in('id', orderIds);

  if (fetchErr) throw fetchErr;

  const eligible = (orders || []).filter((o) => {
    if (o.status !== 'received') return false;

    const isCOD = !o.payment_method || o.payment_method === 'COD';
    const isBank = o.payment_method === 'Bank';
    const isPaid = o.payment_status === 'Paid';

    if (isCOD) return Boolean(o.buyer_confirmed);
    if (isBank) return isPaid;
    return false;
  });

  if (!eligible.length) {
    return { updatedOrders: [], skipped: (orders || []).length };
  }

  const eligibleIds = eligible.map((o) => o.id);

  const { data, error } = await supabase
    .from('orders')
    .update({ status: nextStatus })
    .in('id', eligibleIds)
    .select();

  if (error) throw error;

  return {
    updatedOrders: data || [],
    skipped: (orders || []).length - (data?.length || 0),
  };
}