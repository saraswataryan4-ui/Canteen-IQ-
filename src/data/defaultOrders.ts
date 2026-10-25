import type { Order, OrderStatus } from '../types.ts';

export const ORDER_STATUS_LIST: readonly OrderStatus[] = [
  'Received' as OrderStatus,
  'Preparing' as OrderStatus,
  'Ready' as OrderStatus,
  'Collected' as OrderStatus,
  'Delivered' as OrderStatus,
];

// Clean initial orders collection — real orders are created dynamically through customer checkout or Cloud Firestore
export const DEFAULT_DEMO_ORDERS: Order[] = [];

export function cloneDefaultDemoOrders(): Order[] {
  return [];
}
