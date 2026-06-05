// content.js
let currentVoice = "en_US-lessac-high";
let currentSpeed = 1.0;
let currentDelay = 0.5;
let autoReadNewLessons = true;
let audioQueue = [];
let textQueue = [];
let isPlaying = false;
let isFetchingAudio = false;
let pauseTimeoutId = null;
let currentSectionIndex = -1;
let spokenBubbles = new WeakSet();
let activeBubbles = [];

// Track if the user has interacted to prevent reading page-load history
let hasInteractedWithPage = false;

// Create a SINGLE reusable audio element to bypass Chrome's Autoplay restrictions
let currentAudio = new Audio();

document.addEventListener('click', () => {
    hasInteractedWithPage = true;
    if (!currentAudio.src) {
        currentAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        currentAudio.play().catch(() => {});
    }
}, { once: true });

function isFromAi(element) {
    if (element.classList && element.classList.contains('MuiTypography-body1')) {
        return window.getComputedStyle(element).backgroundColor === 'rgb(46, 46, 46)';
    }
    
    // For code blocks, find the top frame of the code box
    let codeWrapper = element.closest('.MuiTypography-body2');
    if (codeWrapper && codeWrapper.parentElement) {
        let codeBoxWrapper = codeWrapper.parentElement;
        let topFrame = codeBoxWrapper.querySelector('.MuiStack-root');
        
        if (topFrame) {
            // If it's the User's green top frame, ignore it
            if (topFrame.classList.contains('mui-89ym5n')) return false;
            // If it's the AI's dark top frame, read it
            if (topFrame.classList.contains('mui-1l3hq3b')) return true;
            
            // Fallback: assume it belongs to the AI if it has the standard dark background
            if (window.getComputedStyle(topFrame).backgroundColor === 'rgb(46, 46, 46)') {
                return true;
            }
        }
    }
    return false;
}

function extractText(node) {
    if (node.tagName && node.tagName.toLowerCase() === 'code') {
        let text = '';
        node.childNodes.forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE && child.classList.contains('linenumber')) {
                return; // Skip line numbers completely
            }
            text += child.textContent;
        });
        return text.trim();
    }
    return node.innerText ? node.innerText.trim() : node.textContent.trim();
}

function getPlaybackStatus() {
    return isPlaying || isFetchingAudio || !currentAudio.paused;
}

function broadcastPlaybackState() {
    try {
        let p = chrome.runtime.sendMessage({action: 'playbackState', isPlaying: getPlaybackStatus()});
        if (p && p.catch) p.catch(() => {});
    } catch (e) {}
}

currentAudio.addEventListener('play', broadcastPlaybackState);
currentAudio.addEventListener('pause', broadcastPlaybackState);
currentAudio.addEventListener('ended', broadcastPlaybackState);

document.addEventListener('keydown', () => {
    hasInteractedWithPage = true;
}, { once: true });

chrome.storage.local.get(['selectedVoice', 'readingSpeed', 'bubbleDelay', 'autoReadNewLessons'], function(data) {
    if(data.selectedVoice !== undefined) currentVoice = data.selectedVoice;
    if(data.readingSpeed !== undefined) currentSpeed = data.readingSpeed;
    if(data.bubbleDelay !== undefined) currentDelay = data.bubbleDelay;
    if(data.autoReadNewLessons !== undefined) autoReadNewLessons = data.autoReadNewLessons;
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.selectedVoice) {
            currentVoice = changes.selectedVoice.newValue;
        }
        if (changes.readingSpeed) {
            currentSpeed = changes.readingSpeed.newValue;
            currentAudio.playbackRate = currentSpeed;
        }
        if (changes.bubbleDelay) {
            currentDelay = changes.bubbleDelay.newValue;
        }
        if (changes.autoReadNewLessons) {
            autoReadNewLessons = changes.autoReadNewLessons.newValue;
        }
    }
});

function clearPlayback() {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    audioQueue = [];
    textQueue = [];
    isPlaying = false;
    isFetchingAudio = false;
    if (pauseTimeoutId) clearTimeout(pauseTimeoutId);
    broadcastPlaybackState();
}

function playSection(bubbles) {
    clearPlayback();
    activeBubbles = bubbles;
    bubbles.forEach(bubble => {
        let text = extractText(bubble);
        if (text.length > 0) {
            queueTextToSpeak(text);
            spokenBubbles.add(bubble); // Mark as spoken
        }
    });
}

function getSections() {
    let allBubbles = Array.from(document.querySelectorAll('.MuiTypography-body1, pre code'));
    let aiBubbles = allBubbles.filter(isFromAi);
    let svgs = Array.from(document.querySelectorAll('svg.agent-avatar'));
    
    let validSvgs = svgs.filter(svg => {
        return aiBubbles.some(bubble => (svg.compareDocumentPosition(bubble) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    
    let sections = [];
    if (validSvgs.length === 0 && aiBubbles.length > 0) {
        sections.push(aiBubbles);
        return sections;
    }
    
    for (let i = 0; i < validSvgs.length; i++) {
        let currentSvg = validSvgs[i];
        let nextSvg = (i + 1 < validSvgs.length) ? validSvgs[i+1] : null;
        
        let sectionBubbles = aiBubbles.filter(bubble => {
            let isAfterCurrent = (currentSvg.compareDocumentPosition(bubble) & Node.DOCUMENT_POSITION_FOLLOWING);
            let isBeforeNext = nextSvg ? (bubble.compareDocumentPosition(nextSvg) & Node.DOCUMENT_POSITION_FOLLOWING) : true;
            return isAfterCurrent && isBeforeNext;
        });
        
        if (sectionBubbles.length > 0) {
            sections.push(sectionBubbles);
        }
    }
    return sections;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    let isAllowedPath = location.pathname.startsWith('/practice/') || location.pathname.startsWith('/learn/');
    
    if (request.action === 'getPlaybackState') {
        if (sendResponse) sendResponse({isPlaying: isAllowedPath ? getPlaybackStatus() : false});
        return;
    }
    
    if (!isAllowedPath) return;

    if (request.action === 'togglePlayPause') {
        if (currentAudio.paused) {
            if (currentAudio.src) currentAudio.play();
        } else {
            currentAudio.pause();
        }
        broadcastPlaybackState();
    } else if (request.action === 'stop') {
        clearPlayback();
    } else if (request.action === 'restartCurrent') {
        if (activeBubbles && activeBubbles.length > 0) {
            playSection(activeBubbles);
        }
    } else if (request.action === 'readAll') {
        let sections = getSections();
        if (sections.length > 0) {
            currentSectionIndex = sections.length - 1;
            playSection(sections[currentSectionIndex]);
        }
    } else if (request.action === 'readFromTop') {
        currentSectionIndex = 0; // Reset index to the top
        
        let allBubbles = Array.from(document.querySelectorAll('.MuiTypography-body1, pre code'));
        let aiBubbles = allBubbles.filter(isFromAi);
        playSection(aiBubbles); // Just play everything in one huge queue
    } else if (request.action === 'readNextSection') {
        let sections = getSections();
        if (currentSectionIndex < sections.length - 1 && sections.length > 0) {
            currentSectionIndex++;
            playSection(sections[currentSectionIndex]);
        }
    } else if (request.action === 'readPreviousSection') {
        let sections = getSections();
        if (currentSectionIndex > 0 && sections.length > 0) {
            currentSectionIndex--;
            playSection(sections[currentSectionIndex]);
        } else if (currentSectionIndex === -1 && sections.length > 0) {
            // If they hit Back and they weren't in a section sequence, maybe go to the second-to-last?
            // Actually, if they are -1, they didn't start. Let's just do nothing.
        }
    }
});

function queueTextToSpeak(text) {
    if (!text.trim()) return;
    textQueue.push(text);
    processTextQueue();
}

async function processTextQueue() {
    if (isFetchingAudio || textQueue.length === 0) return;
    
    isFetchingAudio = true;
    broadcastPlaybackState();
    let text = textQueue.shift();
    
    // Always read the absolute latest voice from storage before generating!
    chrome.storage.local.get(['selectedVoice'], async function(data) {
        let voiceToUse = data.selectedVoice || "en_US-lessac-high";
        
        try {
            let response = await fetch("http://127.0.0.1:8000/speak", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({text: text, voice: voiceToUse})
            });
            
            if (response.ok) {
                let blob = await response.blob();
                let audioUrl = URL.createObjectURL(blob);
                audioQueue.push(audioUrl);
                playNext();
            }
        } catch (e) {
            console.error("Failed to connect to Local Voice Server", e);
        }
        
        isFetchingAudio = false;
        broadcastPlaybackState();
        processTextQueue();
    });
}

function playNext() {
    if (isPlaying || audioQueue.length === 0) return;
    
    isPlaying = true;
    broadcastPlaybackState();
    let url = audioQueue.shift();
    
    currentAudio.src = url;
    currentAudio.playbackRate = currentSpeed;
    
    currentAudio.onended = () => {
        URL.revokeObjectURL(url);
        // Add a natural pause based on user settings before reading the next paragraph!
        pauseTimeoutId = setTimeout(() => {
            isPlaying = false;
            broadcastPlaybackState();
            playNext();
        }, currentDelay * 1000);
    };
    
    currentAudio.play().catch(e => {
        console.error("Audio playback failed", e);
        isPlaying = false;
        broadcastPlaybackState();
        playNext();
    });
}

// -----------------------------------------------------
// THE NEW "BUBBLE-BY-BUBBLE" HEURISTIC (VERSION 6)
// -----------------------------------------------------

let lastMutationTime = Date.now();
let lastUrl = location.href;
let isFirstBatch = true; // True until the first period of stability after load or navigation

const observer = new MutationObserver(() => {
    lastMutationTime = Date.now();
});

observer.observe(document.body, { 
    childList: true, 
    subtree: true, 
    characterData: true 
});

setInterval(() => {
    let isAllowedPath = location.pathname.startsWith('/practice/') || location.pathname.startsWith('/learn/');
    
    // SPA Navigation Detection
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        isFirstBatch = true; // Reset batch flag on navigation!
        clearPlayback();
        return;
    }

    if (!isAllowedPath) return;

    let timeSinceLastMutation = Date.now() - lastMutationTime;
    let isGenerating = timeSinceLastMutation < 1000;

    let allBubbles = Array.from(document.querySelectorAll('.MuiTypography-body1, pre code'));
    let aiBubbles = allBubbles.filter(isFromAi);

    let newBubblesToRead = [];

    if (aiBubbles.length > 0) {
        aiBubbles.forEach((bubble, index) => {
            if (spokenBubbles.has(bubble)) return;

            let isLastBubble = (index === aiBubbles.length - 1);
            let isFinished = !isLastBubble || !isGenerating;

            if (isFinished) {
                // If this is the initial load or navigation batch, SILENTLY mark as spoken
                if (isFirstBatch) {
                    spokenBubbles.add(bubble);
                    return;
                }
                
                let textToSpeak = extractText(bubble);
                if (textToSpeak.length > 0) {
                    if (autoReadNewLessons) {
                        newBubblesToRead.push(bubble);
                    } else {
                        console.log("AutoLecture Auto-Read Disabled. Ignoring Bubble:", textToSpeak);
                    }
                }
                spokenBubbles.add(bubble);
            }
        });
    }

    if (newBubblesToRead.length > 0) {
        activeBubbles = newBubblesToRead;
        newBubblesToRead.forEach(bubble => {
            let extracted = extractText(bubble);
            console.log("AutoLecture Speaking Finished Bubble:", extracted);
            queueTextToSpeak(extracted);
        });
    }

    // Once the page fully stabilizes (no mutations for 1 second), the initial batch is done!
    if (!isGenerating) {
        isFirstBatch = false;
    }

}, 300);

console.log("AutoLecture Extension Loaded. Version 8 (isFirstBatch History Fix).");
