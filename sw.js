const CACHE_NAME = 'istiklal-takvimi-v6';

/* DİKKAT: maArifRika-Regular.ttf buradan çıkarıldı.
   Font zaten index.html içine base64 gömülü; sunucuda böyle bir dosya yok.
   cache.addAll() atomiktir — listedeki TEK bir dosya 404 verirse tamamı reddedilir,
   install başarısız olur ve hiçbir şey önbelleğe alınmaz (offline tamamen çalışmaz). */
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
  './icon-maskable-192x192.png',
  './icon-maskable-512x512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      /* addAll yerine tek tek: bir dosya eksik olsa bile kurulum devam etsin */
      Promise.all(ASSETS.map(url =>
        cache.add(new Request(url, { cache: 'reload' }))
             .catch(err => console.warn('SW: önbelleğe alınamadı', url, err))
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  /* Sadece kendi origin'imizdeki GET istekleri; POST ve dış kaynaklar dokunulmadan geçsin */
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  /* Sayfa açılışı: önce ağ (güncelleme gelsin), olmazsa önbellek (offline çalışsın).
     Eski sürümde saf cache-first vardı; index.html güncellense bile
     CACHE_NAME değişmeden kullanıcıya asla ulaşmıyordu. */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const kopya = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, kopya)).catch(() => {});
        return res;
      }).catch(() =>
        caches.match(req).then(cached => cached || caches.match('./index.html'))
      )
    );
    return;
  }

  /* Diğer varlıklar: önce önbellek, yoksa ağdan al ve sakla */
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const kopya = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, kopya)).catch(() => {});
        }
        return res;
      });
    })
  );
});
