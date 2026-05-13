chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "ELEMENT_SELECTED") {
        handleNewSelection(message.payload);
    }
    
    if (message.type === "SEND_AND_DELETE") {
        executeRequest(message);
    }
    return true; 
});

async function handleNewSelection(payload) {
    const { selections = [] } = await chrome.storage.session.get("selections");
    
    const newItem = { 
        id: self.crypto.randomUUID(), 
        type: 'item', 
        ...payload 
    };
    
    await chrome.storage.session.set({ selections: [...selections, newItem] });
    
    chrome.runtime.sendMessage({ type: "REFRESH_UI" });
}

async function executeRequest(msg) {
    console.log("Dispatching to:", msg.endpoint);
    
    try {
        const response = await fetch(msg.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(msg.payload)
        });

        if (response.ok) {
            console.log("Post successful");
            const { selections = [] } = await chrome.storage.session.get("selections");
            const updated = removeRecursive(selections, msg.id);
            await chrome.storage.session.set({ selections: updated });
        } else {
            console.error("Server Error:", response.status);
        }
    } catch (err) {
        console.error("Fetch failed:", err.message);
    } finally {
        chrome.runtime.sendMessage({ type: "REFRESH_UI" });
    }
}

function removeRecursive(list, id) {
    return list
        .filter(item => item.id !== id)
        .map(item => ({
            ...item,
            children: item.children ? removeRecursive(item.children, id) : []
        }));
}