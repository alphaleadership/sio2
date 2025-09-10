// This file contains the JavaScript code that fetches and displays messages from the JSON files. 
// It organizes messages by server and channel, and handles the loading of messages for each day.

async function fetchMessages(date) {
    try {
        const response = await fetch(`./data/${date}.json`);
        if (!response.ok) throw new Error('Failed to fetch messages');
        const messages = await response.json();
        displayMessages(messages);
    } catch (err) {
        console.error(err);
        document.getElementById('messages').innerHTML = '<li>Unable to load messages.</li>';
    }
}

function displayMessages(messages) {
    const list = document.getElementById('messages');
    list.innerHTML = '';
    
    const organizedMessages = {};

    messages.forEach(msg => {
        const server = msg.server || 'General';
        const channel = msg.channel || 'General';

        if (!organizedMessages[server]) {
            organizedMessages[server] = {};
        }
        if (!organizedMessages[server][channel]) {
            organizedMessages[server][channel] = [];
        }
        organizedMessages[server][channel].push(msg);
    });

    for (const server in organizedMessages) {
        const serverHeader = document.createElement('h2');
        serverHeader.textContent = server;
        list.appendChild(serverHeader);

        for (const channel in organizedMessages[server]) {
            const channelHeader = document.createElement('h3');
            channelHeader.textContent = channel;
            list.appendChild(channelHeader);

            organizedMessages[server][channel].forEach(msg => {
                const li = document.createElement('li');
                li.className = 'message';
                li.innerHTML = `
                    <div>${msg.text}</div>
                    <div class="timestamp">${new Date(msg.timestamp).toLocaleString()}</div>
                `;
                list.appendChild(li);
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const date = '2024-06-13'; // Change this to load messages for a different day
    fetchMessages(date);
});