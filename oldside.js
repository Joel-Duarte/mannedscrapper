document.addEventListener('DOMContentLoaded', async () => {
    const stagingArea = document.getElementById('staging-area');
    const toggleBtn = document.getElementById('toggle-mode');
    const urlInput = document.getElementById('endpoint-url');
    let selectionModeActive = false;

    const data = await chrome.storage.local.get("endpoint");
    urlInput.value = data.endpoint || "http://localhost:1223";

    urlInput.addEventListener('input', () => {
        chrome.storage.local.set({ endpoint: urlInput.value.trim() });
    });

    new Sortable(stagingArea, {
        group: 'nested',
        animation: 150,
        onEnd: () => saveOrder()
    });

    toggleBtn.onclick = async () => {
        selectionModeActive = !selectionModeActive;
        toggleBtn.innerText = selectionModeActive ? "STOP Selection" : "Selection Mode";
        toggleBtn.style.backgroundColor = selectionModeActive ? "#ffcccc" : "#fff";

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.tabs.sendMessage(tab.id, {
                type: "TOGGLE_SELECTION_MODE",
                enabled: selectionModeActive
            }).catch(() => console.log("Refresh page to sync."));
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

    stagingArea.addEventListener('click', async (e) => {
        const target = e.target;
        const itemEl = target.closest('.card, .group-box');
        if (!itemEl) return;

        const itemId = itemEl.dataset.id;
        const { selections = [] } = await chrome.storage.session.get("selections");
        const itemData = findByIdRecursive(selections, itemId);

        if (target.classList.contains('send-btn')) {
            const endpoint = urlInput.value.trim();
            if (!endpoint) {
                urlInput.style.border = "2px solid red";
                return;
            }
            urlInput.style.border = "1px solid #ccc";
            target.innerText = "...";
            target.disabled = true;

            chrome.runtime.sendMessage({
                type: "SEND_AND_DELETE",
                endpoint: endpoint,
                payload: itemData,
                id: itemId
            });
        }

        if (target.classList.contains('del-btn')) {
            const updated = removeByIdRecursive(selections, itemId);
            await chrome.storage.session.set({ selections: updated });
            renderList();
        }
    });

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
                    <span class="drag-handle">↕</span>
                    <input type="text" value="${item.title}" class="g-title">
                    <button class="send-btn">Send</button>
                    <button class="del-btn">Del</button>
                </div>
                <div class="group-slots"></div>
            `;
            const slots = div.querySelector('.group-slots');
            if (item.children) item.children.forEach(c => renderItemUI(c, slots));
            new Sortable(slots, { group: 'nested', animation: 150, onEnd: () => saveOrder() });
        } else {
            div.innerHTML = `
                <span class="drag-handle">↕</span>
                <p>${item.text ? item.text.substring(0, 45) : "Item"}...</p>
                <button class="send-btn">Send</button>
                <button class="del-btn">Del</button>
            `;
        }
        container.appendChild(div);
    }

    function findByIdRecursive(list, id) {
        for (const item of list) {
            if (item.id === id) return item;
            if (item.children) {
                const found = findByIdRecursive(item.children, id);
                if (found) return found;
            }
        }
        return null;
    }

    function removeByIdRecursive(list, id) {
        return list.filter(item => item.id !== id).map(item => ({
            ...item,
            children: item.children ? removeByIdRecursive(item.children, id) : []
        }));
    }

    async function saveOrder() {
        const { selections: originalData = [] } = await chrome.storage.session.get("selections");
        function mapDom(container) {
            return Array.from(container.children).map(el => {
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

    chrome.runtime.onMessage.addListener((msg) => { if (msg.type === "REFRESH_UI") renderList(); });
    renderList();
});