let isSelectionMode = false;
let highlightBox = null;

function getHighlightBox() {
    if (highlightBox) return highlightBox;
    highlightBox = document.createElement('div');
    Object.assign(highlightBox.style, {
        position: 'absolute', backgroundColor: 'rgba(26, 115, 232, 0.2)',
        border: '2px solid #1a73e8', pointerEvents: 'none', zIndex: '2147483647', 
        display: 'none', boxSizing: 'border-box'
    });
    document.body.appendChild(highlightBox);
    return highlightBox;
}

function getTargetElement(el) {
    if (!el) return null;
    return el.closest('li') || el.closest('article') || el.closest('button') || 
           el.closest('a') || el.closest('div') || el;
}

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "TOGGLE_SELECTION_MODE") {
        isSelectionMode = msg.enabled;
        if (!isSelectionMode) getHighlightBox().style.display = 'none';
    }
});

document.addEventListener('mouseover', (e) => {
    if (!isSelectionMode) return;
    const box = getHighlightBox();
    const target = getTargetElement(e.target);
    if (target) {
        const rect = target.getBoundingClientRect();
        box.style.display = 'block';
        box.style.width = `${rect.width}px`; box.style.height = `${rect.height}px`;
        box.style.top = `${rect.top + window.scrollY}px`; box.style.left = `${rect.left + window.scrollX}px`;
    }
});

document.addEventListener('click', (e) => {
    if (!isSelectionMode) return;
    e.preventDefault(); 
    e.stopPropagation();

    const target = getTargetElement(e.target);
    if (!target) return;

    const foundLinks = [];

    const checkElement = (el) => {
        let href = el.getAttribute('href') || el.href;
        if (href && href.startsWith('http')) {
            foundLinks.push({ text: el.innerText.trim() || "Link", url: href });
        }
    };

    checkElement(target);

    target.querySelectorAll('a[href], button[href]').forEach(el => {
        let href = el.getAttribute('href') || el.href;
        if (href && !href.startsWith('http')) {
            href = new URL(href, window.location.origin).href;
        }
        
        if (href && !foundLinks.some(l => l.url === href)) {
            foundLinks.push({
                text: el.innerText.trim() || el.getAttribute('aria-label') || "Link",
                url: href
            });
        }
    });

    chrome.runtime.sendMessage({
        type: "ELEMENT_SELECTED",
        payload: { 
            text: target.innerText.trim(), 
            tagName: target.tagName,
            links: foundLinks 
        }
    });

    const box = getHighlightBox();
    box.style.backgroundColor = 'rgba(52, 168, 83, 0.4)';
    setTimeout(() => { box.style.backgroundColor = 'rgba(26, 115, 232, 0.2)'; }, 200);
}, true);