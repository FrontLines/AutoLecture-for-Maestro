// popup.js
let voiceSelect = document.getElementById('voiceSelect');
let speedSlider = document.getElementById('speedSlider');
let speedValue = document.getElementById('speedValue');
let delaySlider = document.getElementById('delaySlider');
let delayValue = document.getElementById('delayValue');
let autoReadToggle = document.getElementById('autoReadToggle');

// Load saved settings
chrome.storage.local.get(['selectedVoice', 'readingSpeed', 'bubbleDelay', 'autoReadNewLessons'], function(data) {
    if(data.selectedVoice !== undefined) voiceSelect.value = data.selectedVoice;
    if(data.readingSpeed !== undefined) {
        speedSlider.value = data.readingSpeed;
        speedValue.textContent = data.readingSpeed;
    }
    if(data.bubbleDelay !== undefined) {
        delaySlider.value = data.bubbleDelay;
        delayValue.textContent = data.bubbleDelay;
    }
    if(data.autoReadNewLessons !== undefined) {
        autoReadToggle.checked = data.autoReadNewLessons;
    }
});

// Save settings when changed and notify content script
autoReadToggle.addEventListener('change', () => {
    chrome.storage.local.set({autoReadNewLessons: autoReadToggle.checked});
});

voiceSelect.addEventListener('change', () => {
    let newVoice = voiceSelect.value;
    chrome.storage.local.set({selectedVoice: newVoice}, () => {
        // Update the status text visually so we KNOW this code ran!
        let statusDiv = document.querySelector('.status');
        if (statusDiv) {
            statusDiv.innerText = "Voice updated to: " + newVoice;
            statusDiv.style.color = "#27ae60";
            setTimeout(() => { statusDiv.innerText = "Connected to Local Server"; statusDiv.style.color = "#888888"; }, 2000);
        }
        sendMessageToContent({action: 'updateSettings', voice: newVoice, speed: speedSlider.value});
        sendMessageToContent({action: 'restartCurrent'});
    });
});

speedSlider.addEventListener('input', () => {
    speedValue.textContent = speedSlider.value;
    chrome.storage.local.set({readingSpeed: speedSlider.value});
    sendMessageToContent({action: 'updateSettings', voice: voiceSelect.value, speed: speedSlider.value});
});

delaySlider.addEventListener('input', () => {
    delayValue.textContent = delaySlider.value;
    chrome.storage.local.set({bubbleDelay: delaySlider.value});
});

// Buttons
document.getElementById('backBtn').addEventListener('click', () => sendMessageToContent({action: 'readPreviousSection'}));
document.getElementById('playPauseBtn').addEventListener('click', () => sendMessageToContent({action: 'togglePlayPause'}));
document.getElementById('nextBtn').addEventListener('click', () => sendMessageToContent({action: 'readNextSection'}));
document.getElementById('readAllBtn').addEventListener('click', () => sendMessageToContent({action: 'readAll'}));
document.getElementById('readFromTopBtn').addEventListener('click', () => sendMessageToContent({action: 'readFromTop'}));

function updatePlayState(isPlaying) {
    if (isPlaying) {
        document.getElementById('playIcon').style.display = 'none';
        document.getElementById('pauseIcon').style.display = 'block';
    } else {
        document.getElementById('playIcon').style.display = 'block';
        document.getElementById('pauseIcon').style.display = 'none';
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'playbackState') {
        updatePlayState(request.isPlaying);
    }
});

function sendMessageToContent(msg, callback) {
    chrome.tabs.query({url: ["*://*.maestro.org/*", "*://maestro.org/*"]}, function(tabs) {
        if (tabs && tabs.length > 0) {
            for (let tab of tabs) {
                chrome.tabs.sendMessage(tab.id, msg, function(response) {
                    if (!chrome.runtime.lastError && callback && response) {
                        callback(response);
                    }
                });
            }
        } else {
            // Fallback just in case URL matching fails, send to active tab
            chrome.tabs.query({active: true, currentWindow: true}, function(activeTabs) {
                if (activeTabs && activeTabs.length > 0) {
                    chrome.tabs.sendMessage(activeTabs[0].id, msg, function(response) {
                        if (!chrome.runtime.lastError && callback && response) {
                            callback(response);
                        }
                    });
                }
            });
        }
    });
}

// Request initial state right away when popup opens
sendMessageToContent({action: 'getPlaybackState'}, (res) => {
    updatePlayState(res.isPlaying);
});

function checkServerConnection() {
    let statusDiv = document.querySelector('.status');
    if (!statusDiv) return;
    
    fetch('http://127.0.0.1:8000/docs')
        .then(response => {
            if (response.ok) {
                if (statusDiv.innerText === "Not Connected to Local Server" || statusDiv.innerText === "Connected to Local Server") {
                    statusDiv.innerText = "Connected to Local Server";
                    statusDiv.style.color = "#888888";
                }
            } else {
                throw new Error("Server bad status");
            }
        })
        .catch(err => {
            statusDiv.innerText = "Not Connected to Local Server";
            statusDiv.style.color = "#e74c3c"; // Red
        });
}

// Check immediately and then every 3 seconds
checkServerConnection();
setInterval(checkServerConnection, 3000);
