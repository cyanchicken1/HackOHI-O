chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CANVAS_API_REQUEST') {
    const { endpoint, method = 'GET', body = null, token } = message;

    if (!token) {
      sendResponse({ success: false, error: 'Missing token' });
      return;
    }

    const fetchOptions = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    };
    if (body && method !== 'GET') fetchOptions.body = JSON.stringify(body);

    fetch(`https://osu.instructure.com/api/v1/${endpoint}`, fetchOptions)
      .then(async res => {
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
        sendResponse({ success: res.ok, status: res.status, data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep async channel open
  }
});
