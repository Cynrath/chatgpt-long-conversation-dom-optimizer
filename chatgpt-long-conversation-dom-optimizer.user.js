// ==UserScript==
// @name         ChatGPT Long Conversation DOM Optimizer
// @name:tr      ChatGPT Uzun Sohbet DOM Optimize Edici
// @namespace    https://github.com/Cynrath
// @version      0.6.0
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
    const HANDLED_REASONING_KEY = `${APP}:handled-reasoning:v1`;
    const LEGACY_SESSION_KEYS = [`${APP}:manual-reasoning:v1`];
    const FEEDBACK_MS = 2600;
    const HIDDEN_ATTR = `data-${APP}-hidden`;
    const CV_ATTR = `data-${APP}-cv`;

    const SELECTORS = Object.freeze({
        thread: '#thread',
        wrapper: '[data-turn-id-container]',
        turn: 'section[data-testid^="conversation-turn-"][data-turn]',
        streaming: '[data-testid="stop-button"], [data-testid="composer-stop-button"], [data-is-streaming="true"], [data-streaming="true"]',
    });

    const DEFAULT_CONFIG = Object.freeze({
        keepRecent: 40,
        revealStep: 20,
        autoThreshold: 80,
        autoOptimize: true,
        contentVisibility: true,
        autoCollapseAnalysis: true,
        keyboardShortcut: true,
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
            stats: (all, visible, hidden) => `Turns ${all} | visible ${visible} | hidden ${hidden}`,
            reasoningStats: (handled, open) => `Reasoning handled ${handled} | open ${open}`,
            optimize: 'Optimize',
            domOnly: 'DOM only',
            older: (n) => `+${n} older`,
            restore: 'Restore all',
            keepRecent: 'Keep recent turns',
            revealStep: 'Reveal step',
            threshold: 'Auto threshold',
            automatic: 'Automatic',
            reasoning: 'Reasoning',
            reasoningTitle: 'Auto-collapse each reasoning block only once; if you open it later, it stays open',
            forceOptimizeTitle: 'Optimize DOM and close every currently open reasoning block once (Alt+Shift+O)',
            domOnlyTitle: 'Optimize old conversation DOM without changing reasoning blocks',
            shortcut: 'Shortcut',
            shortcutTitle: 'Enable Alt+Shift+O for full Optimize',
            resetReasoning: 'Reset reasoning history',
            feedbackOptimize: (hidden, collapsed) => `Optimized: ${hidden} old turns hidden · ${collapsed} reasoning closed`,
            feedbackDomOnly: (hidden) => `DOM optimized: ${hidden} old turns hidden`,
            feedbackReset: (count) => `Reasoning history reset: ${count} entries cleared`,
            safetyPaused: 'Safety pause: ChatGPT DOM structure changed',
            safetyRestored: 'DOM structure check passed; optimizer resumed',
            noConversation: 'Conversation DOM is not ready yet',
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
            stats: (all, visible, hidden) => `Turn ${all} | görünür ${visible} | gizli ${hidden}`,
            reasoningStats: (handled, open) => `Reasoning işlendi ${handled} | açık ${open}`,
            optimize: 'Optimize et',
            domOnly: 'Sadece DOM',
            older: (n) => `+${n} eski`,
            restore: 'Tümünü geri aç',
            keepRecent: 'Görünür son turn',
            revealStep: 'Eski açma adımı',
            threshold: 'Otomatik eşik',
            automatic: 'Otomatik',
            reasoning: 'Reasoning',
            reasoningTitle: 'Her reasoning/analiz bloğunu yalnızca ilk gördüğünde otomatik kapatır; sonradan açarsan açık kalır',
            forceOptimizeTitle: 'DOM’u optimize et ve şu anda açık olan tüm reasoning bloklarını kapat (Alt+Shift+O)',
            domOnlyTitle: 'Reasoning bloklarına dokunmadan eski sohbet DOM’unu optimize et',
            shortcut: 'Kısayol',
            shortcutTitle: 'Tam Optimize için Alt+Shift+O kısayolunu etkinleştir',
            resetReasoning: 'Reasoning geçmişini sıfırla',
            feedbackOptimize: (hidden, collapsed) => `Optimize edildi: ${hidden} eski turn gizlendi · ${collapsed} reasoning kapatıldı`,
            feedbackDomOnly: (hidden) => `DOM optimize edildi: ${hidden} eski turn gizlendi`,
            feedbackReset: (count) => `Reasoning geçmişi sıfırlandı: ${count} kayıt temizlendi`,
            safetyPaused: 'Güvenlik duraklatması: ChatGPT DOM yapısı değişti',
            safetyRestored: 'DOM yapısı kontrol edildi; optimizer devam ediyor',
            noConversation: 'Sohbet DOM’u henüz hazır değil',
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

    cleanupLegacyStorage();

    const state = {
        config: loadConfig(),
        handledReasoning: loadHandledReasoning(),
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
        feedbackTimer: 0,
        domMismatchCount: 0,
        safetyPaused: false,
        safetyIssue: '',
        lastStatus: t.starting,
        destroyed: false,
    };

    injectDocumentStyles();
    createPanel();
    document.addEventListener('keydown', handleKeyboardShortcut, true);
    scheduleInit(0);

    const routeTimer = window.setInterval(() => {
        if (state.destroyed) return;

        const routeKey = currentRouteKey();

        if (routeKey !== state.routeKey) {
            state.routeKey = routeKey;
            state.paused = false;
            state.revealedExtra = 0;
            state.domMismatchCount = 0;
            state.safetyPaused = false;
            state.safetyIssue = '';
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

        if (!runDomSelfCheck(false)) return;
        collapseOpenAnalyses(false);
    }, 1500);

    window.ChatGPTDOMOptimizer = Object.freeze({
        stats: () => collectStats(),
        optimize: () => runFullOptimize(),
        optimizeDom: () => runDomOnlyOptimize(),
        resetReasoning: () => resetReasoningHistory(),
        selfCheck: () => runDomSelfCheck(true),
        revealOlder: (count = state.config.revealStep) =>
            revealOlder(Number(count) || state.config.revealStep),
        restore: () => restoreAll(true),
        collapseAnalyses: () => collapseOpenAnalyses(true, true),
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
            keyboardShortcut: config.keyboardShortcut !== false,
            showPanel: config.showPanel !== false,
            panelCollapsed: Boolean(config.panelCollapsed),
        };
    }

    function saveConfig() {
        state.config = sanitizeConfig(state.config);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
    }

    function cleanupLegacyStorage() {
        for (const key of LEGACY_SESSION_KEYS) {
            try {
                sessionStorage.removeItem(key);
            } catch {
            }
        }
    }

    function loadHandledReasoning() {
        try {
            const raw = sessionStorage.getItem(HANDLED_REASONING_KEY);
            if (!raw) return new Set();

            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return new Set();

            return new Set(
                parsed
                    .filter((value) => typeof value === 'string')
                    .slice(-1000)
            );
        } catch {
            return new Set();
        }
    }

    function saveHandledReasoning() {
        try {
            const values = Array.from(state.handledReasoning).slice(-1000);
            sessionStorage.setItem(HANDLED_REASONING_KEY, JSON.stringify(values));
        } catch {
        }
    }

    function getReasoningKey(wrapper, summary) {
        const turnId =
            wrapper.getAttribute('data-turn-id-container') ||
            wrapper.getAttribute('data-turn-id');

        if (!turnId) return null;

        const summaries = Array.from(wrapper.querySelectorAll('span.block'));
        const index = summaries.indexOf(summary);

        if (index < 0) return null;

        return `${location.pathname}:${turnId}:${index}`;
    }

    function markReasoningHandled(key) {
        if (!key || state.handledReasoning.has(key)) return false;

        state.handledReasoning.add(key);

        if (state.handledReasoning.size > 1000) {
            const oldest = state.handledReasoning.values().next().value;
            if (oldest) state.handledReasoning.delete(oldest);
        }

        return true;
    }

    function resetReasoningHistory() {
        const count = state.handledReasoning.size;
        state.handledReasoning.clear();

        try {
            sessionStorage.removeItem(HANDLED_REASONING_KEY);
        } catch {
        }

        updatePanel();
        showFeedback(t.feedbackReset(count));
        return count;
    }

    function handleKeyboardShortcut(event) {
        if (
            state.destroyed ||
            !state.config.keyboardShortcut ||
            event.repeat ||
            event.code !== 'KeyO' ||
            !event.altKey ||
            !event.shiftKey ||
            event.ctrlKey ||
            event.metaKey
        ) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        runFullOptimize();
    }

    function isChatGPTStreaming() {
        return Boolean(document.querySelector(SELECTORS.streaming));
    }

    function clampInt(value, min, max, fallback) {
        const n = Number.parseInt(value, 10);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    }

    function currentRouteKey() {
        return `${location.pathname}${location.search}`;
    }

    function runDomSelfCheck(force = false) {
        if (state.destroyed) return false;

        const thread = document.querySelector(SELECTORS.thread);
        if (!thread) {
            if (force) showFeedback(t.noConversation);
            return false;
        }

        if (!state.root?.isConnected) {
            if (force) showFeedback(t.noConversation);
            return false;
        }

        const discoveredWrappers = Array.from(
            thread.querySelectorAll(SELECTORS.wrapper)
        ).filter((el) =>
            el instanceof HTMLElement &&
            el.dataset.turnIdContainer !== 'client-created-root'
        );

        const directWrappers = getWrappers();
        const rootIsInsideThread = thread.contains(state.root);
        const contractOk =
            rootIsInsideThread &&
            (discoveredWrappers.length === 0 || directWrappers.length > 0);

        if (contractOk) {
            state.domMismatchCount = 0;

            if (state.safetyPaused) {
                state.safetyPaused = false;
                state.safetyIssue = '';
                setStatus(t.safetyRestored);
                showFeedback(t.safetyRestored);
                updatePanel();
            }

            return true;
        }

        state.domMismatchCount += 1;

        if (force || state.domMismatchCount >= 3) {
            const firstPause = !state.safetyPaused;
            state.safetyPaused = true;
            state.safetyIssue = 'conversation-root';
            setStatus(t.safetyPaused);

            if (firstPause || force) {
                showFeedback(t.safetyPaused);
            }

            updatePanel();
        }

        return false;
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
        runDomSelfCheck(false);
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

    function runFullOptimize() {
        state.paused = false;
        state.revealedExtra = 0;

        if (!state.root?.isConnected) {
            scheduleInit(0);
            showFeedback(t.noConversation);
            return;
        }

        if (!runDomSelfCheck(true)) return;

        const collapsed = collapseOpenAnalyses(true, true);
        optimizeNow(true);

        window.setTimeout(() => {
            const stats = collectStats();
            showFeedback(t.feedbackOptimize(stats.hiddenWrappers, collapsed));
        }, 180);
    }

    function runDomOnlyOptimize() {
        state.paused = false;
        state.revealedExtra = 0;

        if (!state.root?.isConnected) {
            scheduleInit(0);
            showFeedback(t.noConversation);
            return;
        }

        if (!runDomSelfCheck(true)) return;

        optimizeNow(true);

        window.setTimeout(() => {
            const stats = collectStats();
            showFeedback(t.feedbackDomOnly(stats.hiddenWrappers));
        }, 180);
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
        if (
            state.destroyed ||
            state.paused ||
            state.safetyPaused ||
            !state.root?.isConnected
        ) return;

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

    function collapseOpenAnalyses(scanAll = false, force = false) {
        if (
            state.destroyed ||
            state.safetyPaused ||
            (!force && !state.config.autoCollapseAnalysis) ||
            (!force && isChatGPTStreaming()) ||
            !state.root?.isConnected
        ) {
            return 0;
        }

        const wrappers = getWrappers();
        if (!wrappers.length) return 0;

        const targets = scanAll ? wrappers : wrappers.slice(-12);
        let collapsed = 0;
        let handledChanged = false;

        for (const wrapper of targets) {
            const summaries = wrapper.querySelectorAll('span.block');

            for (const summary of summaries) {
                if (!(summary instanceof HTMLElement)) continue;
                if (summary.closest('[class*="group/tool-message"]')) continue;

                const disclosure = getAnalysisDisclosure(summary);
                if (!disclosure) continue;

                const key = getReasoningKey(wrapper, summary);
                if (!key) continue;

                if (!force && state.handledReasoning.has(key)) continue;

                if (markReasoningHandled(key)) {
                    handledChanged = true;
                }

                if (!disclosure.open) continue;

                disclosure.button.click();
                collapsed += 1;
            }
        }

        if (handledChanged) {
            while (state.handledReasoning.size > 1000) {
                const oldest = state.handledReasoning.values().next().value;
                if (!oldest) break;
                state.handledReasoning.delete(oldest);
            }
            saveHandledReasoning();
        }

        return collapsed;
    }

    function getAnalysisDisclosure(summary) {
        const button = summary.querySelector('button');
        if (!(button instanceof HTMLButtonElement) || button.disabled) return null;

        const content = summary.nextElementSibling;
        if (!(content instanceof HTMLElement)) return null;

        if (isOpenAnalysisContent(content)) {
            return { button, open: true };
        }

        if (content.getAttribute('data-message-author-role') === 'assistant') {
            return { button, open: false };
        }

        return null;
    }

    function countOpenAnalyses() {
        if (!state.root?.isConnected) return 0;

        let open = 0;

        for (const wrapper of getWrappers()) {
            for (const summary of wrapper.querySelectorAll('span.block')) {
                if (!(summary instanceof HTMLElement)) continue;
                if (summary.closest('[class*="group/tool-message"]')) continue;

                const disclosure = getAnalysisDisclosure(summary);
                if (disclosure?.open) open += 1;
            }
        }

        return open;
    }

    function handledReasoningForCurrentRoute() {
        const prefix = `${location.pathname}:`;
        let count = 0;

        for (const key of state.handledReasoning) {
            if (key.startsWith(prefix)) count += 1;
        }

        return count;
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
            keyboardShortcut: state.config.keyboardShortcut,
            handledReasoning: handledReasoningForCurrentRoute(),
            handledReasoningTotal: state.handledReasoning.size,
            openReasoning: countOpenAnalyses(),
            streaming: isChatGPTStreaming(),
            safetyPaused: state.safetyPaused,
            safetyIssue: state.safetyIssue,
            paused: state.paused,
            status: state.lastStatus,
        });
    }

    function setStatus(text) {
        state.lastStatus = text;
    }

    function showFeedback(text, duration = FEEDBACK_MS) {
        if (!state.panel?.feedback) return;

        window.clearTimeout(state.feedbackTimer);

        const feedback = state.panel.feedback;
        feedback.textContent = text;
        feedback.classList.remove('show');
        void feedback.offsetWidth;
        feedback.classList.add('show');

        state.feedbackTimer = window.setTimeout(() => {
            feedback.classList.remove('show');
        }, duration);
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
                .head-actions { display: flex; align-items: center; gap: 5px; }
                .feedback {
                    position: absolute;
                    right: 0;
                    bottom: calc(100% + 8px);
                    width: 286px;
                    box-sizing: border-box;
                    padding: 8px 10px;
                    border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
                    border-radius: 10px;
                    background: color-mix(in srgb, Canvas 96%, transparent);
                    color: CanvasText;
                    box-shadow: 0 8px 24px rgba(0,0,0,.18);
                    backdrop-filter: blur(12px);
                    font: 12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
                    opacity: 0;
                    transform: translateY(5px);
                    pointer-events: none;
                    transition: opacity .16s ease, transform .16s ease;
                }
                .feedback.show { opacity: 1; transform: translateY(0); }
                .body { padding: 9px 10px 10px; }
                .stats { opacity: .88; margin-bottom: 3px; }
                .reasoning-stats { opacity: .72; margin-bottom: 6px; }
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
                    flex-wrap: wrap;
                }
                .collapsed .body { display: none; }
                .collapsed { width: auto; min-width: 122px; }
            </style>

            <div class="feedback" role="status" aria-live="polite"></div>
            <div class="box">
                <div class="head">
                    <span class="title">ChatGPT DOM</span>
                    <div class="head-actions">
                        <button class="mini quick-optimize" type="button" title="${t.forceOptimizeTitle}">${t.optimize}</button>
                        <button class="mini collapse" type="button" title="${t.collapsePanel}">–</button>
                    </div>
                </div>
                <div class="body">
                    <div class="stats">${t.domWaiting}</div>
                    <div class="reasoning-stats">${t.reasoningStats(0, 0)}</div>
                    <div class="status">${t.starting}</div>

                    <div class="row">
                        <button class="grow optimize" type="button" title="${t.forceOptimizeTitle}">${t.optimize}</button>
                        <button class="grow dom-only" type="button" title="${t.domOnlyTitle}">${t.domOnly}</button>
                    </div>

                    <div class="row">
                        <button class="grow older" type="button">${t.older(DEFAULT_CONFIG.revealStep)}</button>
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
                        <label title="${t.shortcutTitle}"><input class="shortcut" type="checkbox"> ${t.shortcut}</label>
                    </div>

                    <div class="row">
                        <button class="grow reset-reasoning" type="button">${t.resetReasoning}</button>
                    </div>
                </div>
            </div>
        `;

        document.documentElement.appendChild(host);
        state.panelHost = host;
        state.panel = {
            box: shadow.querySelector('.box'),
            feedback: shadow.querySelector('.feedback'),
            title: shadow.querySelector('.title'),
            stats: shadow.querySelector('.stats'),
            reasoningStats: shadow.querySelector('.reasoning-stats'),
            status: shadow.querySelector('.status'),
            optimize: shadow.querySelector('.optimize'),
            quickOptimize: shadow.querySelector('.quick-optimize'),
            domOnly: shadow.querySelector('.dom-only'),
            older: shadow.querySelector('.older'),
            restore: shadow.querySelector('.restore'),
            keep: shadow.querySelector('.keep'),
            step: shadow.querySelector('.step'),
            threshold: shadow.querySelector('.threshold'),
            auto: shadow.querySelector('.auto'),
            cv: shadow.querySelector('.cv'),
            analysis: shadow.querySelector('.analysis'),
            shortcut: shadow.querySelector('.shortcut'),
            resetReasoning: shadow.querySelector('.reset-reasoning'),
            collapse: shadow.querySelector('.collapse'),
        };

        syncPanelInputs();

        state.panel.optimize.addEventListener('click', runFullOptimize);
        state.panel.quickOptimize.addEventListener('click', runFullOptimize);
        state.panel.domOnly.addEventListener('click', runDomOnlyOptimize);
        state.panel.resetReasoning.addEventListener('click', resetReasoningHistory);
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
            if (state.config.autoCollapseAnalysis) collapseOpenAnalyses(true, false);
            updatePanel();
        });

        state.panel.shortcut.addEventListener('change', () => {
            state.config.keyboardShortcut = state.panel.shortcut.checked;
            saveConfig();
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
        state.panel.shortcut.checked = state.config.keyboardShortcut;
    }

    function updatePanel() {
        if (!state.panel) return;

        const stats = collectStats();
        state.panel.stats.textContent = stats.wrappers
            ? t.stats(stats.wrappers, stats.visibleWrappers, stats.hiddenWrappers)
            : t.turnsMissing;
        state.panel.reasoningStats.textContent = t.reasoningStats(
            stats.handledReasoning,
            stats.openReasoning
        );
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
        window.clearTimeout(state.feedbackTimer);

        resetObserver();
        clearOurMarks();
        document.removeEventListener('keydown', handleKeyboardShortcut, true);
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
