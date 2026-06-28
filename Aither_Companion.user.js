// ==UserScript==
// @name         Aither companion
// @version      1.5
// @description  Added Letterboxd ratings under 'Extra Information', Added Aither direct link on Letterboxd, made section types collapsible on torrent tables, moved Full Discs to the bottom + Torrent Title Cleaner + IMDb Parental Guidance Notes
// @match        *://aither.cc/torrents/*
// @match        *://aither.cc/requests/*
// @match        *://aither.cc/torrents/similar/*
// @match        *://letterboxd.com/film/*
// @updateURL    https://mitsukiharuko.github.io/waitForKeyElements/Aither_Companion.user.js
// @downloadURL  https://mitsukiharuko.github.io/waitForKeyElements/Aither_Companion.user.js
// @namespace    https://github.com/frenchcutgreenbean/UNIT3D-IS-COOL/
// @author       mitsuki
// @icon         https://i.imgur.com/caImJHQ.png
// @grant        GM.xmlHttpRequest
// ==/UserScript==

(function () {
    "use strict";

    /* ====================== COMMON UTILITIES ====================== */
    function addStyle(css) {
        const style = document.createElement("style");
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* ====================== UNIT3D - TORRENT TITLE CLEANER ====================== */
    const VIDEO_CODEC_PATTERNS = [
        { regex: /\bHEVC\b|\bH\.?265\b|\bH265\b|\bx265\b/i, value: 'H.265' },
        { regex: /\bAVC\b|\bH\.?264\b|\bH264\b|\bx264\b/i, value: 'H.264' },
        { regex: /\bAV1\b/i, value: 'AV1' },
        { regex: /\bMPEG-?2\b|\bMPEG2\b/i, value: 'MPEG-2' },
    ];

    const RESOLUTIONS = ['4320p', '2160p', '1080p', '1080i', '720p', '480p', '576p'];

    const SOURCE_PATTERNS = [
        { regex: /\bUHD[\s-]*Blu-?ray\b/i, value: 'UHD BluRay' },
        { regex: /\bBlu-?ray\b/i, value: 'BluRay' },
        { regex: /\bWEB[-\s]?DL\b/i, value: 'WEB-DL' },
        { regex: /\bWEBRip\b/i, value: 'WEBRip' },
        { regex: /\bHDTV\b/i, value: 'HDTV' },
        { regex: /\b(?:2x)?DVD/i, value: 'DVD' },
    ];

    const extractReleaseGroup = (normalized) => {
        const lastDashIndex = normalized.lastIndexOf('-');
        if (lastDashIndex === -1) return { group: '', base: normalized };
        let candidate = normalized.slice(lastDashIndex + 1).trim();
        if (/^[A-Za-z0-9]{2,12}$/.test(candidate) ||
            /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/.test(candidate)) {
            if (!/^(?:2160|1080|720|480|576|REPACK|REMUX|Hybrid|DV|HDR|TrueHD|DTS|DD|NTSC|PAL)/i.test(candidate)) {
                return {
                    group: candidate,
                    base: normalized.slice(0, lastDashIndex).trim()
                };
            }
        }
        return { group: '', base: normalized };
    };

    const formatTorrentName = (name) => {
        if (!name) return [];
        let normalized = name.replace(/\s+/g, ' ').trim();
        const { group, base } = extractReleaseGroup(normalized);
        normalized = base || normalized;

        const resolution = RESOLUTIONS.find(res => new RegExp(`\\b${res}\\b`, 'i').test(normalized)) || '';

        let source = '';
        for (const p of SOURCE_PATTERNS) {
            if (p.regex.test(normalized)) {
                source = p.value;
                break;
            }
        }

        const videoCodec = VIDEO_CODEC_PATTERNS.find(p => p.regex.test(normalized))?.value || '';

        let audio = '';
        if (/\bTrueHD\b/i.test(normalized)) audio = 'TrueHD';
        else if (/\bDTS-HD\s*MA\b/i.test(normalized)) audio = 'DTS-HD MA';
        else if (/\bDTS-HD\b/i.test(normalized)) audio = 'DTS-HD';
        else if (/\bDTS\b/i.test(normalized)) audio = 'DTS';
        else if (/\bDD\+|DDP|E-?AC-?3\b/i.test(normalized)) audio = 'DD+';
        else if (/\bDD\b|\bDolby Digital\b/i.test(normalized)) audio = 'DD';

        const channelsMatch = normalized.match(/\b(\d+\.?\d*)\s*ch\b/i) ||
                             normalized.match(/\b(7\.1|5\.1|2\.0|2\.1|1\.0)\b/i);
        if (channelsMatch && audio) {
            audio += ` ${channelsMatch[1]}`;
        }

        const hasExplicitHybrid = /\bHybrid\b/i.test(normalized);
        const hasHDR = /\bHDR(?:10|\+)?\b/i.test(normalized);
        const hasDV = /\b(?:DV|Dolby.?Vision)\b/i.test(normalized);
        const hybrid = (hasExplicitHybrid || (hasHDR && hasDV)) ? 'Hybrid' : '';

        const parts = [
            resolution,
            source,
            videoCodec,
            audio,
            hybrid,
            group
        ].filter(Boolean);

        return parts;
    };

    const applyCleanTitle = (element) => {
        if (!element || element.dataset.cleaned) return;
        const originalText = element.textContent.trim();
        const cleanedParts = formatTorrentName(originalText);
        if (cleanedParts.length === 0) return;
        element.textContent = cleanedParts.join(' / ');
        element.dataset.cleaned = '1';
        element.style.fontWeight = '500';
    };

    const cleanAllTitles = () => {
        document.querySelectorAll('.torrent-search--grouped__name a').forEach(applyCleanTitle);
        document.querySelectorAll('.torrent__name').forEach(applyCleanTitle);
        document.querySelectorAll('.torrent-search--list__name').forEach(applyCleanTitle);
        document.querySelectorAll('.similar-torrents__name a, .similar-torrents__name').forEach(applyCleanTitle);
    };

    const initTitleCleaner = () => {
        cleanAllTitles();
        const observer = new MutationObserver(cleanAllTitles);
        observer.observe(document.body, { childList: true, subtree: true });
    };

    /* ====================== UNIT3D - META RATINGS ====================== */
    function buildElement(siteName, url, logo, rating, count) {
        if (!rating) return;
        const extraHeader = Array.from(document.querySelectorAll("h2"))
            .find(el => el.innerText.trim().toLowerCase() === "extra information");
        if (!extraHeader) return;

        const img = document.createElement("img");
        img.className = `${siteName.toLowerCase()}-chip__icon`;
        img.src = logo || `https://www.google.com/s2/favicons?sz=64&domain=${siteName.toLowerCase()}.com`;

        const iconStyle = `
            .${siteName.toLowerCase()}-chip__icon {
                grid-area: image; text-align: center; line-height: 40px; font-size: 14px;
                color: var(--meta-chip-icon-fg); width: 40px; height: 40px; border-radius: 5%;
            }`;

        const articleElement = extraHeader.closest("section");
        const meta_id_tag = document.createElement("a");
        meta_id_tag.className = "meta-chip";
        meta_id_tag.href = url;
        meta_id_tag.target = "_blank";

        const ratingName = document.createElement("h2");
        ratingName.className = "meta-chip__name";
        ratingName.innerText = siteName;

        const ratingValue = document.createElement("h3");
        ratingValue.className = "meta-chip__value";
        ratingValue.innerText = `${rating}★`;
        if (count) {
            const span = document.createElement("span");
            span.style.color = "#aaaaaa";
            span.textContent = ` ${count} Votes`;
            ratingValue.appendChild(span);
        }

        meta_id_tag.append(img, ratingName, ratingValue);
        articleElement.prepend(meta_id_tag);
        addStyle(iconStyle);
    }

    function handleLetterboxd(id) {
        const url = `https://letterboxd.com/imdb/${id}`;
        GM.xmlHttpRequest({
            method: "GET", url,
            onload: r => {
                if (r.status !== 200) return;
                const m = r.responseText.match(/<script type="application\/ld\+json">[\s\S]*?\/\* <!\[CDATA\[ \*\/([\s\S]*?)\/\* \]\]> \*\/[\s\S]*?<\/script>/);
                if (!m) return;
                try {
                    const agg = JSON.parse(m[1]).aggregateRating;
                    if (agg) buildElement("Letterboxd", r.finalUrl, letterboxdLogo, agg.ratingValue, agg.ratingCount);
                } catch(e){}
            }
        });
    }

    function getIMDBID() {
        const a = document.querySelector('[href*="://www.imdb.com/title/tt"]');
        if (a) {
            const id = a.href.match(/tt\d+/)[0];
            if (id) handleLetterboxd(id);
        }
    }

    const letterboxdLogo = `data:image/png;base64,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`;

    /* ====================== COLLAPSIBLE SIMILAR TORRENTS ====================== */
    function initCollapsibleSimilarTorrents() {
        const table = document.querySelector('.similar-torrents__torrents');
        if (!table) return;

        let sections = Array.from(table.querySelectorAll('tbody:nth-child(n+2)'));
        const fullDiscIndex = sections.findIndex(tbody => {
            const typeCell = tbody.querySelector('.similar-torrents__type');
            return typeCell && /full.?disc/i.test(typeCell.innerText.trim());
        });

        if (fullDiscIndex !== -1) {
            const fullDiscTbody = sections.splice(fullDiscIndex, 1)[0];
            sections.push(fullDiscTbody);
        }

        sections.forEach(tbody => table.appendChild(tbody));

        const storageKey = 'hiddenSimilarTorrentTypes';
        let hiddenTypes = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));

        sections.forEach(tbody => {
            const headerRow = tbody.querySelector('tr:first-child');
            if (!headerRow) return;
            const typeCell = headerRow.querySelector('.similar-torrents__type');
            if (!typeCell) return;
            const typeName = typeCell.innerText.trim();
            if (!typeName) return;

            const placeholder = document.createElement('tr');
            placeholder.className = 'similar-torrents-placeholder';
            placeholder.style.cursor = 'pointer';
            placeholder.innerHTML = `
                <td colspan="10" style="padding: 6px 10px 6px 15px; font-size: 13px; font-weight: 400; color: #7a80a0;">
                    ${typeName}
                </td>
            `;

            let isCollapsed = hiddenTypes.has(typeName);

            function applyState() {
                if (isCollapsed) {
                    headerRow.style.display = 'none';
                    Array.from(tbody.children).forEach((row, i) => {
                        if (i > 0) row.style.display = 'none';
                    });
                    if (!placeholder.parentNode) headerRow.after(placeholder);
                } else {
                    headerRow.style.display = '';
                    Array.from(tbody.children).forEach(row => row.style.display = '');
                    placeholder.remove();
                }
            }

            function toggle() {
                isCollapsed = !isCollapsed;
                if (isCollapsed) hiddenTypes.add(typeName);
                else hiddenTypes.delete(typeName);
                localStorage.setItem(storageKey, JSON.stringify([...hiddenTypes]));
                applyState();
            }

            typeCell.style.cursor = 'pointer';
            typeCell.addEventListener('click', e => {
                if (e.target.tagName === 'A') return;
                toggle();
            });
            placeholder.addEventListener('click', toggle);
            applyState();
        });

        addStyle(`
            .similar-torrents-placeholder:hover td { background-color: #252f45 !important; }
            .similar-torrents__torrents tr { transition: background-color 0.1s; }
        `);
    }

    /* ====================== LETTERBOXD - AITHER BUTTON ====================== */
    function runWhenReady(readySelector, callback) {
        let attempts = 0;
        const tryNow = () => {
            const elem = document.querySelector(readySelector);
            if (elem) callback(elem);
            else if (++attempts < 40) setTimeout(tryNow, 200 * Math.pow(1.1, attempts));
        };
        tryNow();
    }

    function createAitherLinkButton(tmdbId) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `https://aither.cc/torrents/similar/1.${tmdbId}`;
        a.target = '_blank';
        a.className = 'button -action -has-icon';
        a.style.cssText = 'display:inline-flex;align-items:center;background:#445566;color:#9ab;text-shadow:none;background-image:none;box-shadow:none;border-color:transparent;';
        a.addEventListener('mouseover', () => a.style.backgroundColor = '#556677');
        a.addEventListener('mouseout', () => a.style.backgroundColor = '#445566');

        const img = document.createElement('img');
        img.src = 'https://aither.cc/favicon/favicon.svg';
        img.style.cssText = 'margin-right:0.5em;width:16px;height:16px;';

        const span = document.createElement('span');
        span.textContent = 'View on Aither';

        a.append(img, span);
        li.appendChild(a);
        return li;
    }

    function addAitherButton() {
        const tmdbLink = document.querySelector('a[href*="themoviedb.org/movie"]');
        if (!tmdbLink) return;
        const match = tmdbLink.href.match(/\/movie\/(\d+)/);
        if (!match) return;

        runWhenReady(".js-actions-panel", container => {
            container.appendChild(createAitherLinkButton(match[1]));
        });
    }

    /* ====================== IMDb PARENTAL GUIDANCE HELPER ====================== */
    function initParentalGuidance() {
        const style = document.createElement('style');
        style.textContent = `
            .parentalspoiler { color: transparent; }
            .parentalspoiler:hover { color: inherit; }
            .parentalHeader {
                color: #aaa;
                margin-top: 12px;
                margin-bottom: 5px;
                cursor: pointer;
            }
            .hide { display: none; }
        `;
        document.head.appendChild(style);

        const imdbAnchor = document.querySelector('a[href*="imdb.com/title/tt"]');
        if (!imdbAnchor) return;
        const match = imdbAnchor.href.match(/tt\d+/);
        const imdbId = match ? match[0] : null;
        if (!imdbId) return;

        const advisoryDiv = document.createElement('div');
        const newPanel = document.createElement('section');
        newPanel.className = 'panelV2';
        newPanel.id = 'parents_guide';
        newPanel.style.marginTop = '0';

        const header = document.createElement('header');
        header.className = 'panel__header';
        const title = document.createElement('h2');
        title.className = 'panel__heading';
        title.textContent = 'IMDb Parental Notes';
        header.appendChild(title);

        const panelBody = document.createElement('div');
        panelBody.className = 'panel__body';
        panelBody.style.padding = '.75rem 1rem';
        panelBody.style.display = 'none';
        panelBody.appendChild(advisoryDiv);

        newPanel.appendChild(header);
        newPanel.appendChild(panelBody);

        const torrentGroupPanel = document.querySelector('section.panelV2[x-data="torrentGroup"]');
        if (torrentGroupPanel) {
            torrentGroupPanel.insertAdjacentElement('afterend', newPanel);
        } else {
            const titleEl = document.querySelector('.meta__title');
            const anchor = titleEl?.closest('section, div') || document.querySelector('main') || document.body;
            anchor.insertAdjacentElement('afterend', newPanel);
        }

        const globalToggle = document.createElement('a');
        globalToggle.href = '#';
        globalToggle.style.cssText = 'margin-left:10px;cursor:pointer;font-size:0.9em;display:inline-flex;align-items:center;gap:6px;';
        const icon = document.createElement('i');
        icon.className = 'fas fa-minus-circle';
        globalToggle.appendChild(icon);
        header.appendChild(globalToggle);

        let panelVisible = true;
        const togglePanel = (e) => {
            if (e) e.preventDefault();
            panelVisible = !panelVisible;
            panelBody.style.display = panelVisible ? 'block' : 'none';
            icon.className = panelVisible ? 'fas fa-minus-circle' : 'fas fa-plus-circle';
        };

        panelBody.style.display = 'block';
        globalToggle.onclick = togglePanel;
        header.style.cursor = 'pointer';
        header.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            togglePanel(e);
        });

        const graphQlReq = {
            query: `query {
              title(id: "${imdbId}") {
                parentsGuide {
                  categories {
                    category { text }
                    severity { text }
                    guideItems(first: 100) {
                      edges {
                        node {
                          ... on ParentsGuideItem {
                            isSpoiler
                            text { plainText }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }`
        };

        GM.xmlHttpRequest({
            method: 'POST',
            url: 'https://api.graphql.imdb.com',
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(graphQlReq),
            onload: function (response) {
                try {
                    const body = JSON.parse(response.responseText);
                    const categories = body?.data?.title?.parentsGuide?.categories;
                    if (!categories) return;

                    categories.forEach(cat => {
                        const container = document.createElement('div');
                        const h4 = document.createElement('h4');
                        h4.className = 'parentalHeader';

                        const severity = document.createElement('span');
                        const sev = cat?.severity?.text || 'Unknown';
                        const colorMap = { None: '#F2DB83', Mild: '#c5e197', Moderate: '#fbca8c', Severe: '#ffb3ad' };
                        severity.style.color = colorMap[sev] || '#ccc';
                        severity.textContent = sev;

                        h4.textContent = `${cat.category.text} - `;
                        h4.appendChild(severity);
                        h4.appendChild(document.createTextNode(` - (${cat.guideItems.edges.length})`));

                        const list = document.createElement('ul');
                        list.style.margin = '0 15px';
                        list.classList.add('hide');

                        cat.guideItems.edges.forEach(edge => {
                            const li = document.createElement('li');
                            const a = document.createElement('a');
                            a.style.color = 'inherit';
                            a.textContent = edge.node.text.plainText;
                            li.appendChild(a);
                            list.appendChild(li);
                        });

                        container.appendChild(h4);
                        container.appendChild(list);
                        advisoryDiv.appendChild(container);

                        h4.onclick = () => list.classList.toggle('hide');
                    });
                } catch (e) {
                    console.error('[Parental Guide] Parse error:', e);
                }
            }
        });
    }

    /* ====================== MAIN ====================== */
    const pathname = window.location.pathname;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTitleCleaner);
    } else {
        initTitleCleaner();
    }

    if (/\/(torrents|requests)\//.test(pathname)) {
        getIMDBID();
    }

    if (pathname.includes('/torrents/similar/')) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initCollapsibleSimilarTorrents);
        } else {
            initCollapsibleSimilarTorrents();
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initParentalGuidance);
        } else {
            initParentalGuidance();
        }
    }

    if (window.location.hostname === 'letterboxd.com' && pathname.startsWith('/film/')) {
        addAitherButton();
    }
})();
