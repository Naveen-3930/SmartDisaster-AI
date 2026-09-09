// public/js/chatbot.js
// Rule-based FAQ assistant — no API calls, no cost, works offline from the server's perspective.
(function () {
    const RULES = [
        { keywords: ['flood'], reply: "During a flood: move to higher ground immediately, avoid walking or driving through flood water (even 6 inches can knock you over), and stay away from downed power lines. Check the app's Shelters section for the nearest safe location." },
        { keywords: ['fire', 'wildfire'], reply: "During a fire: leave the area immediately if told to evacuate, cover your nose/mouth with a damp cloth if there's smoke, and avoid areas with heavy smoke. Don't go back for belongings." },
        { keywords: ['heat', 'heatwave', 'hot'], reply: "During a heatwave: stay indoors during peak heat hours, drink water regularly even if not thirsty, and check on elderly neighbors. Watch for signs of heat stroke: confusion, hot dry skin, rapid pulse." },
        { keywords: ['earthquake'], reply: "During an earthquake: Drop, Cover, and Hold On — get under sturdy furniture, stay away from windows, and if outdoors move to an open area away from buildings and power lines." },
        { keywords: ['storm'], reply: "During a storm: stay indoors, away from windows, unplug electronics, and avoid using corded phones. Keep a flashlight and emergency supplies ready." },
        { keywords: ['report', 'incident'], reply: "To report an incident: go to your Dashboard, scroll to 'Report an Incident', pick the disaster type, add the location and description, and submit. Staff will review it and update the status." },
        { keywords: ['alert'], reply: "Alerts show up automatically on your Dashboard when a high-risk prediction is made or an incident escalates. Check the 'Recent Alerts' section for the latest ones." },
        { keywords: ['shelter'], reply: "Nearby shelters are listed on your Dashboard with their address, capacity, and current status. Head to the nearest one marked 'Open' if you need to evacuate." },
        { keywords: ['sos', 'emergency', 'help me', 'urgent'], reply: "If this is a real emergency: press the SOS button on your Dashboard right now — it alerts responders with your location immediately. If you're in immediate danger, also contact local emergency services directly." },
        { keywords: ['missing', 'lost person', 'find someone'], reply: "You can report a missing or found person, with or without an account, at the Missing Persons Registry page (link in the sidebar or on the login screen). You can also search existing reports there." },
        { keywords: ['feature', 'what can you do', 'help'], reply: "I can help explain: disaster safety (flood, fire, heatwave, earthquake, storm), how to report an incident, how alerts work, finding shelters, using SOS, and the Missing Persons Registry. Just ask about any of these." },
        { keywords: ['hi', 'hello', 'hey'], reply: "Hi there! Ask me about disaster safety, reporting an incident, alerts, shelters, SOS, or the Missing Persons Registry." },
    ];

    const FALLBACK = "I'm not sure about that one. Try asking about: flood/fire/heatwave/earthquake safety, reporting an incident, alerts, shelters, SOS, or missing persons.";

    function getReply(message) {
        const text = message.toLowerCase();
        for (const rule of RULES) {
            if (rule.keywords.some((k) => text.includes(k))) return rule.reply;
        }
        return FALLBACK;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
    <button id="sdChatToggle" class="fixed bottom-5 right-5 z-50 bg-orange-500 hover:brightness-110 text-slate-950 rounded-full w-14 h-14 shadow-lg flex items-center justify-center text-2xl font-bold">💬</button>
    <div id="sdChatPanel" class="fixed bottom-24 right-5 z-50 w-[340px] max-w-[92vw] h-[440px] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex-col hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div class="text-sm font-semibold text-slate-100">SmartDisaster Assistant</div>
        <button id="sdChatClose" class="text-slate-500 hover:text-orange-500 text-lg leading-none">✕</button>
      </div>
      <div id="sdChatMessages" class="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-sm"></div>
      <div class="border-t border-slate-800 p-2 flex gap-2">
        <input id="sdChatInput" type="text" placeholder="Ask about safety, alerts, shelters…" class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
        <button id="sdChatSend" class="bg-orange-500 hover:brightness-110 text-slate-950 font-semibold rounded-lg px-3 text-sm">Send</button>
      </div>
    </div>
  `;
    document.body.appendChild(wrapper);

    const panel = document.getElementById('sdChatPanel');
    const toggleBtn = document.getElementById('sdChatToggle');
    const closeBtn = document.getElementById('sdChatClose');
    const messagesEl = document.getElementById('sdChatMessages');
    const input = document.getElementById('sdChatInput');
    const sendBtn = document.getElementById('sdChatSend');

    function addMessage(role, text) {
        const bubble = document.createElement('div');
        bubble.className = role === 'user'
            ? 'ml-auto max-w-[80%] bg-orange-500 text-slate-950 rounded-lg px-3 py-2 whitespace-pre-wrap'
            : 'mr-auto max-w-[85%] bg-slate-800 text-slate-100 rounded-lg px-3 py-2 whitespace-pre-wrap';
        bubble.textContent = text;
        messagesEl.appendChild(bubble);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function sendMessage() {
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        addMessage('user', text);
        setTimeout(() => addMessage('assistant', getReply(text)), 250);
    }

    toggleBtn.addEventListener('click', () => {
        const isHidden = panel.classList.contains('hidden');
        panel.classList.toggle('hidden');
        panel.classList.toggle('flex');
        if (isHidden && messagesEl.children.length === 0) {
            addMessage('assistant', "Hi! I'm the SmartDisaster assistant. Ask me about disaster safety, reporting an incident, alerts, shelters, SOS, or missing persons.");
        }
        if (isHidden) input.focus();
    });

    closeBtn.addEventListener('click', () => {
        panel.classList.add('hidden');
        panel.classList.remove('flex');
    });

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
})();