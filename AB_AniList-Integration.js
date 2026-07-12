// ==UserScript==
// @name AB - AniList Integration
// @author Mitsuki Haruko
// @namespace AnimeBytes Nightly
// @version 1.89
// @description Adds direct AniList link, next episode/chapter countdown, optional YouTube trailer embed, personal next-episodes homepage widget, AniList banner
// @grant GM_xmlhttpRequest
// @grant GM_getValue
// @grant GM_setValue
// @match https://animebytes.tv/torrents.php?id*
// @match https://animebytes.tv/
// @match *://animebytes.tv/user.php?action=edit*
// @updateURL    https://mitsukiharuko.github.io/waitForKeyElements/AB_AniList-Integration.js
// @downloadURL  https://mitsukiharuko.github.io/waitForKeyElements/AB_AniList-Integration.js
// @icon https://animebytes.tv/favicon.ico
// @require https://github.com/momentary0/AB-Userscripts/raw/master/delicious-library/src/ab_delicious_library.js
// @run-at document-end
// ==/UserScript==

(function () {
    'use strict';

    const favicons = {
        "AniList": "https://mei.kuudere.pw/ncihtSl6Awu.png",
    };

    function normalizeLinkName(txt) {
        if (!txt) return null;
        const t = txt.toLowerCase().trim().replace(/[\s|•…‥.]+/g, '');
        if (t.includes('anilist')) return 'AniList';
        return null;
    }

    function replaceLinkWithIcon(a) {
        const text = a.textContent.trim();
        const key = normalizeLinkName(text);
        if (!key || !favicons[key]) return;
        const img = document.createElement('img');
        img.src = favicons[key];
        img.alt = text || key;
        img.title = text || key;
        img.className = 'favicon-icon';
        a.textContent = '';
        a.appendChild(img);
    }

    // Settings
    if (delicious?.settings?.ensureSettingsInserted?.()) {
        const section = delicious.settings.createCollapsibleSection('Anilist Integration (Trailers, Watchlist, Banners)');
        const body = section.querySelector('.settings_section_body');
        delicious.settings.init('ABAniListEnableTrailers', true);
        body.appendChild(delicious.settings.createCheckbox('ABAniListEnableTrailers', 'Embed YouTube trailers', 'Shows the official trailer (if available).'));
        delicious.settings.init('ABAniListTrailerAtTop', false);
        body.appendChild(delicious.settings.createCheckbox('ABAniListTrailerAtTop', 'Trailer at the Top', 'Inserts trailer at the very top of the main column (above torrents)'));
        delicious.settings.init('ABAniListTrailerAutoplay', false);
        body.appendChild(delicious.settings.createCheckbox('ABAniListTrailerAutoplay', 'Autoplay trailer (muted)', 'Trailer starts playing automatically when loaded without sound'));
        delicious.settings.init('ABAniListEnableBanners', true);
        body.appendChild(delicious.settings.createCheckbox('ABAniListEnableBanners', 'Show AniList banners', 'Displays the large AniList banner image at the top of the page (if available)'));
        delicious.settings.insertSection(section);
    }

    const enableTrailers = JSON.parse(GM_getValue('ABAniListEnableTrailers', 'true'));
    const trailerAtTop = JSON.parse(GM_getValue('ABAniListTrailerAtTop', 'false'));
    const autoplayTrailer = JSON.parse(GM_getValue('ABAniListTrailerAutoplay', 'false'));
    const enableBanners = JSON.parse(GM_getValue('ABAniListEnableBanners', 'true'));

    const bannerStyle = document.createElement('style');
    bannerStyle.textContent = `
        #ab-anilist-banner { width: 100%; height: 200px; background-size: cover; background-position: center 25%; background-repeat: no-repeat; position: relative; margin: 10px 0 18px 0; border-radius: 6px; box-shadow: 0 3px 10px rgba(0,0,0,0.35); overflow: hidden; }
        #ab-anilist-banner::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.35)); }
        .weekday-header { margin: 12px 0 6px 0; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 1.05em; }
        .weekday-separator { border: 0; height: 1px; background: #444; margin: 10px 0; }
        .next-ep-item { margin-bottom: 10px; }
        .next-ep-remove { float: right; background: none; border: none; color: #ff5555; font-size: 1.4em; cursor: pointer; padding: 0 4px; }
        #content div.thin h3, #content div.thin h3 * {
            -webkit-user-select: none !important; -moz-user-select: none !important;
            -ms-user-select: none !important; user-select: none !important;
        }
        .favicon-icon {
            height: 2.15em; width: auto; vertical-align: middle; margin: 0 5px 1px 2px;
            border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            display: inline-block; transition: transform 0.13s ease;
            transform-origin: center center; will-change: transform;
            backface-visibility: hidden;
        }
        .favicon-icon:hover { transform: scale(1.18) !important; }
    `;
    document.head.appendChild(bannerStyle);

    function formatTimeUntil(seconds, isAiring = false, mediaType = 'ANIME') {
        if (seconds == null || seconds < 0) return "<span class='countdown-prefix'>—</span>";
        const diff = seconds * 1000;
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0 || parts.length === 0) parts.push(`${m}m`);
        const timeStr = parts.join(' ');
        const prefix = isAiring ? 'Airing in ' : (mediaType === 'ANIME' ? 'Next ep in ' : 'Next ch in ');
        return `<span class="countdown-prefix">${prefix}</span><span class="countdown-time">${timeStr}</span>`;
    }

    function getStoredList() { try { return JSON.parse(GM_getValue('AB_NextEp_WatchList', '[]')) || []; } catch { return []; } }
    function saveList(arr) { GM_setValue('AB_NextEp_WatchList', JSON.stringify(arr)); }

    function getStatusBadge(status) {
        const badges = { FINISHED: { text: 'Finished', color: '#2196F3' }, CANCELLED: { text: 'Cancelled', color: '#F44336' }, HIATUS: { text: 'Hiatus', color: '#9C27B0' }, NOT_YET_RELEASED: { text: 'Upcoming', color: '#FF9800' }};
        const style = badges[status] || { text: status || 'Unknown', color: '#757575' };
        return `<span class="status-badge" style="background:${style.color}; color:white; padding:2px 6px; border-radius:3px; font-size:0.85em; margin-left:8px;">${style.text}</span>`;
    }

    function getWeekdayName(timestamp) {
        if (!timestamp) return "No Date";
        return new Date(timestamp * 1000).toLocaleDateString('en-US', { weekday: 'long' });
    }

    function normalizeTitle(t) {
        if (!t) return '';
        return t.toLowerCase()
            .replace(/[^a-z0-9\s:]/g, '')
            .replace(/\b(ii|iii|iv|v|vi|vii|viii|ix|x|xi)\b/g, m => ({ii:2,iii:3,iv:4,v:5,vi:6,vii:7,viii:8,ix:9,x:10,xi:11}[m] || m))
            .replace(/\b(season|part|cour|arc)\s*(\d+)/gi, '$2')
            .trim();
    }

    function calculateScore(media, searchTerm, preferredYear, preferredFormat) {
        let score = 0;
        const nSearch = normalizeTitle(searchTerm);
        if (media.title.romaji && normalizeTitle(media.title.romaji) === nSearch) score += 100;
        else if (media.title.romaji && normalizeTitle(media.title.romaji).includes(nSearch)) score += 55;
        if (media.title.english && normalizeTitle(media.title.english) === nSearch) score += 90;
        else if (media.title.english && normalizeTitle(media.title.english).includes(nSearch)) score += 50;

        if (preferredFormat) {
            if (media.format === preferredFormat) score += 250;
            else if (media.format) score -= 140;
        }
        if (preferredYear && media.startDate?.year === preferredYear) score += 95;
        return score;
    }

    function fetchAniListData(title, shortTitle, mediaType, year, format, h2, h3) {
        const clean = (t) => t ? t.trim()
            .replace(/\b(II|III|IV|V|VI|VII|VIII|IX|X|XI)\b/gi, m => ({II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11}[m.toUpperCase()] || m))
            .replace(/\b(?:Season|Part|Cour|Arc)\s*(\d+)/gi, ' $1')
            .replace(/\s+/g, ' ').trim() : '';

        const searchTerms = [clean(title), clean(shortTitle)].filter(Boolean);
        if (!searchTerms.length) return fallback(h3, shortTitle, mediaType);

        const query = `query ($search: String, $type: MediaType) {
            Page(perPage: 12) {
                media(search: $search, type: $type) {
                    id title { romaji english native }
                    startDate { year } format status
                    bannerImage
                    nextAiringEpisode { airingAt timeUntilAiring episode }
                    trailer { id site }
                }
            }
        }`;

        let bestMedia = null;
        let bestScore = -1;
        let completed = 0;

        const process = (results, term) => {
            for (const m of results) {
                const score = calculateScore(m, term, year, format);
                if (score > bestScore) {
                    bestScore = score;
                    bestMedia = m;
                }
            }
        };

        const checkDone = () => {
            if (++completed === searchTerms.length) finalize();
        };

        const finalize = () => {
            if (bestMedia && bestScore >= 45) useResult(bestMedia);
            else fallback(h3, shortTitle, mediaType);
        };

        function useResult(media) {
            console.log(`%c[AniList] SELECTED: ${media.title.romaji} Score: ${bestScore}`, 'color:lime;font-weight:bold');

            if (media.bannerImage) insertAniListBanner(media.bannerImage);

            const na = media.nextAiringEpisode;
            let airingText = '';
            if (media.status === 'RELEASING' && na?.timeUntilAiring != null) {
                airingText = formatTimeUntil(na.timeUntilAiring, false, mediaType);
            } else if (media.status === 'NOT_YET_RELEASED' && na?.airingAt) {
                const sec = na.airingAt - Math.floor(Date.now()/1000);
                airingText = formatTimeUntil(sec, true, mediaType);
            }

            if (airingText) {
                const span = document.createElement('span');
                span.style.cssText = 'font-weight:900;font-size:15px;margin-left:8px;';
                span.innerHTML = ' | ' + airingText;

                const alreadyAdded = getStoredList().some(item => item.id === media.id);
                const btn = document.createElement('button');
                btn.className = 'next-ep-add-btn';
                btn.textContent = alreadyAdded ? '[✓]' : '[+]';
                Object.assign(btn.style, {marginLeft:'10px', fontSize:'13px', padding:'1px 6px', cursor: alreadyAdded ? 'default' : 'pointer'});
                btn.disabled = alreadyAdded;
                btn.title = alreadyAdded ? 'Already added to homepage list' : 'Add to Next Episodes list (homepage)';
                btn.onclick = () => {
                    if (alreadyAdded) return;
                    const list = getStoredList();
                    list.push({id: media.id, title: media.title.romaji || title, type: mediaType, added: Date.now()});
                    saveList(list);
                    btn.textContent = '[✓]'; btn.disabled = true; btn.style.cursor = 'default';
                };
                span.appendChild(btn);
                h2.appendChild(span);
            }

            if (media.id) appendAniListLink(media.id, h3, mediaType);

            const tr = media.trailer;
            if (enableTrailers && tr?.id && tr.site?.toLowerCase() === 'youtube') {
                let params = `rel=0&modestbranding=1`;
                if (autoplayTrailer) params += `&autoplay=1&mute=1`;
                embedTrailer(`https://www.youtube-nocookie.com/embed/${tr.id}?${params}`, trailerAtTop);
            }
        }

        // Parallel searches (one clean term at a time)
        searchTerms.forEach(term => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://graphql.anilist.co',
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ query, variables: { search: term, type: mediaType } }),
                onload: res => {
                    if (res.status === 200) {
                        try {
                            const results = JSON.parse(res.responseText).data?.Page?.media || [];
                            process(results, term);
                        } catch (e) {}
                    }
                    checkDone();
                },
                onerror: checkDone
            });
        });
    }

    function insertAniListBanner(bannerUrl) {
        if (!enableBanners || document.getElementById('ab-anilist-banner') || !bannerUrl) return;

        const apply = (dataUrl) => {
            const banner = document.createElement('div');
            banner.id = 'ab-anilist-banner';
            banner.style.backgroundImage = `url(${dataUrl})`;
            document.querySelector('#content .main_column')?.prepend(banner);
        };

        if (bannerUrl.startsWith('data:')) return apply(bannerUrl);

        GM_xmlhttpRequest({
            method: 'GET',
            url: bannerUrl,
            responseType: 'blob',
            onload: r => {
                if (r.status === 200 && r.response) {
                    const reader = new FileReader();
                    reader.onloadend = () => apply(reader.result);
                    reader.readAsDataURL(r.response);
                }
            }
        });
    }

    function embedTrailer(src, atTop = false) {
        const ts = document.createElement('div');
        ts.className = 'box trailer-box';
        ts.innerHTML = `<div class="head"><strong>Trailer</strong></div><div class="body" style="padding:0 12px 12px 12px;"><div style="position:relative;width:100%;padding-bottom:56.25%;height:0"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" src="${src}" allowfullscreen></iframe></div></div>`;

        const main = document.querySelector('#content .main_column');
        if (!main) return;
        if (atTop) main.prepend(ts);
        else {
            const syn = $('.box > .head > strong:contains("Plot Synopsis")').closest('.box');
            syn.length ? syn.after(ts) : main.appendChild(ts);
        }
    }

    function handleDetailPage() {
        const start = (h2, h3) => {
            let seriesTitle = '', typeText = '', releaseYear = null;
            const match = h2.innerHTML.match(/>(.*?)<\/a>\s*-\s*(.*?)\s*\[(\d{4})\]/);
            if (match) {
                seriesTitle = match[1].trim();
                typeText = match[2].trim();
                releaseYear = parseInt(match[3], 10);
            } else {
                seriesTitle = h2.querySelector('a')?.textContent.trim() || h2.textContent.trim();
                releaseYear = h2.textContent.match(/\[(\d{4})\]/)?.[1] ? parseInt(RegExp.$1) : null;
            }

            let mediaType = 'ANIME', format = null;
            const printed = ["Manga","Oneshot","Manhwa","Manhua","Light Novel","Anthology"];
            const animeFmt = {TV:'TV',OVA:'OVA',Movie:'MOVIE',Special:'SPECIAL',ONA:'ONA'};
            if (printed.includes(typeText)) mediaType = 'MANGA';
            else if (typeText in animeFmt) format = animeFmt[typeText];

            const shortTitle = seriesTitle.split(':')[0].trim();
            fetchAniListData(seriesTitle, shortTitle, mediaType, releaseYear, format, h2, h3);
        };

        const h2 = document.querySelector('#content div.thin h2');
        const h3 = document.querySelector('#content div.thin h3');
        if (h2 && h3) return start(h2, h3);

        let attempts = 0;
        const iv = setInterval(() => {
            const h2n = document.querySelector('#content div.thin h2');
            const h3n = document.querySelector('#content div.thin h3');
            if (h2n && h3n) {
                clearInterval(iv);
                start(h2n, h3n);
            } else if (++attempts > 25) clearInterval(iv);
        }, 50);
    }

    function handleHomePage() {
        if (!location.pathname.match(/^\/$/)) return;
        const fpright = document.querySelector('.fpright');
        if (!fpright || document.getElementById('ab-next-ep-widget')) return;

        const container = document.createElement('div');
        container.id = 'ab-next-ep-widget';
        container.style.marginBottom = '20px';
        container.innerHTML = `<div class="head"><strong>Watch List</strong></div><div class="body" id="next-ep-list" style="padding:12px; font-size:0.94em;">Loading...</div>`;
        fpright.insertBefore(container, fpright.firstChild);
        renderNextEpList();
    }

    async function renderNextEpList() {
        const listEl = document.getElementById('next-ep-list');
        if (!listEl) return;
        const watchlist = getStoredList();
        if (!watchlist.length) { listEl.textContent = 'No shows tracked yet. Add with → [+]'; return; }

        listEl.textContent = 'Updating...';
        const items = [];

        await Promise.all(watchlist.map(async entry => {
            try {
                const data = await fetchAniListEntry(entry.id, entry.type);
                if (!data) return;
                const na = data.nextAiringEpisode;
                items.push({
                    ...entry,
                    timeUntil: na?.timeUntilAiring ?? null,
                    episode: na?.episode ?? null,
                    title: data.title.romaji || data.title.english || entry.title,
                    status: data.status || 'UNKNOWN',
                    airingAt: na?.airingAt ?? null
                });
            } catch (e) {}
        }));

        items.sort((a, b) => (a.timeUntil ?? Infinity) - (b.timeUntil ?? Infinity));
        if (!items.length) { listEl.textContent = 'No data could be loaded.'; return; }

        const ul = document.createElement('ul');
        ul.style.cssText = 'list-style:none;padding:0;margin:0;';
        let currentDay = null;
        for (const it of items) {
            const dayName = it.airingAt ? getWeekdayName(it.airingAt) : "No Date";
            if (dayName !== currentDay) {
                if (currentDay) ul.appendChild(Object.assign(document.createElement('hr'), {className:'weekday-separator'}));
                const header = document.createElement('div'); header.className = 'weekday-header'; header.textContent = dayName;
                ul.appendChild(header);
                currentDay = dayName;
            }
            const li = document.createElement('li'); li.className = 'next-ep-item';
            const countdown = it.timeUntil !== null ? formatTimeUntil(it.timeUntil, false, it.type) : '<span class="countdown-prefix">No upcoming episode</span>';
            li.innerHTML = `
                <button class="next-ep-remove" title="Remove from list">×</button>
                <div class="next-ep-header">
                    <a href="https://anilist.co/${it.type.toLowerCase()}/${it.id}" target="_blank">${it.title}</a>
                    ${it.status !== 'RELEASING' ? getStatusBadge(it.status) : ''}
                    ${it.episode ? `<span class="ep-badge">Ep ${it.episode}</span>` : ''}
                </div>
                <div class="next-ep-countdown">${countdown}</div>`;
            li.querySelector('.next-ep-remove').onclick = () => {
                saveList(getStoredList().filter(e => e.id !== it.id));
                renderNextEpList();
            };
            ul.appendChild(li);
        }
        listEl.innerHTML = ''; listEl.appendChild(ul);
    }

    function fetchAniListEntry(id, mediaType) {
        return new Promise(resolve => {
            GM_xmlhttpRequest({
                method: 'POST', url: 'https://graphql.anilist.co',
                headers: {'Content-Type': 'application/json'},
                data: JSON.stringify({
                    query: `query($id:Int,$type:MediaType){Media(id:$id,type:$type){id title{romaji english}status nextAiringEpisode{airingAt timeUntilAiring episode}}}`,
                    variables: {id, type: mediaType}
                }),
                onload: r => resolve(r.status === 200 ? JSON.parse(r.responseText).data?.Media : null),
                onerror: () => resolve(null)
            });
        });
    }

    function appendAniListLink(id, h3, mediaType) {
        const last = [...h3.querySelectorAll('a')].pop();
        const sep = document.createElement('span'); sep.textContent = ' • '; sep.style.color = '#888';
        const a = document.createElement('a');
        a.href = `https://anilist.co/${mediaType.toLowerCase()}/${id}`;
        a.textContent = 'AniList'; a.target = '_blank';
        replaceLinkWithIcon(a);
        if (last) {
            last.parentNode.insertBefore(sep, last.nextSibling);
            last.parentNode.insertBefore(a, sep.nextSibling);
        } else h3.append(sep, a);
    }

    function fallback(h3, shortTitle, mediaType) {
        const clean = encodeURIComponent(shortTitle.toLowerCase());
        const url = `https://anilist.co/search/${mediaType.toLowerCase()}?search=${clean}`;
        const last = [...h3.querySelectorAll('a')].pop();
        const sep = document.createElement('span'); sep.textContent = ' • '; sep.style.color = '#888';
        const a = document.createElement('a');
        a.href = url; a.textContent = 'AniList Search'; a.target = '_blank';
        replaceLinkWithIcon(a);
        if (last) {
            last.parentNode.insertBefore(sep, last.nextSibling);
            last.parentNode.insertBefore(a, sep.nextSibling);
        } else h3.append(sep, a);
    }

    // Init
    if (location.pathname.includes('/torrents.php')) handleDetailPage();
    else if (location.pathname === '/' || location.pathname === '') handleHomePage();
})();
