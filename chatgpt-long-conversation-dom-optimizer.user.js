// ==UserScript==
// @name         ChatGPT Long Conversation DOM Optimizer
// @name:tr      ChatGPT Uzun Sohbet DOM Optimize Edici
// @namespace    https://github.com/Cynrath
// @version      0.4.0
// @description  Optimizes long ChatGPT conversations and automatically collapses open reasoning blocks without relying on UI language.
// @description:tr Uzun ChatGPT sohbetlerini optimize eder ve açık reasoning/analiz bloklarını arayüz diline bağlı olmadan otomatik kapatır.
// @author       Cynrath
// @homepageURL  https://github.com/Cynrath/chatgpt-long-conversation-dom-optimizer
// @supportURL   https://github.com/Cynrath/chatgpt-long-conversation-dom-optimizer/issues
// @updateURL    https://raw.githubusercontent.com/Cynrath/chatgpt-long-conversation-dom-optimizer/main/chatgpt-long-conversation-dom-optimizer.user.js
// @downloadURL  https://raw.githubusercontent.com/Cynrath/chatgpt-long-conversation-dom-optimizer/main/chatgpt-long-conversation-dom-optimizer.user.js
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @license      MIT
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const APP = 'cgpt-lco';
    const STORAGE_KEY = `${APP}:config:v2`;
    const HIDDEN_ATTR = `data-${APP}-hidden`;
    const CV_ATTR = `data-${APP}-cv`;

    const SELECTORS = Object.freeze({
        thread: '#thread',
        wrapper: '[data-turn-id-container]',
        turn: 'section[data-testid^="conversation-turn-"][data-turn]',
    });

    const DEFAULT_CONFIG = Object.freeze({
        keepRecent: 40,
        revealStep: 20,
        autoThreshold: 80,
        autoOptimize: true,
        contentVisibility: true,
        autoCollapseAnalysis: true,
        showPanel: true,
        panelCollapsed: false,
    });

    const I18N = {
        en: {
            starting: 'Starting',
            waitingDom: 'Waiting for conversation DOM',
            paused: 'Paused',
            autoOff: 'Automatic optimization off',
            waitingThreshold: (a, b) => `Waiting for threshold (${a}/${b})`,
            scrollDown: 'Will optimize when you scroll down',
            hidden: (n) => `${n} old turns removed from render`,
            nothingToHide: 'No old turns to hide',
            allVisible: 'All turns are visible',
            revealed: (n) => `${n} old turns restored`,
            restoredPaused: 'Full history restored; optimizer paused',
            domWaiting: 'Waiting for DOM',
            turnsMissing: 'Conversation turns not found',
            stats: (all, visible, rendered) => `Turns ${all} | visible ${visible} | render ${rendered}`,
            optimize: 'Optimize',
            older: (n) => `+${n} older`,
            restore: 'Restore all',
            keepRecent: 'Keep recent turns',
            revealStep: 'Reveal step',
            threshold: 'Auto threshold',
            automatic: 'Automatic',
            reasoning: 'Reasoning',
            reasoningTitle: 'Automatically collapse open reasoning blocks; detection is language-independent',
            cvTitle: 'Use native content-visibility for off-screen rendered turns',
            collapsePanel: 'Collapse panel',
            expandPanel: 'Expand panel',
        },
        tr: {
            starting: 'Başlatılıyor',
            waitingDom: 'Sohbet DOM bekleniyor',
            paused: 'Duraklatıldı',
            autoOff: 'Otomatik optimizasyon kapalı',
            waitingThreshold: (a, b) => `Eşik bekleniyor (${a}/${b})`,
            scrollDown: 'Aşağı kaydırınca optimize edilecek',
            hidden: (n) => `${n} eski turn render dışı`,
            nothingToHide: 'Gizlenecek eski turn yok',
            allVisible: 'Tüm turnler görünür',
            revealed: (n) => `${n} eski turn geri açıldı`,
            restoredPaused: 'Tüm geçmiş geri açıldı; optimizer duraklatıldı',
            domWaiting: 'DOM bekleniyor',
            turnsMissing: 'Sohbet turnleri bulunamadı',
            stats: (all, visible, rendered) => `Turn ${all} | görünür ${visible} | render ${rendered}`,
            optimize: 'Optimize et',
            older: (n) => `+${n} eski`,
            restore: 'Tümünü geri aç',
            keepRecent: 'Görünür son turn',
            revealStep: 'Eski açma adımı',
            threshold: 'Otomatik eşik',
            automatic: 'Otomatik',
            reasoning: 'Reasoning',
            reasoningTitle: 'Açık reasoning/analiz bloklarını otomatik kapatır; arayüz diline bağlı değildir',
            cvTitle: 'Ekran dışındaki gerçek turnlerde native content-visibility kullanır',
            collapsePanel: 'Paneli daralt',
            expandPanel: 'Paneli aç',
        },
    };

    const lang = (
        document.documentElement.lang ||
        navigator.language ||
        'en'
    ).toLowerCase().startsWith('tr') ? 'tr' : 'en';

    const t = I18N[lang];

    const state = {
        config: loadConfig(),
        routeKey: currentRouteKey(),
        root: null,
        scroller: null,
        observer: null,
        panelHost: null,
        panel: null,
        paused: false,
        revealedExtra: 0,
        applyTimer: 0,
        initTimer: 0,
        settingsTimer: 0,
        lastStatus: t.starting,
        destroyed: false,
    };

    injectDocumentStyles();
    createPanel();
    scheduleInit(0);

    const routeTimer = window.setInterval(() => {
        if (state.destroyed) return;

        const routeKey = currentRouteKey();

        if (routeKey !== state.routeKey) {
            state.routeKey = routeKey;
            state.paused = false;
            state.revealedExtra = 0;
            resetObserver();
            clearOurMarks();
            scheduleInit(150);
            return;
        }

        if (!state.root?.isConnected) {
            resetObserver();
            scheduleInit(0);
            return;
        }

        collapseOpenAnalyses(false);
    }, 1500);

    window.ChatGPTDOMOptimizer = Object.freeze({
        stats: () => collectStats(),
        optimize: () => optimizeNow(true),
        revealOlder: (count = state.config.revealStep) =>
            revealOlder(Number(count) || state.config.revealStep),
        restore: () => restoreAll(true),
        collapseAnalyses: () => collapseOpenAnalyses(true),
        pause: () => {
            state.paused = true;
            restoreAll(false);
            setStatus(t.paused);
            updatePanel();
        },
        resume: () => {
            state.paused = false;
            state.revealedExtra = 0;
            optimizeNow(true);
        },
        config: () => Object.freeze({ ...state.config, storageKey: STORAGE_KEY }),
        destroy: () => destroy(),
    });

    function loadConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { ...DEFAULT_CONFIG };
            return sanitizeConfig({ ...DEFAULT_CONFIG, ...JSON.parse(raw) });
        } catch {
            return { ...DEFAULT_CONFIG };
        }
    }

    function sanitizeConfig(config) {
        return {
            keepRecent: clampInt(config.keepRecent, 5, 1000, DEFAULT_CONFIG.keepRecent),
            revealStep: clampInt(config.revealStep, 1, 500, DEFAULT_CONFIG.revealStep),
            autoThreshold: clampInt(config.autoThreshold, 10, 5000, DEFAULT_CONFIG.autoThreshold),
            autoOptimize: Boolean(config.autoOptimize),
            contentVisibility: Boolean(config.contentVisibility),
            autoCollapseAnalysis: config.autoCollapseAnalysis !== false,
            showPanel: config.showPanel !== false,
            panelCollapsed: Boolean(config.panelCollapsed),
        };
    }

    function saveConfig() {
        state.config = sanitizeConfig(state.config);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
    }

    function clampInt(value, min, max, fallback) {
        const n = Number.parseInt(value, 10);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    }

    function currentRouteKey() {
        return `${location.pathname}${location.search}`;
    }

    function injectDocumentStyles() {
        if (document.getElementById(`${APP}-style`)) return;

        const style = document.createElement('style');
        style.id = `${APP}-style`;
        style.textContent = `
            [${HIDDEN_ATTR}="1"] { display: none !important; }
            #thread[${CV_ATTR}="1"] ${SELECTORS.turn} {
                content-visibility: auto !important;
                contain-intrinsic-size: auto 240px !important;
            }
        `;
        document.documentElement.appendChild(style);
    }

    function scheduleInit(delay = 100) {
        window.clearTimeout(state.initTimer);
        state.initTimer = window.setTimeout(init, delay);
    }

    function init() {
        if (state.destroyed) return;

        const discovered = discoverConversationRoot();
        if (!discovered) {
            setStatus(t.waitingDom);
            updatePanel();
            scheduleInit(700);
            return;
        }

        if (state.root !== discovered.root) {
            resetObserver();
            state.root = discovered.root;
            state.scroller = discoverScroller(state.root);
            observeRoot(state.root);
        }

        applyContentVisibilityFlag();
        collapseOpenAnalyses(true);
        updatePanel();

        if (state.config.autoOptimize && !state.paused) {
            scheduleApply(250);
        } else {
            setStatus(state.paused ? t.paused : t.autoOff);
        }
    }

    function discoverConversationRoot() {
        const thread = document.querySelector(SELECTORS.thread);
        if (!thread) return null;

        const candidates = Array.from(thread.querySelectorAll(SELECTORS.wrapper));
        if (!candidates.length) return null;

        const parentCounts = new Map();
        for (const wrapper of candidates) {
            const parent = wrapper.parentElement;
            if (!parent) continue;
            parentCounts.set(parent, (parentCounts.get(parent) || 0) + 1);
        }

        let root = null;
        let bestCount = 0;
        for (const [parent, count] of parentCounts) {
            if (count > bestCount) {
                root = parent;
                bestCount = count;
            }
        }

        return root ? { thread, root } : null;
    }

    function getWrappers() {
        if (!state.root?.isConnected) return [];

        return Array.from(state.root.children).filter((el) =>
            el instanceof HTMLElement &&
            el.matches(SELECTORS.wrapper) &&
            el.dataset.turnIdContainer !== 'client-created-root'
        );
    }

    function discoverScroller(start) {
        for (let el = start; el && el !== document.body; el = el.parentElement) {
            const overflowY = getComputedStyle(el).overflowY;
            const canScroll = overflowY === 'auto' || overflowY === 'scroll';
            if (canScroll && el.scrollHeight > el.clientHeight + 2) return el;
        }

        return document.scrollingElement || document.documentElement;
    }

    function observeRoot(root) {
        state.observer = new MutationObserver((records) => {
            if (state.destroyed || state.paused) return;
            if (records.some((record) => record.type === 'childList')) {
                scheduleApply(300);
            }
        });
        state.observer.observe(root, { childList: true, subtree: false });
    }

    function resetObserver() {
        state.observer?.disconnect();
        state.observer = null;
        state.root = null;
        state.scroller = null;
    }

    function scheduleApply(delay = 250) {
        window.clearTimeout(state.applyTimer);
        state.applyTimer = window.setTimeout(() => {
            if (!state.destroyed) applyOptimization(false);
        }, delay);
    }

    function optimizeNow(scrollToBottomIfNeeded = false) {
        state.paused = false;
        state.revealedExtra = 0;

        if (!state.root?.isConnected) {
            scheduleInit(0);
            return;
        }

        const scroller = state.scroller || discoverScroller(state.root);

        if (scrollToBottomIfNeeded && scroller && !isNearBottom(scroller, 1000)) {
            scroller.scrollTop = scroller.scrollHeight;
            requestAnimationFrame(() =>
                requestAnimationFrame(() => applyOptimization(true))
            );
            return;
        }

        applyOptimization(true);
    }

    function applyOptimization(force = false) {
        if (state.destroyed || state.paused || !state.root?.isConnected) return;

        const wrappers = getWrappers();
        if (!wrappers.length) {
            updatePanel();
            return;
        }

        const thresholdReached = wrappers.length >= state.config.autoThreshold;

        if (!force && (!state.config.autoOptimize || !thresholdReached)) {
            restoreAll(false);
            setStatus(
                thresholdReached
                    ? t.autoOff
                    : t.waitingThreshold(wrappers.length, state.config.autoThreshold)
            );
            updatePanel();
            return;
        }

        state.scroller = state.scroller?.isConnected
            ? state.scroller
            : discoverScroller(state.root);

        const scroller = state.scroller;
        if (!force && scroller && !isNearBottom(scroller, 900)) {
            setStatus(t.scrollDown);
            updatePanel();
            return;
        }

        const keep = Math.min(
            wrappers.length,
            state.config.keepRecent + state.revealedExtra
        );
        const hideCount = Math.max(0, wrappers.length - keep);
        const wasNearBottom = scroller ? isNearBottom(scroller, 900) : false;
        const distanceFromBottom = scroller ? getDistanceFromBottom(scroller) : 0;
        const active = document.activeElement;
        let hidden = 0;

        for (let i = 0; i < wrappers.length; i += 1) {
            const wrapper = wrappers[i];
            let shouldHide = i < hideCount;

            if (shouldHide && active && wrapper.contains(active)) {
                shouldHide = false;
            }

            if (shouldHide) {
                wrapper.setAttribute(HIDDEN_ATTR, '1');
                hidden += 1;
            } else {
                wrapper.removeAttribute(HIDDEN_ATTR);
            }
        }

        if (wasNearBottom && scroller) {
            preserveBottomDistance(scroller, distanceFromBottom);
        }

        applyContentVisibilityFlag();
        setStatus(hidden ? t.hidden(hidden) : t.nothingToHide);
        updatePanel();
    }

    function revealOlder(count) {
        if (!state.root?.isConnected) return;

        const wrappers = getWrappers();
        const hidden = wrappers.filter(
            (wrapper) => wrapper.getAttribute(HIDDEN_ATTR) === '1'
        );

        if (!hidden.length) {
            setStatus(t.allVisible);
            updatePanel();
            return;
        }

        const amount = Math.min(
            hidden.length,
            clampInt(count, 1, 500, state.config.revealStep)
        );
        const anchor = wrappers.find(
            (wrapper) => wrapper.getAttribute(HIDDEN_ATTR) !== '1' && wrapper.isConnected
        );
        const beforeTop = anchor?.getBoundingClientRect().top ?? null;
        const scroller = state.scroller || discoverScroller(state.root);

        state.revealedExtra += amount;
        for (const wrapper of hidden.slice(-amount)) {
            wrapper.removeAttribute(HIDDEN_ATTR);
        }

        if (anchor && beforeTop !== null && scroller) {
            requestAnimationFrame(() => {
                const delta = anchor.getBoundingClientRect().top - beforeTop;
                if (Number.isFinite(delta) && Math.abs(delta) > 0.5) {
                    scroller.scrollTop += delta;
                }
                updatePanel();
            });
        } else {
            updatePanel();
        }

        setStatus(t.revealed(amount));
    }

    function restoreAll(pauseAfterRestore = false) {
        for (const wrapper of document.querySelectorAll(`[${HIDDEN_ATTR}="1"]`)) {
            wrapper.removeAttribute(HIDDEN_ATTR);
        }

        state.revealedExtra = 0;

        if (pauseAfterRestore) {
            state.paused = true;
            setStatus(t.restoredPaused);
        }

        updatePanel();
    }

    function clearOurMarks() {
        for (const el of document.querySelectorAll(`[${HIDDEN_ATTR}], [${CV_ATTR}]`)) {
            el.removeAttribute(HIDDEN_ATTR);
            el.removeAttribute(CV_ATTR);
        }
    }

    function applyContentVisibilityFlag() {
        const thread = document.querySelector(SELECTORS.thread);
        if (!thread) return;

        if (state.config.contentVisibility) {
            thread.setAttribute(CV_ATTR, '1');
        } else {
            thread.removeAttribute(CV_ATTR);
        }
    }

    function collapseOpenAnalyses(scanAll = false) {
        if (
            state.destroyed ||
            !state.config.autoCollapseAnalysis ||
            !state.root?.isConnected
        ) {
            return 0;
        }

        const wrappers = getWrappers();
        if (!wrappers.length) return 0;

        const targets = scanAll ? wrappers : wrappers.slice(-12);
        let collapsed = 0;

        for (const wrapper of targets) {
            const summaries = wrapper.querySelectorAll('span.block');

            for (const summary of summaries) {
                if (!(summary instanceof HTMLElement)) continue;
                if (summary.closest('[class*="group/tool-message"]')) continue;

                const content = summary.nextElementSibling;
                if (!(content instanceof HTMLElement)) continue;
                if (!isOpenAnalysisContent(content)) continue;

                const button = summary.querySelector('button');
                if (!(button instanceof HTMLButtonElement) || button.disabled) continue;

                button.click();
                collapsed += 1;
            }
        }

        return collapsed;
    }

    function isOpenAnalysisContent(element) {
        if (
            element.tagName !== 'DIV' ||
            element.hasAttribute('data-message-author-role')
        ) {
            return false;
        }
        const inlineHeight = element.style.height?.trim().toLowerCase() || '';
        if (inlineHeight !== 'auto') return false;
        if (element.querySelector('[data-message-author-role]')) return false;

        return Boolean(element.querySelector('.markdown, pre, [data-start]'));
    }

    function isNearBottom(scroller, tolerance = 700) {
        return getDistanceFromBottom(scroller) <= tolerance;
    }

    function getDistanceFromBottom(scroller) {
        return Math.max(
            0,
            scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop
        );
    }

    function preserveBottomDistance(scroller, distance) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const target =
                    scroller.scrollHeight -
                    scroller.clientHeight -
                    Math.max(0, distance);
                scroller.scrollTop = Math.max(0, target);
            });
        });
    }

    function collectStats() {
        const wrappers = getWrappers();
        const hidden = wrappers.filter(
            (wrapper) => wrapper.getAttribute(HIDDEN_ATTR) === '1'
        ).length;
        const rendered = wrappers.filter(
            (wrapper) => wrapper.querySelector(SELECTORS.turn)
        ).length;

        return Object.freeze({
            route: state.routeKey,
            wrappers: wrappers.length,
            visibleWrappers: wrappers.length - hidden,
            hiddenWrappers: hidden,
            renderedTurns: rendered,
            nativeVirtualizedPlaceholders: wrappers.length - rendered,
            keepRecent: state.config.keepRecent,
            revealedExtra: state.revealedExtra,
            autoThreshold: state.config.autoThreshold,
            autoOptimize: state.config.autoOptimize,
            contentVisibility: state.config.contentVisibility,
            autoCollapseAnalysis: state.config.autoCollapseAnalysis,
            paused: state.paused,
            status: state.lastStatus,
        });
    }

    function setStatus(text) {
        state.lastStatus = text;
    }

    function createPanel() {
        if (!state.config.showPanel || state.panelHost?.isConnected) return;

        const host = document.createElement('div');
        host.id = `${APP}-panel-host`;
        host.style.cssText = [
            'all:initial',
            'position:fixed',
            'right:12px',
            'bottom:92px',
            'z-index:2147483646',
        ].join(';');

        const shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
            <style>
                :host { all: initial; }
                .box {
                    width: 286px;
                    box-sizing: border-box;
                    border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
                    border-radius: 12px;
                    background: color-mix(in srgb, Canvas 94%, transparent);
                    color: CanvasText;
                    box-shadow: 0 8px 30px rgba(0,0,0,.22);
                    backdrop-filter: blur(12px);
                    font: 12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
                    overflow: hidden;
                }
                .head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    padding: 9px 10px;
                    font-weight: 650;
                    border-bottom: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
                }
                .body { padding: 9px 10px 10px; }
                .stats { opacity: .88; margin-bottom: 6px; }
                .status {
                    opacity: .68;
                    margin-bottom: 9px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .row { display: flex; gap: 6px; margin-top: 6px; }
                button, input[type="number"] {
                    appearance: none;
                    border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
                    background: color-mix(in srgb, Canvas 86%, CanvasText 5%);
                    color: CanvasText;
                    border-radius: 8px;
                    font: inherit;
                    padding: 6px 8px;
                }
                button { cursor: pointer; }
                button:hover { background: color-mix(in srgb, Canvas 78%, CanvasText 9%); }
                button:disabled { opacity: .45; cursor: default; }
                .grow { flex: 1; }
                .mini { padding: 2px 7px; border-radius: 7px; }
                label { display: flex; align-items: center; gap: 5px; cursor: pointer; }
                input { margin: 0; }
                input[type="number"] { width: 62px; box-sizing: border-box; padding: 6px 7px; }
                .numeric-settings {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    gap: 6px 8px;
                    align-items: center;
                    margin-top: 8px;
                }
                .numeric-settings label { justify-content: space-between; min-width: 0; }
                .numeric-settings span { opacity: .82; }
                .settings {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    margin-top: 8px;
                }
                .collapsed .body { display: none; }
                .collapsed { width: auto; min-width: 122px; }
            </style>

            <div class="box">
                <div class="head">
                    <span class="title">ChatGPT DOM</span>
                    <button class="mini collapse" type="button" title="${t.collapsePanel}">–</button>
                </div>
                <div class="body">
                    <div class="stats">${t.domWaiting}</div>
                    <div class="status">${t.starting}</div>

                    <div class="row">
                        <button class="grow optimize" type="button">${t.optimize}</button>
                        <button class="older" type="button">${t.older(DEFAULT_CONFIG.revealStep)}</button>
                    </div>

                    <div class="row">
                        <button class="grow restore" type="button">${t.restore}</button>
                    </div>

                    <div class="numeric-settings">
                        <label>
                            <span>${t.keepRecent}</span>
                            <input class="keep" type="number" min="5" max="1000" step="1" inputmode="numeric">
                        </label>
                        <label>
                            <span>${t.revealStep}</span>
                            <input class="step" type="number" min="1" max="500" step="1" inputmode="numeric">
                        </label>
                        <label>
                            <span>${t.threshold}</span>
                            <input class="threshold" type="number" min="10" max="5000" step="1" inputmode="numeric">
                        </label>
                    </div>

                    <div class="settings">
                        <label><input class="auto" type="checkbox"> ${t.automatic}</label>
                        <label title="${t.cvTitle}"><input class="cv" type="checkbox"> CV</label>
                        <label title="${t.reasoningTitle}"><input class="analysis" type="checkbox"> ${t.reasoning}</label>
                    </div>
                </div>
            </div>
        `;

        document.documentElement.appendChild(host);
        state.panelHost = host;
        state.panel = {
            box: shadow.querySelector('.box'),
            title: shadow.querySelector('.title'),
            stats: shadow.querySelector('.stats'),
            status: shadow.querySelector('.status'),
            optimize: shadow.querySelector('.optimize'),
            older: shadow.querySelector('.older'),
            restore: shadow.querySelector('.restore'),
            keep: shadow.querySelector('.keep'),
            step: shadow.querySelector('.step'),
            threshold: shadow.querySelector('.threshold'),
            auto: shadow.querySelector('.auto'),
            cv: shadow.querySelector('.cv'),
            analysis: shadow.querySelector('.analysis'),
            collapse: shadow.querySelector('.collapse'),
        };

        syncPanelInputs();

        state.panel.optimize.addEventListener('click', () => optimizeNow(true));
        state.panel.older.addEventListener('click', () => revealOlder(state.config.revealStep));
        state.panel.restore.addEventListener('click', () => restoreAll(true));

        const commitNumericSettings = () => {
            state.config.keepRecent = clampInt(
                state.panel.keep.value,
                5,
                1000,
                DEFAULT_CONFIG.keepRecent
            );
            state.config.revealStep = clampInt(
                state.panel.step.value,
                1,
                500,
                DEFAULT_CONFIG.revealStep
            );
            state.config.autoThreshold = clampInt(
                state.panel.threshold.value,
                10,
                5000,
                DEFAULT_CONFIG.autoThreshold
            );

            state.revealedExtra = 0;
            saveConfig();
            syncPanelInputs();
            if (!state.paused) optimizeNow(false);
            updatePanel();
        };

        const scheduleNumericCommit = () => {
            window.clearTimeout(state.settingsTimer);
            state.settingsTimer = window.setTimeout(commitNumericSettings, 350);
        };

        for (const input of [state.panel.keep, state.panel.step, state.panel.threshold]) {
            input.addEventListener('input', scheduleNumericCommit);
            input.addEventListener('change', () => {
                window.clearTimeout(state.settingsTimer);
                commitNumericSettings();
            });
            input.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                window.clearTimeout(state.settingsTimer);
                commitNumericSettings();
                input.blur();
            });
        }

        state.panel.auto.addEventListener('change', () => {
            state.config.autoOptimize = state.panel.auto.checked;
            saveConfig();
            if (state.config.autoOptimize) {
                state.paused = false;
                scheduleApply(0);
            }
            updatePanel();
        });

        state.panel.cv.addEventListener('change', () => {
            state.config.contentVisibility = state.panel.cv.checked;
            saveConfig();
            applyContentVisibilityFlag();
            updatePanel();
        });

        state.panel.analysis.addEventListener('change', () => {
            state.config.autoCollapseAnalysis = state.panel.analysis.checked;
            saveConfig();
            if (state.config.autoCollapseAnalysis) collapseOpenAnalyses(true);
            updatePanel();
        });

        if (state.config.panelCollapsed) {
            state.panel.box.classList.add('collapsed');
            state.panel.collapse.textContent = '+';
            state.panel.collapse.title = t.expandPanel;
        }

        state.panel.collapse.addEventListener('click', () => {
            const collapsed = state.panel.box.classList.toggle('collapsed');
            state.config.panelCollapsed = collapsed;
            saveConfig();
            state.panel.collapse.textContent = collapsed ? '+' : '–';
            state.panel.collapse.title = collapsed ? t.expandPanel : t.collapsePanel;
            updatePanel();
        });
    }

    function syncPanelInputs() {
        if (!state.panel) return;
        state.panel.keep.value = String(state.config.keepRecent);
        state.panel.step.value = String(state.config.revealStep);
        state.panel.threshold.value = String(state.config.autoThreshold);
        state.panel.auto.checked = state.config.autoOptimize;
        state.panel.cv.checked = state.config.contentVisibility;
        state.panel.analysis.checked = state.config.autoCollapseAnalysis;
    }

    function updatePanel() {
        if (!state.panel) return;

        const stats = collectStats();
        state.panel.stats.textContent = stats.wrappers
            ? t.stats(stats.wrappers, stats.visibleWrappers, stats.renderedTurns)
            : t.turnsMissing;
        state.panel.status.textContent = state.lastStatus;
        state.panel.title.textContent = stats.hiddenWrappers
            ? `ChatGPT DOM ${stats.hiddenWrappers}↓`
            : 'ChatGPT DOM';
        state.panel.older.textContent = t.older(state.config.revealStep);
        state.panel.older.disabled = stats.hiddenWrappers === 0;
        state.panel.restore.disabled = stats.hiddenWrappers === 0 && !state.paused;
        syncPanelInputs();
    }

    function destroy() {
        if (state.destroyed) return;
        state.destroyed = true;

        window.clearInterval(routeTimer);
        window.clearTimeout(state.applyTimer);
        window.clearTimeout(state.initTimer);
        window.clearTimeout(state.settingsTimer);

        resetObserver();
        clearOurMarks();
        document.getElementById(`${APP}-style`)?.remove();
        state.panelHost?.remove();
        state.panelHost = null;
        state.panel = null;

        try {
            delete window.ChatGPTDOMOptimizer;
        } catch {
        }
    }
})();
