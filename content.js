let isSelectionMode = false;
let highlightBox = null;
let currentTarget = null;

function getHighlightBox() {
    if (highlightBox) return highlightBox;
    highlightBox = document.createElement('div');
    Object.assign(highlightBox.style, {
        position: 'absolute',
        backgroundColor: 'rgba(26, 115, 232, 0.2)',
        border: '2px solid #1a73e8',
        pointerEvents: 'none',
        zIndex: '2147483647',
        display: 'none',
        boxSizing: 'border-box',
        transition: 'all 0.1s ease-out'
    });
    document.body.appendChild(highlightBox);
    return highlightBox;
}

function updateHighlight(el) {
    if (!el || el === document.body || el === document.documentElement) return;
    
    currentTarget = el;
    const box = getHighlightBox();
    const rect = el.getBoundingClientRect();
    
    box.style.display = 'block';
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.style.top = `${rect.top + window.scrollY}px`;
    box.style.left = `${rect.left + window.scrollX}px`;
}

document.addEventListener('keydown', (e) => {
    if (!isSelectionMode || !currentTarget) return;

    if (e.key === "ArrowUp") {
        e.preventDefault();
        const parent = currentTarget.parentElement;
        if (parent) updateHighlight(parent);
    } 
    else if (e.key === "ArrowDown") {
        e.preventDefault();
        const firstChild = currentTarget.firstElementChild;
        if (firstChild) updateHighlight(firstChild);
    } 
    else if (e.key === "Enter") {
        e.preventDefault();
        saveSelection(currentTarget);
        
        const box = getHighlightBox();
        box.style.backgroundColor = 'rgba(52, 168, 83, 0.4)';
        setTimeout(() => { box.style.backgroundColor = 'rgba(26, 115, 232, 0.2)'; }, 200);
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "TOGGLE_SELECTION_MODE") {
        isSelectionMode = msg.enabled;
        if (!isSelectionMode) {
            getHighlightBox().style.display = 'none';
            currentTarget = null;
        }
    }
});

document.addEventListener('mouseover', (e) => {
    if (!isSelectionMode) return;
    updateHighlight(e.target);
});

document.addEventListener('click', (e) => {
    if (!isSelectionMode) return;
    e.preventDefault();
    e.stopPropagation();
    saveSelection(currentTarget || e.target);
}, true);

function saveSelection(target) {
    const links = Array.from(target.querySelectorAll('a, button[href]')).map(el => {
        let href = el.getAttribute('href') || el.href;
        if (href && !href.startsWith('http')) {
            href = new URL(href, window.location.origin).href;
        }
        return {
            text: el.innerText.trim() || el.title || "Link",
            url: href
        };
    }).filter(l => l.url && l.url.startsWith('http'));

    const clone = target.cloneNode(true);
    clone.querySelectorAll('a').forEach(link => link.remove());
    
    const cleanText = clone.innerText
        .replace(/\\n/g, ' ')    
        .replace(/\s+/g, ' ')     
        .replace(/\\+/g, '')   
        .trim();

    chrome.runtime.sendMessage({
        type: "ELEMENT_SELECTED",
        payload: {
            text: cleanText || "Selected Element",
            tagName: target.tagName,
            links: links,
            metadata: {
                source_url: window.location.href,
                page_title: document.title,
                timestamp: new Date().toISOString()
            }
        }
    });
}