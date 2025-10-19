export type PriceTier = {
  minPeople: number;
  price: number;
};

export type Destination = {
  id: number;
  slug?: string;
  title: string;
  priceTiers: PriceTier[];
  duration: number;
  imageUrl: string;
  galleryImages: string[];
  // Cloudinary public ids for lifecycle management (nullable for legacy rows)
  imagePublicId?: string | null;
  galleryPublicIds?: string[] | null;
  longDescription: string;
  minPeople: number;
  itinerary: { day: number; title: string; description: string; }[];
  mapCoordinates: { lat: number; lng: number; };
  facilities: string[];
  categories: string[];
};

export type BlogPost = {
  id: number;
  slug?: string;
  title: string;
  imageUrl: string;
  category: string;
  author: string;
  date: string;
  content: string;
};

export type Page = 'home' | 'destinations' | 'blog' | 'contact' | 'search' | 'destinationDetail' | 'blogDetail' | 'wishlist' | 'admin';


export type HeroSlide = {
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string;
};

export type AppSettings = {
  theme: 'light' | 'dark';
  accentColor: string;
  brandName: string;
  tagline: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  favicon16Url: string;
  favicon192Url: string;
  favicon512Url: string;
  email: string;
  address: string;
  whatsappNumber: string;
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  heroSlides: HeroSlide[];
};

export type OrderStatus = 'Baru' | 'Menunggu Pembayaran' | 'Siap Jalan' | 'Selesai' | 'Dibatalkan';

export type Order = {
  id: number;
  orderDate: string; // ISO date or date string
  customerName: string;
  customerPhone: string;
  destinationId?: number;
  destinationTitle?: string;
  departureDate?: string | null; // YYYY-MM-DD
  participants: number;
  totalPrice: number;
  status: OrderStatus;
  paymentStatus?: 'DP' | 'Lunas';
  notes?: string;
};
