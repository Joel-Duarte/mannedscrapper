document.addEventListener('DOMContentLoaded', async () => {
    const stagingArea = document.getElementById('staging-area');
    const toggleBtn = document.getElementById('toggle-mode');
    const urlEndpointInput = document.getElementById('url-endpoint-url');
    const elementsEndpointInput = document.getElementById('elements-endpoint-url');
    let selectionModeActive = false;

    const data = await chrome.storage.local.get(["urlEndpoint", "elementsEndpoint"]);
    urlEndpointInput.value = data.urlEndpoint || "http://localhost:1223/url";
    elementsEndpointInput.value = data.elementsEndpoint || "http://localhost:1223";

    urlEndpointInput.addEventListener('input', () => chrome.storage.local.set({ urlEndpoint: urlEndpointInput.value.trim() }));
    elementsEndpointInput.addEventListener('input', () => chrome.storage.local.set({ elementsEndpoint: elementsEndpointInput.value.trim() }));

    const sortConfig = {
        group: 'nested',
        animation: 150,
        fallbackOnBody: true,
        swapThreshold: 0.65, 
        invertSwap: true,   
        ghostClass: "sortable-ghost",
        onEnd: () => saveOrder()
    };

    new Sortable(stagingArea, sortConfig);

    toggleBtn.onclick = async () => {
        selectionModeActive = !selectionModeActive;
        updateToggleUI();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SELECTION_MODE", enabled: selectionModeActive })
                .catch(() => console.log("Refresh page."));
        }
    };

    function updateToggleUI() {
        toggleBtn.innerText = selectionModeActive ? "STOP Selection" : "Selection Mode";
        toggleBtn.style.backgroundColor = selectionModeActive ? "#ffcccc" : "#1877f2";
    }

    document.getElementById('send-url-btn').onclick = async () => {
        const btn = document.getElementById('send-url-btn');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) return;

        const payload = { 
            type: "URL_DIRECT_SEND", 
            url: tab.url, 
            title: tab.title, 
            timestamp: new Date().toISOString() 
        };

        try {
            const url = urlEndpointInput.value.trim();
            await fetch(url, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload) 
            });
            
            const originalText = btn.innerText;
            btn.innerText = "Sent!";
            btn.style.backgroundColor = "#e7fef0";
            
            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.backgroundColor = "";
            }, 2000);

        } catch (e) { 
            console.error("Failed to send URL:", e);
            btn.innerText = "Error";
            setTimeout(() => { btn.innerText = "Send Current URL"; }, 2000);
        }
    };

    document.getElementById('create-group-btn').onclick = async () => {
        const { selections = [] } = await chrome.storage.session.get("selections");
        const newGroup = { id: crypto.randomUUID(), type: 'group', title: 'New Group', children: [] };
        await chrome.storage.session.set({ selections: [...selections, newGroup] });
        renderList();
    };

    document.getElementById('clear-btn').onclick = async () => {
        await chrome.storage.session.set({ selections: [] });
        renderList();
    };

    stagingArea.onclick = async (e) => {
        const target = e.target;
        const itemEl = target.closest('.card, .group-box');
        if (!itemEl) return;
        const itemId = itemEl.dataset.id;
        const { selections = [] } = await chrome.storage.session.get("selections");
        const itemData = findByIdRecursive(selections, itemId);

        if (target.classList.contains('send-btn')) {
            chrome.runtime.sendMessage({ type: "SEND_AND_DELETE", endpoint: elementsEndpointInput.value.trim(), payload: itemData, id: itemId });
            target.innerText = "...";
        }
        if (target.classList.contains('del-btn')) {
            const updated = removeByIdRecursive(selections, itemId);
            await chrome.storage.session.set({ selections: updated });
            renderList();
        }
    };

    async function renderList() {
        const { selections = [] } = await chrome.storage.session.get("selections");
        stagingArea.innerHTML = '';
        selections.forEach(item => renderItemUI(item, stagingArea));
    }

    function renderItemUI(item, container) {
    const div = document.createElement('div');
    div.className = item.type === 'group' ? 'group-box' : 'card';
    div.dataset.id = item.id;

    if (item.type === 'group') {
        div.innerHTML = `
            <div class="group-header">
                <input type="text" value="${item.title}" class="g-title">
                <div class="item-actions">
                    <button class="send-btn">Send</button>
                    <button class="del-btn">Del</button>
                </div>
            </div>
            <div class="group-slots"></div>
        `;
        const slots = div.querySelector('.group-slots');
        if (item.children) item.children.forEach(c => renderItemUI(c, slots));
        new Sortable(slots, sortConfig);
    } else {
        div.innerHTML = `
            <p>${item.text ? item.text.substring(0, 45) : "Item"}...</p>
            <div class="item-actions">
                <button class="send-btn">Send</button>
                <button class="del-btn">Del</button>
            </div>
        `;
    }
    container.appendChild(div);
}

    function findByIdRecursive(l, i) { for (const n of l) { if (n.id === i) return n; if (n.children) { const f = findByIdRecursive(n.children, i); if (f) return f; } } return null; }
    function removeByIdRecursive(l, i) { return l.filter(n => n.id !== i).map(n => ({ ...n, children: n.children ? removeByIdRecursive(n.children, i) : [] })); }

    async function saveOrder() {
        const { selections: originalData = [] } = await chrome.storage.session.get("selections");
        function mapDom(c) {
            return Array.from(c.children).map(el => {
                const id = el.dataset.id;
                const orig = findByIdRecursive(originalData, id);
                if (el.classList.contains('group-box')) {
                    return { ...orig, title: el.querySelector('.g-title').value, children: mapDom(el.querySelector('.group-slots')) };
                }
                return orig;
            });
        }
        await chrome.storage.session.set({ selections: mapDom(stagingArea) });
    }

    chrome.runtime.onMessage.addListener((msg) => { 
        if (msg.type === "REFRESH_UI") {
            renderList();
            updateToggleUI();
        }
    });
    renderList();
});