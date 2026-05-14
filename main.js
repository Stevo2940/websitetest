/* ═══════════════════════════════════════
   REVIVAL OF ROMIOSINI – DUAL RSS FETCH
   (proxy first, then API fallback)
   ═══════════════════════════════════════ */

const feedCache = {};

/* ─── CURATED FALLBACKS ─── */
const CURATED_FALLBACKS = {
    greece: [
        { title: 'Greek PM meets with diaspora representatives in Athens', link: '#', date: 'May 11, 2026', source: 'Curated' },
        { title: 'New archaeological discoveries at Vergina site', link: '#', date: 'May 9, 2026', source: 'Curated' },
    ],
    cyprus: [
        { title: 'Cyprus talks resume with renewed diaspora engagement', link: '#', date: 'May 10, 2026', source: 'Curated' },
    ],
    orthodoxy: [
        { title: 'Ecumenical Patriarch addresses global Orthodox youth', link: '#', date: 'May 12, 2026', source: 'Curated' },
    ],
    diaspora: [
        { title: 'Greek-Australian students lead language preservation', link: '#', date: 'May 11, 2026', source: 'Curated' },
    ],
    world: [
        { title: 'Greek Reporter: Global diaspora rally for language funding', link: '#', date: 'May 12, 2026', source: 'Curated' },
    ]
};

/* ─── FEED SOURCES (homepage tabs) ─── */
const FEEDS = {
    greece: [
        { url: 'https://www.ekathimerini.com/rss/', label: 'Kathimerini' },
        { url: 'https://www.tovima.gr/feed/', label: 'To Vima' },
        { url: 'https://www.greekreporter.com/category/greece/feed/', label: 'Greek Reporter GR' },
    ],
    cyprus: [
        { url: 'https://cyprus-mail.com/feed/', label: 'Cyprus Mail' },
    ],
    orthodoxy: [
        { url: 'https://orthodoxtimes.com/feed/', label: 'Orthodox Times' },
        { url: 'https://www.johnsanidopoulos.com/feeds/posts/default', label: 'Mystagogy' },
    ],
    diaspora: [
        { url: 'https://greekcitytimes.com/feed/', label: 'Greek City Times' },
        { url: 'https://neoskosmos.com/feed/', label: 'Neos Kosmos' },
    ],
    world: [
        { url: 'https://www.greekreporter.com/feed/', label: 'Greek Reporter' },
    ]
};

/* ─── AGGREGATOR SOURCES (all combined) ─── */
const AGGREGATOR_SOURCES = [
    { url: 'https://www.ekathimerini.com/rss/', label: 'Kathimerini' },
    { url: 'https://www.tovima.gr/feed/', label: 'To Vima' },
    { url: 'https://www.greekreporter.com/feed/', label: 'Greek Reporter' },
    { url: 'https://greekcitytimes.com/feed/', label: 'Greek City Times' },
    { url: 'https://cyprus-mail.com/feed/', label: 'Cyprus Mail' },
    { url: 'https://orthodoxtimes.com/feed/', label: 'Orthodox Times' },
    { url: 'https://neoskosmos.com/feed/', label: 'Neos Kosmos' },
];

/* ═══════════════════════════════════════
   METHOD 1 – DIRECT RSS VIA CORS PROXY
   ═══════════════════════════════════════ */
async function fetchViaProxy(sourceUrl, sourceLabel) {
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(sourceUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timer);
        if (!response.ok) throw new Error('HTTP ' + response.status);

        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

        let items = xmlDoc.querySelectorAll('item');
        if (items.length === 0) {
            items = xmlDoc.querySelectorAll('entry');
        }

        const result = [];
        items.forEach(item => {
            const titleEl = item.querySelector('title');
            const linkEl = item.querySelector('link');
            const dateEl = item.querySelector('pubDate, published, updated');

            const title = titleEl?.textContent?.trim();
            let link = '';
            if (linkEl) {
                link = linkEl.textContent?.trim() || linkEl.getAttribute('href') || '';
            }
            const dateText = dateEl?.textContent?.trim();
            const date = dateText ? new Date(dateText).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' }) : '';

            if (title && link) {
                result.push({ title, link, date, source: sourceLabel });
            }
        });
        return result.slice(0, 5);
    } catch (err) {
        console.warn(`Proxy failed for ${sourceLabel}: ${err.message}`);
        return null;   // null means "try next method"
    }
}

/* ═══════════════════════════════════════
   METHOD 2 – RSS‑TO‑JSON API FALLBACK
   ═══════════════════════════════════════ */
async function fetchViaApi(sourceUrl, sourceLabel) {
    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(sourceUrl) + '&count=5';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timer);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            return data.items.map(item => ({
                title: item.title,
                link: item.link,
                date: new Date(item.pubDate).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' }),
                source: sourceLabel
            }));
        }
        return [];
    } catch (err) {
        console.warn(`API fallback failed for ${sourceLabel}: ${err.message}`);
        return [];
    }
}

/* ═══════════════════════════════════════
   COMBINED FETCH – proxy, then API
   ═══════════════════════════════════════ */
async function fetchSingleFeed(sourceUrl, sourceLabel) {
    // Try proxy first
    let items = await fetchViaProxy(sourceUrl, sourceLabel);
    if (items && items.length > 0) {
        return items;
    }

    // Proxy gave nothing -> try API
    console.log(`Trying API fallback for ${sourceLabel}`);
    items = await fetchViaApi(sourceUrl, sourceLabel);
    return items;
}

/* ═══════════════════════════════════════
   HOMEPAGE TAB LOGIC
   ═══════════════════════════════════════ */
function switchTab(el, panel) {
    document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.feed-panel').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('feed-' + panel).classList.add('active');

    const sourceInfoEl = document.getElementById('feed-source-info');
    if (sourceInfoEl && feedCache[panel]) {
        const cache = feedCache[panel];
        const liveSources = [...new Set(cache.items.filter(i => i.source !== 'Curated').map(i => i.source))];
        sourceInfoEl.textContent = liveSources.length > 0 ? 'via ' + liveSources.join(', ') + (cache.usedCurated ? ' + curated' : '') : 'curated selection';
    } else if (sourceInfoEl) {
        sourceInfoEl.textContent = '';
    }

    const cacheAge = feedCache[panel] ? Date.now() - feedCache[panel].timestamp : Infinity;
    if (!feedCache[panel] || cacheAge > 300000) {
        loadFeed(panel);
    }
}

async function loadFeed(panel) {
    const sources = FEEDS[panel];
    const listEl = document.getElementById('list-' + panel);
    const loadingEl = document.getElementById('loading-' + panel);
    const sourceInfoEl = document.getElementById('feed-source-info');

    if (loadingEl) loadingEl.style.display = 'block';
    if (listEl) listEl.innerHTML = '';

    let allItems = [];
    const results = await Promise.all(sources.map(src => fetchSingleFeed(src.url, src.label)));
    allItems = results.flat();

    // Deduplicate
    const seen = new Set();
    allItems = allItems.filter(item => {
        const key = item.title.slice(0, 40).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 8);

    let usedCurated = false;
    if (allItems.length < 3 && CURATED_FALLBACKS[panel]) {
        allItems = [...allItems, ...CURATED_FALLBACKS[panel]].slice(0, 8);
        usedCurated = true;
    }
    if (allItems.length === 0 && CURATED_FALLBACKS[panel]) {
        allItems = CURATED_FALLBACKS[panel].slice(0, 8);
        usedCurated = true;
    }

    if (loadingEl) loadingEl.style.display = 'none';

    if (sourceInfoEl && document.getElementById('feed-' + panel).classList.contains('active')) {
        const liveSources = [...new Set(allItems.filter(i => i.source !== 'Curated').map(i => i.source))];
        sourceInfoEl.textContent = liveSources.length > 0 ? 'via ' + liveSources.join(', ') + (usedCurated ? ' + curated' : '') : 'curated selection';
    }

    if (allItems.length === 0) {
        listEl.innerHTML = `<li style="padding:20px;text-align:center;">No articles found. <span class="feed-retry" onclick="retryFeed('${panel}')">Retry</span></li>`;
        return;
    }

    listEl.innerHTML = allItems.map((item, i) => `
        <li class="feed-item">
            <div class="feed-num">${String(i+1).padStart(2,'0')}</div>
            <div>
                <div class="feed-item-source">${item.source}${item.source === 'Curated' ? ' <span class="feed-badge badge-curated">Curated</span>' : ''}</div>
                <a href="${item.link}" target="_blank" rel="noopener" class="feed-item-title">${item.title}</a>
                <div class="feed-item-meta">${item.date}</div>
            </div>
        </li>
    `).join('');

    feedCache[panel] = { items: allItems, usedCurated, timestamp: Date.now() };
}

function retryFeed(panel) {
    delete feedCache[panel];
    document.getElementById('list-' + panel).innerHTML = '';
    document.getElementById('loading-' + panel).style.display = 'block';
    loadFeed(panel);
}

/* ═══════════════════════════════════════
   AGGREGATOR PAGE LOGIC
   ═══════════════════════════════════════ */
window.initAggregator = async function() {
    const listEl = document.getElementById('aggregator-list');
    const loadingEl = document.getElementById('aggregator-loading');
    const filterContainer = document.getElementById('aggregator-filters');
    let allItems = [];

    const results = await Promise.all(
        AGGREGATOR_SOURCES.map(src => fetchSingleFeed(src.url, src.label))
    );
    allItems = results.flat();

    const seen = new Set();
    allItems = allItems.filter(item => {
        const key = item.title.slice(0, 40).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const sources = [...new Set(allItems.map(i => i.source))];
    filterContainer.innerHTML = `
        <button class="feed-tab active" onclick="filterAggregator('all')">All Sources</button>
        ${sources.map(src => `<button class="feed-tab" onclick="filterAggregator('${src}')">${src}</button>`).join('')}
    `;

    loadingEl.style.display = 'none';
    window.aggregatorItems = allItems;
    renderAggregator('all');
};

function filterAggregator(source) {
    document.querySelectorAll('#aggregator-filters .feed-tab').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderAggregator(source);
}

function renderAggregator(source) {
    const listEl = document.getElementById('aggregator-list');
    const items = source === 'all' ? window.aggregatorItems : window.aggregatorItems.filter(i => i.source === source);
    if (items.length === 0) {
        listEl.innerHTML = '<li style="padding:20px;text-align:center;">No articles found.</li>';
        return;
    }
    listEl.innerHTML = items.map((item, i) => `
        <li class="feed-item">
            <div class="feed-num">${String(i+1).padStart(2,'0')}</div>
            <div>
                <div class="feed-item-source">${item.source}</div>
                <a href="${item.link}" target="_blank" rel="noopener" class="feed-item-title">${item.title}</a>
                <div class="feed-item-meta">${item.date}</div>
            </div>
        </li>
    `).join('');
}

/* ═══════════════════════════════════════
   MISC UI
   ═══════════════════════════════════════ */
const igImages = [
    'https://images.unsplash.com/photo-1541417904950-b855846fe074?q=80&w=200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1600188769045-bc6026bfc8ce?q=80&w=200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?q=80&w=200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1461360370896-922624d12aa1?q=80&w=200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1588612543085-f52e3e601c44?q=80&w=200&auto=format&fit=crop',
];
const igGrid = document.getElementById('ig-grid');
if (igGrid) {
    igImages.forEach(src => {
        igGrid.innerHTML += `
            <a href="https://www.instagram.com/revival_of_romiosini/" target="_blank" rel="noopener" class="ig-tile">
                <img src="${src}" alt="Instagram post" loading="lazy">
                <div class="ig-tile-overlay">View</div>
            </a>
        `;
    });
}

function updateDateline() {
    const now = new Date();
    const daysGr = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];
    const monthsGr = ['Ιαν','Φεβ','Μαρ','Απρ','Μαΐ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'];
    const datelineEl = document.getElementById('dateline');
    if (datelineEl) {
        datelineEl.innerHTML = `${daysGr[now.getDay()]}<span>•</span>${now.getDate()} ${monthsGr[now.getMonth()]} ${now.getFullYear()}<span>•</span>Athens&nbsp;·&nbsp;Melbourne&nbsp;·&nbsp;Global`;
    }
}
updateDateline();

document.querySelectorAll('.lang-toggle span').forEach(el => {
    el.addEventListener('click', () => {
        document.querySelectorAll('.lang-toggle span').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
    });
});

// Initial load for homepage
if (document.getElementById('feed-greece')) {
    loadFeed('greece');
}