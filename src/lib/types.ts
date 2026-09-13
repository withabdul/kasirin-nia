/* Plain, JSON-serializable shapes shared by server functions and the client. */

export type Product = {
  id: string
  sku: string
  name: string
  category: string
  price: number
  cost: number
  stock: number
  unit: string
  active: boolean
  createdAt: string
}

export type ProductInput = {
  sku: string
  name: string
  category: string
  price: number
  cost: number
  stock: number
  unit: string
  active: boolean
}

export type CustomerNote = {
  id: string
  text: string
  createdAt: string
}

export type Customer = {
  id: string
  name: string
  phone: string
  email: string
  tier: string
  tags: string[]
  notes: CustomerNote[]
  createdAt: string
  orderCount: number
  totalSpent: number
  lastOrderAt: string | null
}

export type CustomerInput = {
  name: string
  phone: string
  email: string
  tier: string
  tags: string[]
}

export type OrderItem = {
  id: string
  productId: string | null
  name: string
  sku: string
  price: number
  qty: number
}

export type Order = {
  id: string
  code: string
  createdAt: string
  subtotal: number
  discount: number
  total: number
  payment: string
  paid: number
  customerId: string | null
  customerName: string | null
  note: string
  items: OrderItem[]
}

export type CheckoutInput = {
  items: { productId: string; qty: number }[]
  discount: number
  payment: string
  paid: number
  customerId: string | null
  note: string
}

export type StoreSettings = {
  storeName: string
  outlet: string
  cashier: string
  lowStockThreshold: number
  footer: string
}

export type CartLine = {
  productId: string
  name: string
  sku: string
  price: number
  qty: number
  stock: number
  unit: string
}

export type Stats = {
  todayCount: number
  revenueToday: number
  revenueAll: number
  basket: number
  marginToday: number
  series: { key: string; label: string; date: string; total: number }[]
  top: { name: string; qty: number; revenue: number }[]
  lowStock: Product[]
  recent: Order[]
  productCount: number
  customerCount: number
}
