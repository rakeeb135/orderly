import { supabase } from '../supabase';
import { normalizeSLPhone, isValidSLPhone } from '../utils/phone';

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
      .insert([{ seller_id: sellerId, title, message, type, link, is_read: false }])
      .select()
      .single();
    if (error) { console.error('Failed to create notification:', error.message); return null; }
    return data;
  } catch (err) { console.error('Notification creation exception:', err); return null; }
}

export async function fetchNotifications(sellerId) {
  if (!sellerId) return [];
  try {
    const { data, error } = await supabase
      .from('notifications').select('*').eq('seller_id', sellerId)
      .order('created_at', { ascending: false }).limit(30);
    if (error) { console.error('Error fetching notifications:', error); return []; }
    return data || [];
  } catch (err) { console.error('Error in fetchNotifications:', err); return []; }
}

export async function markNotificationAsRead(id) {
  if (!id) return;
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsAsRead(sellerId) {
  if (!sellerId) return;
  const { error } = await supabase.from('notifications')
    .update({ is_read: true }).eq('seller_id', sellerId).eq('is_read', false);
  if (error) throw error;
}

// ----------------------------------------------------
// SELLERS & AUTH
// ----------------------------------------------------

export async function fetchCurrentSeller(authUserId) {
  if (!authUserId) return null;
  const { data, error } = await supabase
    .from('sellers').select('*').eq('auth_user_id', authUserId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createSeller({ authUserId, shopName, handle, email, whatsappNumber, monthlyFee = 1990 }) {
  const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
  const cleanPhone = normalizeSLPhone(whatsappNumber);
  if (!isValidSLPhone(cleanPhone)) {
    throw new Error('Please enter a valid 10-digit Sri Lankan phone number.');
  }
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('sellers')
    .insert([{
      auth_user_id: authUserId, shop_name: shopName.trim(), handle: cleanHandle,
      email: email.trim().toLowerCase(), whatsapp_number: cleanPhone,
      subscription_status: 'trial', subscription_expires_at: trialEnd,
      next_order_number: 1,
      monthly_fee: monthlyFee,
    }])
    .select().single();
  if (error) {
    if (error.code === '23505') throw new Error('Shop handle is already taken. Try a different one.');
    throw error;
  }
  await logSubscriptionEvent({
    sellerId: data.id, adminSellerId: null, eventType: 'signup',
    daysAdded: 14, oldExpiry: null, newExpiry: trialEnd, notes: '14-day free trial',
  });
  return data;
}

// BUYER-SAFE — reads via SECURITY DEFINER RPC (returns only public columns)
export async function fetchSellerByHandle(handle) {
  if (!handle) return null;
  const { data, error } = await supabase.rpc('get_public_seller', {
    p_handle: handle.trim().toLowerCase(),
  });
  if (error) return null;
  return data;
}

export async function updateSellerProfile(sellerId, updates) {
  const { data, error } = await supabase
    .from('sellers').update(updates).eq('id', sellerId).select().single();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------
// PRODUCTS & INVENTORY
// ----------------------------------------------------

export async function fetchProducts(sellerId) {
  const { data, error } = await supabase
    .from('products').select('*').eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// BUYER-SAFE — reads via SECURITY DEFINER RPC (hides cost_price)
export async function fetchProductsPublic(sellerId) {
  if (!sellerId) return [];
  const { data, error } = await supabase.rpc('get_public_products', {
    p_seller_id: sellerId,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createProduct({
  sellerId, title, price, compareAtPrice = null, costPrice = null,
  description = '', category = 'General', photoUrls = [], trackStock = false,
  stockCount = null, variants = [], freeDelivery = false, productLimit = 500
}) {
  const { count: currentCount, error: countErr } = await supabase
    .from('products').select('id', { count: 'exact', head: true }).eq('seller_id', sellerId);
  if (countErr) throw countErr;
  if ((currentCount || 0) >= productLimit) {
    throw new Error(`You've reached the limit of ${productLimit} products on this plan. Contact support to raise it.`);
  }
  const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    + '-' + Math.random().toString(36).substring(2, 6);
  const finalTrackStock = Boolean(trackStock);
  const finalStockCount = finalTrackStock ? Math.max(0, parseInt(stockCount, 10) || 0) : null;
  const { data, error } = await supabase
    .from('products')
    .insert([{
      seller_id: sellerId, title: title.trim(), slug, price: Number(price),
      compare_at_price: compareAtPrice ? Number(compareAtPrice) : null,
      cost_price: costPrice ? Number(costPrice) : null,
      description: description.trim(), category: category.trim() || 'General',
      photo_urls: photoUrls, track_stock: finalTrackStock, stock_count: finalStockCount,
      variants: variants, free_delivery: Boolean(freeDelivery)
    }])
    .select().single();
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
  if (payload.free_delivery !== undefined) payload.free_delivery = Boolean(payload.free_delivery);
  if (payload.track_stock !== undefined) {
    payload.track_stock = Boolean(payload.track_stock);
    if (payload.track_stock === false) payload.stock_count = null;
  }
  if (payload.stock_count !== undefined && payload.stock_count !== null) {
    payload.stock_count = Math.max(0, parseInt(payload.stock_count, 10) || 0);
  }
  const { data, error } = await supabase
    .from('products').update(payload).eq('id', productId).select().single();
  if (error) throw error;
  return data;
}

export async function updateProductStock(productId, newStock) {
  const parsedStock = Math.max(0, parseInt(newStock, 10) || 0);
  const { data, error } = await supabase
    .from('products').update({ stock_count: parsedStock, track_stock: true })
    .eq('id', productId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(productId) {
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw error;
}

// BUYER-SAFE — reads via SECURITY DEFINER RPC
export async function fetchProductBySlug(sellerId, slug) {
  if (!sellerId || !slug) return null;
  const { data, error } = await supabase.rpc('get_public_product_by_slug', {
    p_seller_id: sellerId,
    p_slug: slug,
  });
  if (error) return null;
  return data;
}

// ----------------------------------------------------
// CUSTOMERS (per-seller, seller-side operations)
// ----------------------------------------------------

export async function findCustomerByPhone(sellerId, phone) {
  if (!sellerId) return null;
  const cleanPhone = normalizeSLPhone(phone);
  if (!cleanPhone || cleanPhone.length < 9) return null;
  const { data, error } = await supabase
    .from('customers').select('*').eq('seller_id', sellerId).eq('phone', cleanPhone).maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function getOrCreateCustomer({ sellerId, phone, secondaryPhone = '', name, city, deliveryAddress, district = '' }) {
  const cleanPhone = normalizeSLPhone(phone);
  const cleanSecondary = secondaryPhone ? normalizeSLPhone(secondaryPhone) : '';
  const { data: existing } = await supabase
    .from('customers').select('*').eq('seller_id', sellerId).eq('phone', cleanPhone).maybeSingle();
  if (existing) {
    const { data: updated } = await supabase
      .from('customers').update({
        name: name?.trim() || existing.name,
        secondary_phone: cleanSecondary || existing.secondary_phone,
        city: city?.trim() || existing.city,
        delivery_address: deliveryAddress?.trim() || existing.delivery_address,
        district: district?.trim() || existing.district
      }).eq('id', existing.id).select().single();
    return updated || existing;
  }
  const { data: created, error } = await supabase
    .from('customers')
    .insert([{
      seller_id: sellerId, phone: cleanPhone, secondary_phone: cleanSecondary,
      name: name?.trim() || 'New Customer', city: city?.trim() || '',
      delivery_address: deliveryAddress?.trim() || '', district: district?.trim() || ''
    }]).select().single();
  if (error) throw error;
  return created;
}

export async function fetchCustomers(sellerId) {
  if (!sellerId) return [];
  const { data, error } = await supabase
    .from('customers').select('*').eq('seller_id', sellerId)
    .order('total_orders', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateCustomer(customerId, updates) {
  const payload = { ...updates };
  if (payload.phone) payload.phone = normalizeSLPhone(payload.phone);
  if (payload.secondary_phone) payload.secondary_phone = normalizeSLPhone(payload.secondary_phone);
  const { data, error } = await supabase
    .from('customers').update(payload).eq('id', customerId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCustomerSafe(customerId) {
  const { data: linkedOrders, error: checkErr } = await supabase
    .from('orders').select('id').eq('customer_id', customerId);
  if (checkErr) throw checkErr;
  if (linkedOrders && linkedOrders.length > 0) {
    await supabase.from('orders').update({ customer_id: null }).eq('customer_id', customerId);
  }
  const { error } = await supabase.from('customers').delete().eq('id', customerId);
  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// ORDERS
// ----------------------------------------------------

export async function fetchOrders(sellerId) {
  const { data, error } = await supabase
    .from('orders').select('*, customers(*)').eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchOrderByUuid(orderId) {
  const { data, error } = await supabase
    .from('orders').select('*, sellers(*), customers(*)')
    .eq('id', orderId).single();
  if (error) throw error;
  return data;
}

// BUYER-SAFE — requires order id + verification token
export async function fetchBuyerOrder(orderId, token) {
  if (!orderId || !token) throw new Error('Order not found');
  const { data, error } = await supabase.rpc('buyer_get_order', {
    p_order_id: orderId,
    p_token: token,
  });
  if (error) throw error;
  if (!data) throw new Error('Order not found');
  return { ...data.order, sellers: data.seller };
}

export async function createOrder({
  sellerId, customerName, customerPhone, secondaryPhone = '',
  deliveryAddress, city, district, items, deliveryFee = 0,
  paymentMethod = 'COD', source = 'manual_pos', autoConfirm = false
}) {
  const cleanPhone = normalizeSLPhone(customerPhone);
  const cleanSecondary = secondaryPhone ? normalizeSLPhone(secondaryPhone) : '';
  if (!isValidSLPhone(cleanPhone)) {
    throw new Error('Valid 10-digit Sri Lankan phone number is required.');
  }
  const decrementedItems = [];
  try {
    for (const item of items) {
      if (!item.id) continue;
      const qty = Number(item.quantity) || 1;
      const { data: result, error: rpcErr } = await supabase.rpc(
        'decrement_product_stock', { p_product_id: item.id, p_quantity: qty });
      if (rpcErr) {
        for (const d of decrementedItems) {
          await supabase.rpc('restore_product_stock', { p_product_id: d.productId, p_quantity: d.qty });
        }
        const msg = rpcErr.message || 'Item is no longer available';
        throw new Error(msg.replace(/^.*?:\s*/, ''));
      }
      if (result?.decremented) decrementedItems.push({ productId: item.id, qty });
    }
  } catch (stockErr) { throw stockErr; }
  const customer = await getOrCreateCustomer({
    sellerId, phone: cleanPhone, secondaryPhone: cleanSecondary,
    name: customerName, city, deliveryAddress, district
  });
  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * (Number(item.quantity) || 1)), 0);
  const totalAmount = subtotal + Number(deliveryFee);
  const { data: codeResult, error: codeErr } = await supabase.rpc('next_order_code', { p_seller_id: sellerId });
  if (codeErr) {
    for (const d of decrementedItems) {
      await supabase.rpc('restore_product_stock', { p_product_id: d.productId, p_quantity: d.qty });
    }
    throw new Error('Failed to allocate order code: ' + codeErr.message);
  }
  const orderCode = String(codeResult);
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert([{
      order_code: orderCode, seller_id: sellerId, customer_id: customer.id,
      customer_name: customerName.trim(), customer_phone: cleanPhone,
      secondary_phone: cleanSecondary, delivery_address: deliveryAddress.trim(),
      city: city.trim(), district: district ? district.trim() : '',
      items, subtotal, delivery_fee: Number(deliveryFee), total_amount: totalAmount,
      advance_paid: (paymentMethod === 'Bank' && source !== 'storefront' && source !== 'quick_order') ? totalAmount : 0,
      cod_balance: paymentMethod === 'COD' ? totalAmount : 0,
      payment_method: paymentMethod,
      payment_status: (paymentMethod === 'Bank' && (source === 'storefront' || source === 'quick_order'))
        ? 'Awaiting Payment'
        : (paymentMethod === 'Bank' ? 'Paid' : 'Unpaid'),
      status: 'received', source,
      buyer_confirmed: autoConfirm,
      buyer_confirmed_at: autoConfirm ? new Date().toISOString() : null
    }]).select().single();
  if (orderErr) {
    for (const d of decrementedItems) {
      await supabase.rpc('restore_product_stock', { p_product_id: d.productId, p_quantity: d.qty });
    }
    throw orderErr;
  }
  for (const item of items) {
    if (!item.id) continue;
    const { data: currentProd } = await supabase
      .from('products').select('title, stock_count, track_stock').eq('id', item.id).single();
    if (currentProd && currentProd.track_stock) {
      const remaining = Number(currentProd.stock_count) || 0;
      if (remaining === 0) {
        await createNotification(sellerId, {
          title: 'Product sold out',
          message: `"${currentProd.title}" is now out of stock. Restock or hide it to avoid new orders.`,
          type: 'stock', link: '/products'
        });
      } else if (remaining <= 3) {
        await createNotification(sellerId, {
          title: 'Low stock alert',
          message: `"${currentProd.title}" — only ${remaining} left in inventory.`,
          type: 'stock', link: '/products'
        });
      }
    }
  }
  await createNotification(sellerId, {
    title: `New Order #${order.order_code || order.id.slice(0, 4)}`,
    message: `${order.customer_name} placed an order for ${formatLKR(order.total_amount)} (${order.payment_method}).`,
    type: 'order', link: `/orders/${order.id}`
  });
  return order;
}

// BUYER-SAFE — server validates everything
export async function createBuyerOrder({
  sellerId, customerName, customerPhone, secondaryPhone = '',
  deliveryAddress, city, district, items, paymentMethod = 'COD', source = 'storefront'
}) {
  const { data, error } = await supabase.rpc('buyer_create_order_secure', {
    p_seller_id: sellerId,
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_secondary_phone: secondaryPhone,
    p_delivery_address: deliveryAddress,
    p_city: city,
    p_district: district,
    p_items: items.map((i) => ({
      id: i.id,
      quantity: Number(i.quantity) || 1,
      size: i.chosenSize || i.size || null,
      color: i.chosenColor || i.color || null,
    })),
    p_payment_method: paymentMethod,
    p_source: source,
  });
  if (error) {
    const msg = error.message || 'Failed to place order';
    throw new Error(msg.replace(/^.*?:\s*/, ''));
  }
  if (!data?.order) throw new Error('Failed to place order');
  return data.order;
}

/**
 * updateOrderStatus — derives timestamps from status so reverting via Undo
 * doesn't leave a phantom "Packed" or "Dispatched" event on the timeline.
 */
export async function updateOrderStatus(orderId, nextStatus, { courierName = null, trackingNumber = null } = {}) {
  const updates = { status: nextStatus };

  if (nextStatus === 'received') {
    updates.packed_at = null;
    updates.dispatched_at = null;
    updates.delivered_at = null;
    updates.courier_name = null;
    updates.tracking_number = null;
  } else if (nextStatus === 'packed') {
    updates.packed_at = new Date().toISOString();
    updates.dispatched_at = null;
    updates.delivered_at = null;
  } else if (nextStatus === 'dispatched') {
    updates.dispatched_at = new Date().toISOString();
    updates.delivered_at = null;
    if (courierName) updates.courier_name = courierName;
    if (trackingNumber) updates.tracking_number = trackingNumber;
  } else if (nextStatus === 'delivered') {
    updates.delivered_at = new Date().toISOString();
    updates.payment_status = 'Paid';
    updates.cod_balance = 0;
  }

  const { data, error } = await supabase
    .from('orders').update(updates).eq('id', orderId).select().single();
  if (error) throw error;
  return data;
}

/**
 * updateOrderAddressAsSeller — seller-side edit of delivery details on their
 * own order. No token needed (RLS scopes it to their seller_id). Distinct
 * from updateBuyerOrderAddress, which is the token-gated buyer RPC.
 */
export async function updateOrderAddressAsSeller(orderId, {
  customerName, customerPhone, secondaryPhone = '',
  deliveryAddress, city, district,
}) {
  const cleanPhone = normalizeSLPhone(customerPhone);
  if (!isValidSLPhone(cleanPhone)) {
    throw new Error('Please enter a valid 10-digit Sri Lankan phone number (07XXXXXXXX).');
  }
  const cleanSecondary = secondaryPhone ? normalizeSLPhone(secondaryPhone) : '';
  const { data, error } = await supabase
    .from('orders')
    .update({
      customer_name: customerName.trim(),
      customer_phone: cleanPhone,
      secondary_phone: cleanSecondary,
      delivery_address: deliveryAddress.trim(),
      city: city.trim(),
      district: district.trim(),
    })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function confirmOrderAsBuyer(orderId, token) {
  const { data, error } = await supabase.rpc('buyer_confirm_order', {
    p_order_id: orderId, p_token: token,
  });
  if (error) throw error;
  return data.order;
}

export async function deleteOrdersBatch(orderIds) {
  if (!orderIds || !orderIds.length) return;
  for (const orderId of orderIds) {
    const { data: order } = await supabase
      .from('orders').select('items, status').eq('id', orderId).single();
    if (order && order.status !== 'delivered' && order.status !== 'canceled') {
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        if (item.id) {
          await supabase.rpc('restore_product_stock', {
            p_product_id: item.id, p_quantity: Number(item.quantity) || 1,
          });
        }
      }
    }
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) throw error;
  }
  return true;
}

// ----------------------------------------------------
// SUPER-ADMIN MANAGEMENT
// ----------------------------------------------------

export async function fetchAllSellersAdmin() {
  const { data, error } = await supabase
    .from('sellers').select('*, orders(id, total_amount, status)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function extendSubscription(sellerId, daysToAdd) {
  const { data: current, error: fetchErr } = await supabase
    .from('sellers').select('subscription_expires_at').eq('id', sellerId).single();
  if (fetchErr) throw fetchErr;
  const oldExpiry = current.subscription_expires_at;
  const baseDate = oldExpiry && new Date(oldExpiry) > new Date() ? new Date(oldExpiry) : new Date();
  baseDate.setDate(baseDate.getDate() + Number(daysToAdd));
  const newExpiry = baseDate.toISOString();
  const { data, error } = await supabase
    .from('sellers')
    .update({ subscription_status: 'active', subscription_expires_at: newExpiry })
    .eq('id', sellerId).select().single();
  if (error) throw error;
  const adminSellerId = await getCurrentAdminSellerId();
  await logSubscriptionEvent({
    sellerId, adminSellerId, eventType: 'extend',
    daysAdded: Number(daysToAdd), oldExpiry, newExpiry,
  });
  const expiryDisplay = new Date(newExpiry).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  await createNotification(sellerId, {
    title: 'Subscription renewed',
    message: `Your access has been extended by ${daysToAdd} day${daysToAdd === 1 ? '' : 's'}. New expiry: ${expiryDisplay}.`,
    type: 'verification', link: '/dashboard',
  });
  return data;
}

export async function setCustomSubscriptionExpiry(sellerId, customIsoDate) {
  const { data: current } = await supabase
    .from('sellers').select('subscription_expires_at').eq('id', sellerId).single();
  const oldExpiry = current?.subscription_expires_at;
  const newDate = new Date(customIsoDate);
  const newExpiry = newDate.toISOString();
  const { data, error } = await supabase
    .from('sellers')
    .update({ subscription_status: newDate > new Date() ? 'active' : 'expired', subscription_expires_at: newExpiry })
    .eq('id', sellerId).select().single();
  if (error) throw error;
  const adminSellerId = await getCurrentAdminSellerId();
  await logSubscriptionEvent({ sellerId, adminSellerId, eventType: 'set_expiry', oldExpiry, newExpiry });
  return data;
}

export async function toggleStoreActiveStatus(sellerId, currentStatus) {
  const nextStatus = !currentStatus;
  const { data, error } = await supabase
    .from('sellers')
    .update({ is_active: nextStatus, subscription_status: nextStatus ? 'active' : 'suspended' })
    .eq('id', sellerId).select().single();
  if (error) throw error;
  const adminSellerId = await getCurrentAdminSellerId();
  await logSubscriptionEvent({
    sellerId, adminSellerId, eventType: nextStatus ? 'reactivate' : 'suspend',
  });
  return data;
}

export async function deleteSellerAdmin(sellerId) {
  const { error } = await supabase.from('sellers').delete().eq('id', sellerId);
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
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function getPushStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription && Notification.permission === 'granted') return 'subscribed';
    return 'not_subscribed';
  } catch { return 'unsupported'; }
}

export async function subscribeToPush(sellerId, vapidPublicKey) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported on this device.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was denied.');
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }
  const subJson = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      seller_id: sellerId, endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh, auth: subJson.keys.auth,
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
      body: { seller_id: sellerId, title, message, link, order_id: orderId },
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
    .from('orders').select('total_amount').eq('id', orderId).single();
  if (fetchErr) throw fetchErr;
  const { data, error } = await supabase
    .from('orders')
    .update({
      payment_status: 'Paid',
      advance_paid: Number(order.total_amount) || 0,
      cod_balance: 0,
      payment_confirmed_at: new Date().toISOString(),
    })
    .eq('id', orderId).select().single();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------
// BUYER SELF-SERVICE (token-gated)
// ----------------------------------------------------

export async function updateBuyerOrderAddress(orderId, token, {
  customerName, customerPhone, secondaryPhone = '',
  deliveryAddress, city, district,
}) {
  const { data, error } = await supabase.rpc('buyer_update_address', {
    p_order_id: orderId,
    p_token: token,
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_secondary_phone: secondaryPhone,
    p_delivery_address: deliveryAddress,
    p_city: city,
    p_district: district,
  });
  if (error) {
    const msg = error.message || 'Failed to update address';
    throw new Error(msg.replace(/^.*?:\s*/, ''));
  }
  return data.order;
}

export async function cancelOrderAsBuyer(orderId, token) {
  const { data, error } = await supabase.rpc('buyer_cancel_order', {
    p_order_id: orderId, p_token: token,
  });
  if (error) {
    const msg = error.message || 'Failed to cancel order';
    throw new Error(msg.replace(/^.*?:\s*/, ''));
  }
  return data.order;
}

// ----------------------------------------------------
// BULK ORDER STATUS
// ----------------------------------------------------

export async function bulkUpdateOrderStatus(orderIds, nextStatus) {
  if (!orderIds || !orderIds.length) return { updatedOrders: [], skipped: 0 };
  if (nextStatus !== 'packed') throw new Error('Bulk status changes are currently only supported for "packed".');
  const { data: orders, error: fetchErr } = await supabase
    .from('orders').select('id, status, buyer_confirmed, payment_method, payment_status')
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
  if (!eligible.length) return { updatedOrders: [], skipped: (orders || []).length };
  const eligibleIds = eligible.map((o) => o.id);
  const { data, error } = await supabase
    .from('orders').update({ status: nextStatus, packed_at: new Date().toISOString() }).in('id', eligibleIds).select();
  if (error) throw error;
  return { updatedOrders: data || [], skipped: (orders || []).length - (data?.length || 0) };
}

// ----------------------------------------------------
// BUYER TRUST NETWORK
// ----------------------------------------------------

const FLAG_REASON_LABELS = {
  no_answer: "Buyer didn't answer phone",
  refused: 'Buyer refused delivery',
  wrong_address: 'Wrong / fake address',
  changed_mind: 'Buyer changed mind',
  other: 'Other reason',
};

export function flagReasonLabel(reason) {
  return FLAG_REASON_LABELS[reason] || reason;
}

export async function createBuyerFlag({ sellerId, orderId, phone, reason, note = '' }) {
  const cleanPhone = normalizeSLPhone(phone);
  if (!cleanPhone || cleanPhone.length < 9) throw new Error('Invalid phone number for flagging.');
  if (!reason) throw new Error('A reason is required.');
  const { data, error } = await supabase
    .from('buyer_flags')
    .insert([{
      seller_id: sellerId, order_id: orderId,
      phone: cleanPhone, reason, note: note.trim() || null,
    }])
    .select().single();
  if (error) {
    if (error.code === '23505') throw new Error('This order has already been flagged.');
    throw error;
  }
  return data;
}

export async function getBuyerTrust(phone) {
  if (!phone) return null;
  const cleanPhone = normalizeSLPhone(phone);
  if (!cleanPhone || cleanPhone.length < 9) return null;
  const { data, error } = await supabase.rpc('get_buyer_trust', { p_phone: cleanPhone });
  if (error) { console.warn('Trust lookup failed:', error.message); return null; }
  return data;
}

export async function getBulkBuyerTrust(phones) {
  if (!phones || !phones.length) return {};
  const cleaned = Array.from(new Set(
    phones.map((p) => normalizeSLPhone(p)).filter((p) => p && p.length >= 9)
  ));
  if (!cleaned.length) return {};
  const { data, error } = await supabase.rpc('get_bulk_buyer_trust', { p_phones: cleaned });
  if (error) { console.warn('Bulk trust lookup failed:', error.message); return {}; }
  return data || {};
}

export async function deleteBuyerFlag(flagId) {
  if (!flagId) return;
  const { error } = await supabase.from('buyer_flags').delete().eq('id', flagId);
  if (error) throw error;
}

// ----------------------------------------------------
// SERVER-SIDE PAGINATION
// ----------------------------------------------------

export async function getOrderCounts(sellerId, search = '') {
  if (!sellerId) return { active: 0, received: 0, packed: 0, dispatched: 0, delivered: 0, canceled: 0 };
  const { data, error } = await supabase.rpc('get_order_counts', {
    p_seller_id: sellerId,
    p_search: search || null,
  });
  if (error) {
    console.warn('getOrderCounts failed:', error.message);
    return { active: 0, received: 0, packed: 0, dispatched: 0, delivered: 0, canceled: 0 };
  }
  return data || { active: 0, received: 0, packed: 0, dispatched: 0, delivered: 0, canceled: 0 };
}

export async function fetchOrdersPage(sellerId, { tab = 'active', search = '', limit = 50, offset = 0 } = {}) {
  if (!sellerId) return { orders: [], total: 0 };
  const { data, error } = await supabase.rpc('get_orders_page', {
    p_seller_id: sellerId, p_tab: tab, p_search: search || null,
    p_limit: limit, p_offset: offset,
  });
  if (error) { console.warn('fetchOrdersPage failed:', error.message); throw error; }
  return { orders: data?.orders || [], total: data?.total || 0 };
}

export async function getDashboardSummary(sellerId, timeframe = 'today') {
  if (!sellerId) {
    return {
      total_sales: 0, order_count: 0, avg_order: 0,
      pipeline_to_process: 0, pipeline_packed: 0,
      pipeline_in_transit: 0, pipeline_delivered: 0, waiting_on_buyer: 0,
    };
  }
  const { data, error } = await supabase.rpc('get_dashboard_summary', {
    p_seller_id: sellerId, p_timeframe: timeframe,
  });
  if (error) {
    console.warn('getDashboardSummary failed:', error.message);
    return {
      total_sales: 0, order_count: 0, avg_order: 0,
      pipeline_to_process: 0, pipeline_packed: 0,
      pipeline_in_transit: 0, pipeline_delivered: 0, waiting_on_buyer: 0,
    };
  }
  return data;
}

export async function fetchRecentOrders(sellerId, limit = 5) {
  if (!sellerId) return [];
  const { data, error } = await supabase
    .from('orders').select('*').eq('seller_id', sellerId)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

// ----------------------------------------------------
// SUBSCRIPTION AUDIT TRAIL
// ----------------------------------------------------

async function getCurrentAdminSellerId() {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return null;
    const { data: adminSeller } = await supabase
      .from('sellers').select('id').eq('auth_user_id', userId).maybeSingle();
    return adminSeller?.id || null;
  } catch { return null; }
}

export async function logSubscriptionEvent({
  sellerId, adminSellerId = null, eventType,
  daysAdded = null, oldExpiry = null, newExpiry = null, notes = null,
}) {
  try {
    await supabase.from('subscription_events').insert([{
      seller_id: sellerId, admin_seller_id: adminSellerId,
      event_type: eventType, days_added: daysAdded,
      old_expiry: oldExpiry, new_expiry: newExpiry, notes,
    }]);
  } catch (err) {
    console.warn('[audit] Failed to log subscription event:', err?.message || err);
  }
}

export async function fetchSubscriptionHistory(sellerId, limit = 50) {
  if (!sellerId) return [];
  const { data, error } = await supabase
    .from('subscription_events').select('*').eq('seller_id', sellerId)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) { console.warn('Failed to fetch subscription history:', error.message); return []; }
  return data || [];
}

// ----------------------------------------------------
// DATA EXPORT
// ----------------------------------------------------

export async function fetchAllOrdersForExport(sellerId, onProgress) {
  if (!sellerId) return [];
  const CHUNK = 500;
  let offset = 0; let total = null; const all = [];
  while (true) {
    const { data, error } = await supabase
      .from('orders').select('*').eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + CHUNK - 1);
    if (error) throw error;
    const batch = data || [];
    all.push(...batch);
    if (total === null) {
      const { count } = await supabase
        .from('orders').select('id', { count: 'exact', head: true }).eq('seller_id', sellerId);
      total = count || 0;
    }
    if (typeof onProgress === 'function') onProgress(all.length, total);
    if (batch.length < CHUNK) break;
    offset += CHUNK;
  }
  return all;
}

export async function fetchAllCustomersForExport(sellerId) {
  if (!sellerId) return [];
  const { data, error } = await supabase
    .from('customers').select('*').eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ----------------------------------------------------
// PER-SELLER PRICING
// ----------------------------------------------------

export async function updateSellerFee(sellerId, newFee) {
  const fee = Math.max(0, Math.round(Number(newFee) || 0));
  if (fee === 0) throw new Error('Fee must be greater than 0.');
  const { data: current, error: fetchErr } = await supabase
    .from('sellers').select('monthly_fee').eq('id', sellerId).single();
  if (fetchErr) throw fetchErr;
  const oldFee = current?.monthly_fee;
  const { data, error } = await supabase
    .from('sellers').update({ monthly_fee: fee }).eq('id', sellerId).select().single();
  if (error) throw error;
  const adminSellerId = await getCurrentAdminSellerId();
  await logSubscriptionEvent({
    sellerId, adminSellerId, eventType: 'fee_change',
    notes: `Fee changed from Rs. ${oldFee ?? 'default'} to Rs. ${fee}`,
  });
  return data;
}