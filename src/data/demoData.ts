import {
  DiningTable,
  FoodCategory,
  GroupOrderSession,
  GroupOrderStatus,
  MenuItem,
  Order,
  TableStatus,
  TableZone,
} from '../types';
import { DEFAULT_DEMO_ORDERS } from './defaultOrders';

import canteenHeroBanner from '../assets/images/canteen_hero_banner_1792913189353.jpg';
import menuSamosaImg from '../assets/images/menu_samosa_1792913191161.jpg';
import menuVegSandwichImg from '../assets/images/menu_veg_sandwich_1792913192942.jpg';
import menuMasalaDosaImg from '../assets/images/menu_masala_dosa_1792913214963.jpg';
import menuColdCoffeeImg from '../assets/images/menu_cold_coffee_1792913214656.jpg';

export const HERO_IMAGE_URL = canteenHeroBanner;

export const DEMO_RESERVATION_SLOTS: string[] = [
  '12:00 PM – 12:30 PM',
  '12:30 PM – 1:00 PM',
  '1:00 PM – 1:30 PM',
  '1:30 PM – 2:00 PM',
  '4:00 PM – 4:30 PM',
];

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: 'item-samosa',
    name: 'Samosa',
    price: 20,
    category: FoodCategory.Snacks,
    description:
      'Two crisp, golden flaky pastries stuffed with spiced potato and green peas, served hot with mint-coriander and tamarind chutneys.',
    prepMinutes: 3,
    calories: 210,
    stock: 42,
    isAvailable: true,
    imageUrl: menuSamosaImg,
    dietaryNote: 'Pure Veg',
  },
  {
    id: 'item-veg-sandwich',
    name: 'Veg Sandwich',
    price: 40,
    category: FoodCategory.Sandwiches,
    description:
      'Bombay-style toasted artisan bread layered with garden cucumber, vine tomato, melted cheddar, and house green herb chutney.',
    prepMinutes: 5,
    calories: 295,
    stock: 28,
    isAvailable: true,
    imageUrl: menuVegSandwichImg,
    dietaryNote: 'Pure Veg',
  },
  {
    id: 'item-masala-dosa',
    name: 'Masala Dosa',
    price: 50,
    category: FoodCategory.SouthIndian,
    description:
      'Crispy fermented rice and lentil crepe filled with tempered potato masala, served alongside fresh coconut chutney and piping hot sambar.',
    prepMinutes: 7,
    calories: 360,
    stock: 24,
    isAvailable: true,
    imageUrl: menuMasalaDosaImg,
    dietaryNote: 'Pure Veg · Gluten Friendly',
  },
  {
    id: 'item-cold-coffee',
    name: 'Cold Coffee',
    price: 30,
    category: FoodCategory.Beverages,
    description:
      'Chilled campus-favorite Arabica espresso blended smooth with creamy milk, ice, caramel drizzle, and light cocoa froth.',
    prepMinutes: 4,
    calories: 190,
    stock: 35,
    isAvailable: true,
    imageUrl: menuColdCoffeeImg,
    dietaryNote: 'Chilled Beverage',
  },
];

export const INITIAL_DEMO_ORDERS: Order[] = DEFAULT_DEMO_ORDERS;

export const INITIAL_DINING_TABLES: DiningTable[] = [
  {
    id: 'table-01',
    label: 'Table 01',
    capacity: 2,
    zone: TableZone.WindowBay,
    features: 'North Garden Window · AC · Power Outlet',
    status: TableStatus.Available,
  },
  {
    id: 'table-02',
    label: 'Table 02',
    capacity: 4,
    zone: TableZone.MainCommons,
    features: 'Central Commons · Near Pickup Counter',
    status: TableStatus.Occupied,
    occupantName: 'Aarav M. & Group',
    timeSlot: '12:00 PM – 12:30 PM',
    partySize: 3,
  },
  {
    id: 'table-03',
    label: 'Table 03',
    capacity: 4,
    zone: TableZone.MainCommons,
    features: 'Sunlit Corner · Laptop Friendly',
    status: TableStatus.Available,
  },
  {
    id: 'table-04',
    label: 'Table 04',
    capacity: 6,
    zone: TableZone.StudyBooths,
    features: 'Group Study Booth · Dual AC & USB-C',
    status: TableStatus.Reserved,
    occupantName: 'Rohan K.',
    timeSlot: '12:30 PM – 1:00 PM',
    partySize: 4,
    reservationId: 'RES-299',
    isCurrentUserReservation: false,
  },
];

export const INITIAL_GROUP_ORDERS: GroupOrderSession[] = [
  {
    id: 'grp-sample-4821',
    code: 'GRP-4821',
    title: 'CS Lab Break Group Order',
    organizerName: 'Kabir Malhotra',
    organizerRollNumber: 'CS24B055',
    status: GroupOrderStatus.Open,
    createdAt: '12:24 PM',
    notes: 'Pack chutneys together on one tray',
    participants: [
      {
        id: 'part-kabir',
        name: 'Kabir Malhotra',
        isOrganizer: true,
        joinedAt: '12:24 PM',
        items: [
          { menuItemId: 'item-veg-sandwich', quantity: 1 },
          { menuItemId: 'item-cold-coffee', quantity: 1 },
        ],
      },
      {
        id: 'part-riya',
        name: 'Riya Sen',
        isOrganizer: false,
        joinedAt: '12:25 PM',
        items: [{ menuItemId: 'item-samosa', quantity: 2 }],
      },
    ],
  },
];
