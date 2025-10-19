/**
 * Supabase client wrapper.
 * Exports a getSupabaseClient function to avoid creating a client at module eval time in some environments.
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in environment.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    // Instead of throwing synchronously (which breaks non-supabase flows),
    // throw an error only when the caller intentionally wants a client.
    // Consumers should check env vars before calling if they need to run
    // in environments where Supabase isn't configured.
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  }
  client = createClient(url, anonKey)
  return client
}

export default getSupabaseClient

// --- Convenience CRUD helpers ---
export type SupabaseDestination = any;
export type SupabaseBlogPost = any;

export async function fetchDestinations(): Promise<SupabaseDestination[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('destinations').select('*');
  if (error) throw error;
  // Map database column names (lowercased) back to the app's camelCase shape
  const mapRow = (row: any) => ({
    ...row,
    imageUrl: row.imageurl ?? row.imageUrl ?? '',
  galleryImages: row.galleryimages ?? row.galleryImages ?? row.gallery_images ?? null,
  imagePublicId: row.image_public_id ?? row.imagepublicid ?? row.imagepublic_id ?? null,
  galleryPublicIds: row.gallery_public_ids ?? row.gallerypublicids ?? row.gallery_publicids ?? null,
    longDescription: row.longdescription ?? row.longDescription ?? '',
    priceTiers: row.pricetiers ?? row.priceTiers ?? null,
    minPeople: row.minpeople ?? row.minPeople ?? null,
    mapCoordinates: row.mapcoordinates ?? row.mapCoordinates ?? null,
    created_at: row.created_at ?? row.createdAt ?? null,
  });
  return (data || []).map(mapRow);
}

export async function upsertDestination(dest: any): Promise<any> {
  // If running in a browser (client-side), prefer calling the server endpoint which
  // performs admin-validated upserts using the service_role key. This avoids RLS issues
  // when the client only has anon key.
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser) {
    try {
      // Try to get the current user session token so server can verify admin claim
      const supabase = getSupabaseClient();
      let sessionToken = '';
      try {
        const { data } = await supabase.auth.getSession();
        sessionToken = data?.session?.access_token || '';
      } catch (e) {
        sessionToken = '';
      }

      // If no session token is available in the browser, fail fast with a helpful message.
      // This avoids sending anonymous requests to the server which will return 401 and
      // makes it easier to debug the common "curl works but UI fails" scenario where
      // the user is logged in on a different origin or the session isn't present.
      if (!sessionToken) {
        throw new Error('Missing session token. Please login as admin and refresh the page before saving.');
      }

      const resp = await fetch('/api/upsert-destination', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(dest),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => null);
        // Do NOT fallback to client upsert (anonymous key) because of RLS.
        // Instead surface the server error so the UI can show a clear message.
        const errMsg = `[UPsert] server endpoint failed ${resp.status} ${text || ''}`;
        console.warn(errMsg);
        throw new Error(errMsg);
      }
      const json = await resp.json();
      const row = json?.data ?? json?.destination ?? null;
      if (row) {
        return {
          ...row,
          imageUrl: row.imageurl ?? row.imageUrl ?? '',
          galleryImages: row.galleryimages ?? row.galleryImages ?? row.gallery_images ?? null,
          longDescription: row.longdescription ?? row.longDescription ?? '',
          priceTiers: row.pricetiers ?? row.priceTiers ?? null,
          minPeople: row.minpeople ?? row.minPeople ?? null,
          mapCoordinates: row.mapcoordinates ?? row.mapCoordinates ?? null,
          created_at: row.created_at ?? row.createdAt ?? null,
        };
      }
    } catch (err) {
      console.warn('[UPsert] server endpoint call failed, falling back to client upsert', err);
    }
    // If we reach here, try client-side upsert as last resort (may fail due to RLS)
  }

  // Server-side / fallback behavior: perform direct Supabase upsert (useful for server calls)
  const supabase = getSupabaseClient();
  // PostgREST / Supabase stores unquoted column identifiers in lower-case.
  // Convert the payload keys to lower-case to match the created schema (e.g. galleryImages -> galleryimages).
  const payload: any = {};
  // Ensure we have a usable id for new rows. If frontend used id=0 for new items, generate a timestamp-based id.
  const idToUse = (dest && dest.id && dest.id !== 0) ? dest.id : Date.now();
  Object.keys(dest).forEach(k => {
    // keep the id as 'id' and ensure slug is set below
    const newKey = k === 'id' ? 'id' : k.toLowerCase();
    // map camelCase public id fields to DB column names
    if (k === 'imagePublicId') {
      payload['image_public_id'] = (dest as any)[k];
    } else if (k === 'galleryPublicIds') {
      payload['gallery_public_ids'] = (dest as any)[k];
    } else {
      payload[newKey] = (dest as any)[k];
    }
  });
  payload.id = idToUse;
  // Ensure slug exists in payload. If missing, generate one from title and id.
  const slugify = (input: string) => {
    if (!input) return String(idToUse);
    return input.toString().toLowerCase()
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 80);
  };
  if (!payload.slug || payload.slug === '') {
    payload.slug = `${idToUse}-${slugify(dest.title || dest.name || String(idToUse))}`;
  }
  const { data, error } = await supabase.from('destinations').upsert(payload, { onConflict: 'id' }).select();
  if (error) throw error;
  // Map created row back to camelCase for the app
  const row = data?.[0] ?? null;
  if (!row) return null;
  return {
    ...row,
    imageUrl: row.imageurl ?? row.imageUrl ?? '',
    galleryImages: row.galleryimages ?? row.galleryImages ?? row.gallery_images ?? null,
    longDescription: row.longdescription ?? row.longDescription ?? '',
    priceTiers: row.pricetiers ?? row.priceTiers ?? null,
    minPeople: row.minpeople ?? row.minPeople ?? null,
    mapCoordinates: row.mapcoordinates ?? row.mapCoordinates ?? null,
    created_at: row.created_at ?? row.createdAt ?? null,
  };
}

export async function deleteDestination(id: number): Promise<void> {
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser) {
    try {
      // Use server endpoint which verifies admin and deletes using service_role key
      const supabase = getSupabaseClient();
      let sessionToken = '';
      try { const { data } = await supabase.auth.getSession(); sessionToken = data?.session?.access_token || ''; } catch (e) { sessionToken = ''; }
      if (!sessionToken) throw new Error('Missing session token. Please login as admin and refresh the page before deleting.');

      const resp = await fetch('/api/delete-destination', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify({ id })
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => null);
        throw new Error(`[Delete] server endpoint failed ${resp.status} ${txt || ''}`);
      }
      return;
    } catch (err) {
      console.warn('[DELETE] server endpoint call failed, falling back to client delete', err);
      // Fall through to client delete below
    }
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from('destinations').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchBlogPosts(): Promise<SupabaseBlogPost[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('blog_posts').select('*');
  if (error) throw error;
  // Map common column names back to camelCase
  const mapRow = (row: any) => ({
    ...row,
    imageUrl: row.imageurl ?? row.imageUrl ?? '',
    created_at: row.created_at ?? row.createdAt ?? null,
  });
  return (data || []).map(mapRow);
}

// --- Laptops helpers (fetch, upsert, delete) ---
export async function fetchLaptops(opts?: { includeOutOfStock?: boolean }): Promise<any[]> {
  const supabase = getSupabaseClient();
  // By default, fetch only laptops that are in stock for public listing.
  // If opts.includeOutOfStock is true, return all laptops (used by admin pages).
  const query = supabase.from('laptops').select('*');
  const finalQuery = opts && opts.includeOutOfStock ? query : query.eq('in_stock', true);
  const { data, error } = await finalQuery;
  if (error) throw error;
  const mapRow = (row: any) => ({
    ...row,
    imageUrl: row.imageurl ?? row.imageUrl ?? '',
    galleryImages: row.galleryimages ?? row.galleryImages ?? row.gallery_images ?? null,
    imagePublicId: row.image_public_id ?? row.imagepublicid ?? null,
    galleryPublicIds: row.gallery_public_ids ?? row.gallerypublicids ?? row.gallery_publicids ?? null,
    // Specs and metadata mapping (snake_case -> camelCase)
    ram: row.ram ?? null,
    storage: row.storage ?? null,
    cpu: row.cpu ?? null,
    displayInch: row.display_inch ?? row.displayInch ?? row.displayinch ?? null,
    condition: row.condition ?? null,
  inStock: row.in_stock ?? row.inStock ?? null,
    grade: row.grade ?? null,
    features: row.features ?? null,
    accessories: row.accessories ?? null,
    created_at: row.created_at ?? row.createdAt ?? null,
  });
  return (data || []).map(mapRow);
}

export async function upsertLaptop(laptop: any): Promise<any> {
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser) {
    try {
      const supabase = getSupabaseClient();
      let sessionToken = '';
      try { const { data } = await supabase.auth.getSession(); sessionToken = data?.session?.access_token || ''; } catch (e) { sessionToken = ''; }
      if (!sessionToken) throw new Error('Missing session token. Please login as admin and refresh the page before saving.');

      const resp = await fetch('/api/upsert-laptop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify(laptop),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => null);
        const errMsg = `[UPsertLaptop] server endpoint failed ${resp.status} ${text || ''}`;
        console.warn(errMsg);
        throw new Error(errMsg);
      }
      const json = await resp.json();
      const row = json?.data ?? null;
      if (row) {
        return {
          ...row,
          imageUrl: row.imageurl ?? row.imageUrl ?? '',
          galleryImages: row.galleryimages ?? row.galleryImages ?? row.gallery_images ?? null,
          imagePublicId: row.image_public_id ?? row.imagepublicid ?? null,
          galleryPublicIds: row.gallery_public_ids ?? row.gallerypublicids ?? row.gallery_publicids ?? null,
          created_at: row.created_at ?? row.createdAt ?? null,
        };
      }
    } catch (err) {
      console.warn('[UPsertLaptop] server endpoint call failed, falling back to client upsert', err);
    }
    // fall through to client-side upsert as last resort
  }

  const supabase = getSupabaseClient();
  const payload: any = {};
  const idToUse = (laptop && laptop.id && laptop.id !== 0) ? laptop.id : Date.now();
  Object.keys(laptop).forEach(k => {
    if (k === 'imagePublicId') {
      payload['image_public_id'] = (laptop as any)[k];
    } else if (k === 'galleryPublicIds') {
      payload['gallery_public_ids'] = (laptop as any)[k];
    } else if (k === 'inStock') {
      payload['in_stock'] = (laptop as any)[k];
    } else {
      const newKey = k === 'id' ? 'id' : k.toLowerCase();
      payload[newKey] = (laptop as any)[k];
    }
  });
  payload.id = idToUse;
  // Ensure slug exists
  if (!payload.slug || payload.slug === '') {
    const slugify = (input: string) => {
      if (!input) return String(idToUse);
      return input.toString().toLowerCase()
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-')
        .slice(0, 80);
    };
    payload.slug = `${idToUse}-${slugify(laptop.name || laptop.title || String(idToUse))}`;
  }
  const { data, error } = await supabase.from('laptops').upsert(payload, { onConflict: 'id' }).select();
  if (error) throw error;
  const row = data?.[0] ?? null;
  if (!row) return null;
  return {
    ...row,
    imageUrl: row.imageurl ?? row.imageUrl ?? '',
    galleryImages: row.galleryimages ?? row.galleryImages ?? row.gallery_images ?? null,
    imagePublicId: row.image_public_id ?? row.imagepublicid ?? null,
    galleryPublicIds: row.gallery_public_ids ?? row.gallerypublicids ?? row.gallery_publicids ?? null,
    // map spec fields back to camelCase
    ram: row.ram ?? null,
    storage: row.storage ?? null,
    cpu: row.cpu ?? null,
    displayInch: row.display_inch ?? row.displayInch ?? row.displayinch ?? null,
    condition: row.condition ?? null,
    grade: row.grade ?? null,
    features: row.features ?? null,
    accessories: row.accessories ?? null,
    created_at: row.created_at ?? row.createdAt ?? null,
  };
}

export async function deleteLaptop(id: number): Promise<void> {
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser) {
    try {
      const supabase = getSupabaseClient();
      let sessionToken = '';
      try { const { data } = await supabase.auth.getSession(); sessionToken = data?.session?.access_token || ''; } catch (e) { sessionToken = ''; }
      if (!sessionToken) throw new Error('Missing session token. Please login as admin and refresh the page before deleting.');

      const resp = await fetch('/api/delete-laptop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify({ id })
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => null);
        throw new Error(`[DeleteLaptop] server endpoint failed ${resp.status} ${txt || ''}`);
      }
      return;
    } catch (err) {
      console.warn('[DeleteLaptop] server endpoint call failed, falling back to client delete', err);
    }
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from('laptops').delete().eq('id', id);
  if (error) throw error;
}

export async function upsertBlogPost(post: any): Promise<any> {
  // Prefer calling the server-side endpoint from the browser so we can use service_role key
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser) {
    try {
      const supabase = getSupabaseClient();
      let sessionToken = '';
      try { const { data } = await supabase.auth.getSession(); sessionToken = data?.session?.access_token || ''; } catch (e) { sessionToken = ''; }
      if (!sessionToken) throw new Error('Missing session token. Please login as admin and refresh the page before saving.');

      const resp = await fetch('/api/upsert-blog-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify(post),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => null);
        const errMsg = `[UPsertBlog] server endpoint failed ${resp.status} ${text || ''}`;
        console.warn(errMsg);
        throw new Error(errMsg);
      }
      const json = await resp.json();
      const row = json?.data ?? null;
      if (row) {
        return {
          ...row,
          imageUrl: row.imageurl ?? row.imageUrl ?? '',
          imagePublicId: row.image_public_id ?? row.imagepublicid ?? null,
          created_at: row.created_at ?? row.createdAt ?? null,
        };
      }
    } catch (err) {
      console.warn('[UPsertBlog] server endpoint call failed, falling back to client upsert', err);
    }
    // fall through to client-side upsert as last resort
  }

  const supabase = getSupabaseClient();
  const payload: any = {};
  const idToUse = (post && post.id && post.id !== 0) ? post.id : Date.now();
  Object.keys(post).forEach(k => {
    // map camelCase public id field to DB column
    if (k === 'imagePublicId') {
      payload['image_public_id'] = (post as any)[k];
    } else {
      const newKey = k === 'id' ? 'id' : k.toLowerCase();
      payload[newKey] = (post as any)[k];
    }
  });
  payload.id = idToUse;
  // Ensure date and slug
  if (!payload.date || payload.date === '') payload.date = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  if (!payload.slug || payload.slug === '') {
    const slugify = (input: string) => {
      if (!input) return String(idToUse);
      return input.toString().toLowerCase()
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-')
        .slice(0, 80);
    };
    payload.slug = `${idToUse}-${slugify(post.title || String(idToUse))}`;
  }
  const { data, error } = await supabase.from('blog_posts').upsert(payload, { onConflict: 'id' }).select();
  if (error) throw error;
  const row = data?.[0] ?? null;
  if (!row) return null;
  return {
    ...row,
    imageUrl: row.imageurl ?? row.imageUrl ?? '',
    imagePublicId: row.image_public_id ?? row.imagepublicid ?? null,
    created_at: row.created_at ?? row.createdAt ?? null,
  };
}

export async function deleteBlogPost(id: number): Promise<void> {
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser) {
    try {
      const supabase = getSupabaseClient();
      let sessionToken = '';
      try { const { data } = await supabase.auth.getSession(); sessionToken = data?.session?.access_token || ''; } catch (e) { sessionToken = ''; }
      if (!sessionToken) throw new Error('Missing session token. Please login as admin and refresh the page before deleting.');

      const resp = await fetch('/api/delete-blog-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify({ id })
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => null);
        throw new Error(`[Delete] server endpoint failed ${resp.status} ${txt || ''}`);
      }
      return;
    } catch (err) {
      console.warn('[DELETE] server endpoint call failed, falling back to client delete', err);
    }
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from('blog_posts').delete().eq('id', id);
  if (error) throw error;
}

// Insert an order (used by the public booking flow). Maps camelCase fields to DB column names.
export async function insertOrder(order: any): Promise<any> {
  // Orders have been removed from this application — do not insert.
  throw new Error('Orders are not supported in this build');
}

export async function fetchOrders(): Promise<any[]> {
  // Orders are removed; return empty list to keep callers safe.
  return [];
}

// Fetch app settings from the single-row app_settings table (id = 1)
export async function fetchAppSettings(): Promise<any | null> {
  const supabase = getSupabaseClient();
  // Prefer the public view which is safe to expose to anonymous clients.
  try {
    const { data: publicData, error: publicErr } = await supabase.from('app_settings_public').select('*').limit(1).single();
    if (!publicErr && publicData) {
      const row = publicData as any;
      return {
        theme: row.theme ?? 'light',
        accentColor: row.accentcolor ?? '#3182ce',
        brandName: row.brandname ?? 'TravelGo',
        tagline: row.tagline ?? '',
        logoLightUrl: row.logolighturl ?? '',
        logoDarkUrl: row.logodarkurl ?? '',
        favicon16Url: row.favicon16url ?? '',
        favicon192Url: row.favicon192url ?? '',
        favicon512Url: row.favicon512url ?? '',
        email: row.email ?? '',
        address: row.address ?? '',
        whatsappNumber: row.whatsappnumber ?? '',
        facebookUrl: row.facebookurl ?? '',
        instagramUrl: row.instagramurl ?? '',
        twitterUrl: row.twitterurl ?? '',
        bankName: row.bankname ?? '',
        bankAccountNumber: row.bankaccountnumber ?? '',
        bankAccountHolder: row.bankaccountholder ?? '',
        heroSlides: row.heroslides ?? [],
      };
    }
  } catch (e) {
    // ignore and fallback to direct app_settings lookup (may require auth)
  }

  // Fallback to querying the protected table (useful when admin is logged-in)
  const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).limit(1).single();
  if (error) {
    // If row doesn't exist or permission denied, return null to let client fallback to defaults/localStorage
    console.warn('[SUPABASE] fetchAppSettings error', error.message || error);
    return null;
  }
  const row = data as any;
  if (!row) return null;
  return {
  theme: row.theme ?? 'light',
  accentColor: row.accentcolor ?? '#3182ce',
  brandName: row.brandname ?? 'TravelGo',
  tagline: row.tagline ?? '',
  logoLightUrl: row.logolighturl ?? '',
  logoDarkUrl: row.logodarkurl ?? '',
  favicon16Url: row.favicon16url ?? '',
  favicon192Url: row.favicon192url ?? '',
  favicon512Url: row.favicon512url ?? '',
  email: row.email ?? '',
  address: row.address ?? '',
  whatsappNumber: row.whatsappnumber ?? '',
  facebookUrl: row.facebookurl ?? '',
  instagramUrl: row.instagramurl ?? '',
  twitterUrl: row.twitterurl ?? '',
  bankName: row.bankname ?? '',
  bankAccountNumber: row.bankaccountnumber ?? '',
  bankAccountHolder: row.bankaccountholder ?? '',
  heroSlides: row.heroslides ?? [],
  };
}

export async function fetchReviews(): Promise<any[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => ({
    ...row,
    rating: row.rating ?? 5,
    created_at: row.created_at ?? row.createdAt ?? null,
  }));
}

export async function insertReview(review: { name: string; initials: string; content: string; rating?: number }): Promise<any> {
  const isBrowser = typeof window !== 'undefined';
  const payload = {
    name: review.name,
    initials: review.initials,
    content: review.content,
    rating: review.rating ?? 5,
  };

  if (isBrowser) {
    // Post to server endpoint which validates and inserts using service_role key
    const resp = await fetch('/api/create-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => null);
      throw new Error(`Server error: ${resp.status} ${txt || ''}`);
    }
    const json = await resp.json();
    return json?.data ?? null;
  }

  // Server-side fallback: insert directly using Supabase client
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('reviews').insert(payload).select();
  if (error) throw error;
  return (data && data[0]) || null;
}

// Upsert the single settings row (id = 1). `settings` should match AppSettings shape.
export async function upsertAppSettings(settings: any): Promise<any | null> {
  const isBrowser = typeof window !== 'undefined';
  if (isBrowser) {
    try {
      const supabase = getSupabaseClient();
      let sessionToken = '';
      try { const { data } = await supabase.auth.getSession(); sessionToken = data?.session?.access_token || ''; } catch (e) { sessionToken = ''; }
      if (!sessionToken) throw new Error('Missing session token. Please login as admin and refresh the page before saving.');

      const resp = await fetch('/api/upsert-app-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify(settings),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => null);
        const errMsg = `[upsertAppSettings] server endpoint failed ${resp.status} ${text || ''}`;
        console.warn(errMsg);
        throw new Error(errMsg);
      }
      const json = await resp.json();
      const row = json?.data ?? null;
      if (row) {
        return {
          theme: row.theme ?? 'light',
          accentColor: row.accentcolor ?? '#3182ce',
          brandName: row.brandname ?? 'TravelGo',
          tagline: row.tagline ?? '',
          logoLightUrl: row.logolighturl ?? '',
          logoDarkUrl: row.logodarkurl ?? '',
          favicon16Url: row.favicon16url ?? '',
          favicon192Url: row.favicon192url ?? '',
          favicon512Url: row.favicon512url ?? '',
          email: row.email ?? '',
          address: row.address ?? '',
          whatsappNumber: row.whatsappnumber ?? '',
          facebookUrl: row.facebookurl ?? '',
          instagramUrl: row.instagramurl ?? '',
          twitterUrl: row.twitterurl ?? '',
          bankName: row.bankname ?? '',
          bankAccountNumber: row.bankaccountnumber ?? '',
          bankAccountHolder: row.bankaccountholder ?? '',
          heroSlides: row.heroslides ?? [],
        };
      }
    } catch (err) {
      console.warn('[upsertAppSettings] server endpoint call failed, falling back to client upsert', err);
    }
    // fall through to client-side upsert as last resort
  }

  const supabase = getSupabaseClient();
  const payload = {
    id: 1,
    theme: settings.theme,
    accentcolor: settings.accentColor,
    brandname: settings.brandName,
    tagline: settings.tagline,
    logolighturl: settings.logoLightUrl,
    logodarkurl: settings.logoDarkUrl,
    favicon16url: settings.favicon16Url,
    favicon192url: settings.favicon192Url,
    favicon512url: settings.favicon512Url,
    email: settings.email,
    address: settings.address,
    whatsappnumber: settings.whatsappNumber,
    facebookurl: settings.facebookUrl,
    instagramurl: settings.instagramUrl,
    twitterurl: settings.twitterUrl,
    bankname: settings.bankName,
    bankaccountnumber: settings.bankAccountNumber,
    bankaccountholder: settings.bankAccountHolder,
    heroslides: settings.heroSlides ?? [],
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('app_settings').upsert(payload, { onConflict: 'id' }).select();
  if (error) {
    console.warn('[SUPABASE] upsertAppSettings error', error.message || error);
    throw error;
  }
  const row = data?.[0] ?? null;
  if (!row) return null;
  return {
    theme: row.theme ?? 'light',
    accentColor: row.accentcolor ?? '#3182ce',
    brandName: row.brandname ?? 'TravelGo',
    tagline: row.tagline ?? '',
    logoLightUrl: row.logolighturl ?? '',
    logoDarkUrl: row.logodarkurl ?? '',
    favicon16Url: row.favicon16url ?? '',
    favicon192Url: row.favicon192url ?? '',
    favicon512Url: row.favicon512url ?? '',
    email: row.email ?? '',
    address: row.address ?? '',
    whatsappNumber: row.whatsappnumber ?? '',
    facebookUrl: row.facebookurl ?? '',
    instagramUrl: row.instagramurl ?? '',
    twitterUrl: row.twitterurl ?? '',
    bankName: row.bankname ?? '',
    bankAccountNumber: row.bankaccountnumber ?? '',
    bankAccountHolder: row.bankaccountholder ?? '',
    heroSlides: row.heroslides ?? [],
  };
}

// Update an existing order by id. `patch` should use camelCase keys (e.g. paymentHistory) and will be mapped to DB columns.
export async function updateOrder(id: number, patch: any): Promise<any> {
  // Orders are removed; updates are not supported.
  throw new Error('Orders are not supported in this build');
}



// Create a shareable invoice record. If Supabase is configured, insert into `invoices` table
// and return the created invoice row. If not configured or insertion fails, return a
// fallback object with a generated id (timestamp) that the client can use to build a
// one-off invoice link. Invoice rows should contain at least: id, order_id, total, metadata, created_at
export async function createInvoiceForOrder(orderId: number, total: number, metadata: any = {}): Promise<any> {
  // Invoice functionality removed.
  throw new Error('Invoices are not supported in this build');
}

// Fetch invoice by invoice id (primary key in invoices table)
export async function fetchInvoiceById(invoiceId: number): Promise<any | null> {
  // Invoices removed; return null to indicate missing.
  return null;
}

// Fetch invoice by its share_token (public identifier)
export async function fetchInvoiceByToken(token: string): Promise<any | null> {
  // Invoices removed; return null to indicate missing.
  return null;
}

// Fetch invoice together with its order by token using security-definer RPC
export async function fetchInvoiceWithOrderByToken(token: string): Promise<any | null> {
  // Invoices removed; return null to indicate missing.
  return null;
}

// Fetch order by id (wrap existing fetchOrders filter behavior)
export async function fetchOrderById(orderId: number): Promise<any | null> {
  // Orders removed; return null to indicate missing.
  return null;
}
