let wordList = [];
let totalWords = 0;
let isNewMode = true;
let isColour3Mode = true;
let isVowelMode = true;
let isShapeMode = true;
let currentFilteredWords = [];
let latestExportWords = [];
let exportButton = null;
let currentPosition = 0;
let currentPosition2 = -1;
let currentVowelIndex = 0;
let uniqueVowels = [];
let currentFilteredWordsForVowels = [];
let originalFilteredWords = [];
let hasAdjacentConsonants = null;
let hasO = null;
let selectedCurvedLetter = null;
let eeeCompleted = false;
let lexiconCompleted = false;
let originalLexCompleted = false;
let originalLexPosition = -1;
let currentPosition1Word = '';
let mostFrequentLetter = null;
let leastFrequentLetter = null;
let usedLettersInWorkflow = [];  // Track letters used in current workflow
let letterFrequencyMap = new Map();  // Store frequency of all letters

// Version constant - increment .1 for each push update, major version when specified
const APP_VERSION = '12.0';

// Store T9 1 LIE (L4) data for "B" feature
let t9OneLieBlankIndex = null;  // Position of BLANK (0-3)
let t9OneLiePossibleDigits = []; // Array of possible digits for BLANK
let t9OneLieSelectedDigits = []; // The full 4-digit selection from 1 LIE

// POSITION-CONS Constants
const ALPHABET_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
const VOWEL_SET = new Set(['A', 'E', 'I', 'O', 'U']);
const CONSONANT_LETTERS = ALPHABET_LETTERS.filter(letter => !VOWEL_SET.has(letter));

// POSITION-CONS State Management
const positionConsSequenceState = {};
let lastPositionConsLetters = '';
let lastPositionConsGeneratedLetters = '';

// Workflow Management
let workflows = JSON.parse(localStorage.getItem('workflows')) || [];
let currentWorkflow = null;

// Global workflow state management
let workflowState = {
    confirmedLetters: new Set(), // Letters we KNOW are in the word
    excludedLetters: new Set(),  // Letters we KNOW are NOT in the word
    confirmedPositions: {},      // Letters we know are at specific positions
    wordLength: null,           // If we know the word length
    hasVowels: new Set(),       // Vowels we've confirmed are in the word
    excludedVowels: new Set(),  // Vowels we've confirmed are NOT in the word
    hasO: null,                 // Whether word contains 'O' (from O? feature)
    hasE: null,                 // Whether word contains 'E' (from EEE features)
    abcdeSelection: new Set(),  // Letters selected in ABCDE feature
    abcSelection: new Set(),    // Letters selected in ABC feature
    mostFrequentRank: 1,        // Current rank for most frequent letter
    leastFrequentRank: 1,       // Current rank for least frequent letter
    usedLettersInWorkflow: []   // Track letters used in workflow (existing)
};

// Function to reset workflow state
function resetWorkflowState() {
    workflowState = {
        confirmedLetters: new Set(),
        excludedLetters: new Set(),
        confirmedPositions: {},
        wordLength: null,
        hasVowels: new Set(),
        excludedVowels: new Set(),
        hasO: null,
        hasE: null,
        abcdeSelection: new Set(),
        abcSelection: new Set(),
        mostFrequentRank: 1,
        leastFrequentRank: 1,
        usedLettersInWorkflow: []
    };
}

// T9 conversion mapping (standard phone keypad)
const t9Mapping = {
    'A': '2', 'B': '2', 'C': '2',
    'D': '3', 'E': '3', 'F': '3',
    'G': '4', 'H': '4', 'I': '4',
    'J': '5', 'K': '5', 'L': '5',
    'M': '6', 'N': '6', 'O': '6',
    'P': '7', 'Q': '7', 'R': '7', 'S': '7',
    'T': '8', 'U': '8', 'V': '8',
    'W': '9', 'X': '9', 'Y': '9', 'Z': '9'
};

// Convert word to T9 string
function wordToT9(word) {
    return word.toUpperCase().split('').map(char => t9Mapping[char] || '').join('');
}

// Calculate and store T9 strings for wordlist (only when needed)
let t9StringsMap = new Map();
let t9StringsCalculated = false;

function calculateT9Strings(words) {
    if (!t9StringsCalculated) {
        words.forEach(word => {
            t9StringsMap.set(word, wordToT9(word));
        });
        t9StringsCalculated = true;
    }
}

// Function to check if a letter is already known
function isLetterKnown(letter) {
    return workflowState.confirmedLetters.has(letter) || workflowState.excludedLetters.has(letter);
}

// Function to get known status of a letter
function getLetterStatus(letter) {
    if (workflowState.confirmedLetters.has(letter)) return 'confirmed';
    if (workflowState.excludedLetters.has(letter)) return 'excluded';
    return 'unknown';
}

// Function to log workflow state for debugging
function logWorkflowState() {
    console.log('=== WORKFLOW STATE ===');
    console.log('Confirmed letters:', Array.from(workflowState.confirmedLetters));
    console.log('Excluded letters:', Array.from(workflowState.excludedLetters));
    console.log('Confirmed positions:', workflowState.confirmedPositions);
    console.log('Word length:', workflowState.wordLength);
    console.log('Has vowels:', Array.from(workflowState.hasVowels));
    console.log('Excluded vowels:', Array.from(workflowState.excludedVowels));
    console.log('Has O:', workflowState.hasO);
    console.log('Has E:', workflowState.hasE);
    console.log('ABCDE selection:', Array.from(workflowState.abcdeSelection));
    console.log('ABC selection:', Array.from(workflowState.abcSelection));
    console.log('=====================');
}

// DOM Elements
const createWorkflowButton = document.getElementById('createWorkflowButton');
const cancelWorkflowButton = document.getElementById('cancelWorkflowButton');
const saveWorkflowButton = document.getElementById('saveWorkflowButton');
const backToHomeButton = document.getElementById('backToHomeButton');
const workflowName = document.getElementById('workflowName');
const selectedFeaturesList = document.getElementById('selectedFeaturesList');
const workflowSelect = document.getElementById('workflowSelect');
const performButton = document.getElementById('performButton');

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Register service worker for PWA functionality
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/coretest/service-worker.js', {
                updateViaCache: 'none' // Never use cached service worker
            });
            console.log('Service Worker registered successfully:', registration);
            
            // Check for updates immediately and on focus
            const checkForUpdates = () => {
                registration.update().catch(err => console.log('Update check failed:', err));
            };
            
            // Check immediately
            checkForUpdates();
            
            // Check when page becomes visible (user returns to app)
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    checkForUpdates();
                }
            });
            
            // Check when window gains focus
            window.addEventListener('focus', checkForUpdates);
            
            // Check for updates periodically
            setInterval(checkForUpdates, 30000); // Check every 30 seconds
            
            // Listen for service worker updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available, reload to use it
                            console.log('New service worker available, reloading...');
                            // Force reload after a short delay to ensure cache is cleared
                            setTimeout(() => {
                                window.location.reload(true);
                            }, 100);
                        } else if (newWorker.state === 'activated') {
                            // Service worker activated, reload to get fresh content
                            console.log('Service worker activated, reloading...');
                            window.location.reload(true);
                        }
                    });
                }
            });
            
            // Listen for controller change (service worker takeover)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Service worker controller changed, reloading...');
                window.location.reload(true);
            });
            
            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'SW_ACTIVATED') {
                    console.log('Service worker activated, version:', event.data.version, '- reloading to get fresh content...');
                    // Clear all caches before reload
                    if ('caches' in window) {
                        caches.keys().then(cacheNames => {
                            return Promise.all(
                                cacheNames.map(cacheName => {
                                    console.log('Clearing cache:', cacheName);
                                    return caches.delete(cacheName);
                                })
                            );
                        }).then(() => {
                            console.log('All caches cleared, reloading...');
                            window.location.reload(true);
                        });
                    } else {
                        window.location.reload(true);
                    }
                }
            });
            
            // Manual cache clear function (for testing/debugging)
            window.clearAllCaches = async function() {
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => {
                        console.log('Deleting cache:', name);
                        return caches.delete(name);
                    }));
                }
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
                }
                console.log('All caches cleared. Reloading...');
                window.location.reload(true);
            };
            
            // Send skip waiting message to service worker if it's waiting
            if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }
    
    // Load saved workflows from localStorage
    const savedWorkflows = localStorage.getItem('workflows');
    if (savedWorkflows) {
        workflows = JSON.parse(savedWorkflows);
        // Set the most recent workflow as default if there are any workflows
        if (workflows.length > 0) {
            const mostRecentWorkflow = workflows[workflows.length - 1];
            workflowSelect.value = mostRecentWorkflow.name;
            const workflowCustomSelect = document.getElementById('workflowCustomSelect');
            if (workflowCustomSelect) {
                const selectedText = workflowCustomSelect.querySelector('.selected-text');
                if (selectedText) {
                    selectedText.textContent = mostRecentWorkflow.name;
                }
            }
        }
    }
    
    // Initialize version display
    function initializeVersionDisplay() {
        const versionDisplay = document.getElementById('versionDisplay');
        if (versionDisplay) {
            // Check if in PWA mode (standalone or fullscreen)
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                                window.matchMedia('(display-mode: fullscreen)').matches ||
                                (window.navigator.standalone === true);
            
            // Format version: "B12.0" in browser, "12.0" in PWA
            if (isStandalone) {
                versionDisplay.textContent = `V: ${APP_VERSION}`;
            } else {
                versionDisplay.textContent = `V: B${APP_VERSION}`;
            }
        }
    }
    
    // Initialize version display
    initializeVersionDisplay();
    
    // Also check on resize/orientation change (in case mode changes)
    window.addEventListener('resize', initializeVersionDisplay);
    window.addEventListener('orientationchange', initializeVersionDisplay);
    
    // Initialize dropdowns and button listeners
    initializeDropdowns();
    
    // Display saved workflows
    displaySavedWorkflows();
    
    // Initialize NOT IN feature
    initializeNotInFeature();

    // Ensure export button is available immediately
    initializeExportButton();

    // Add wordlist change listener - reset loaded flag when wordlist changes
    const wordlistSelect = document.getElementById('wordlistSelect');
    wordlistSelect.addEventListener('change', () => {
        // Reset the loaded flag so new wordlist will be loaded when workflow executes
        wordListLoaded = false;
        wordList = [];
        currentFilteredWords = [];
        updateExportButtonState(currentFilteredWords);
    });

    const availableFeatures = document.getElementById('availableFeatures');
    if (availableFeatures) {
        console.log('[DEBUG] On load: scrollHeight:', availableFeatures.scrollHeight, 'clientHeight:', availableFeatures.clientHeight);
        setTimeout(() => {
            console.log('[DEBUG] After 500ms: scrollHeight:', availableFeatures.scrollHeight, 'clientHeight:', availableFeatures.clientHeight);
        }, 500);
        window.addEventListener('resize', () => {
            console.log('[DEBUG] On resize: scrollHeight:', availableFeatures.scrollHeight, 'clientHeight:', availableFeatures.clientHeight);
        });
    }
});

// Function to initialize dropdowns
function initializeDropdowns() {
    // --- WORKFLOW DROPDOWN ---
    const workflowSelect = document.getElementById('workflowSelect');
    // Remove all options except the first two
    while (workflowSelect.options.length > 2) {
        workflowSelect.remove(2);
    }
    // Add options for each saved workflow
    const savedWorkflows = JSON.parse(localStorage.getItem('workflows') || '[]');
    savedWorkflows.forEach(workflow => {
        const option = document.createElement('option');
        option.value = workflow.name;
        option.textContent = workflow.name;
        workflowSelect.appendChild(option);
    });
    // Remove any existing custom-select immediately after workflowSelect
    let nextElem = workflowSelect.nextElementSibling;
    while (nextElem && nextElem.classList && nextElem.classList.contains('custom-select')) {
        const toRemove = nextElem;
        nextElem = nextElem.nextElementSibling;
        toRemove.parentNode.removeChild(toRemove);
    }
    // Create new custom select
    const workflowCustomSelect = document.createElement('div');
    workflowCustomSelect.className = 'custom-select';
    workflowCustomSelect.id = 'workflowCustomSelect';
    workflowCustomSelect.innerHTML = `
        <div class="selected-text">${workflowSelect.options[workflowSelect.selectedIndex]?.textContent || 'Select a workflow...'}</div>
        <div class="options-list"></div>
    `;
    workflowSelect.insertAdjacentElement('afterend', workflowCustomSelect);
    // Find and set z-index on parent dropdown container
    const workflowDropdownContainer = workflowSelect.closest('.dropdown');
    if (workflowDropdownContainer) {
        workflowDropdownContainer.style.zIndex = '99999';
        workflowDropdownContainer.style.position = 'relative';
    }
    const workflowSelectedText = workflowCustomSelect.querySelector('.selected-text');
    const workflowOptionsList = workflowCustomSelect.querySelector('.options-list');
    // Set very high z-index to ensure workflow dropdown is always on top
    workflowCustomSelect.style.zIndex = '99999';
    workflowCustomSelect.style.position = 'relative';
    workflowOptionsList.style.zIndex = '99999';
    // Populate options
    workflowOptionsList.innerHTML = '';
    const defaultWorkflowOptions = [
        { value: '', text: 'Select a workflow...' },
        { value: 'create-new', text: 'New Workflow' }
    ];
    defaultWorkflowOptions.forEach(option => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.textContent = option.text;
        optionElement.dataset.value = option.value;
        workflowOptionsList.appendChild(optionElement);
    });
    savedWorkflows.forEach(workflow => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.textContent = workflow.name;
        optionElement.dataset.value = workflow.name;
        workflowOptionsList.appendChild(optionElement);
    });
    // Event handlers
    const closeWorkflowDropdown = () => {
        workflowOptionsList.classList.remove('show');
        workflowOptionsList.style.cssText = '';
        document.body.classList.remove('workflow-dropdown-open');
    };
    const toggleWorkflowDropdown = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        closeWordlistDropdown();
        if (workflowOptionsList.classList.contains('show')) {
            closeWorkflowDropdown();
        } else {
            // Ensure workflow dropdown container and parent are on top
            const workflowDropdownContainer = workflowSelect.closest('.dropdown');
            if (workflowDropdownContainer) {
                workflowDropdownContainer.style.zIndex = '99999';
                workflowDropdownContainer.style.position = 'relative';
            }
            workflowCustomSelect.style.zIndex = '99999';
            workflowCustomSelect.style.position = 'relative';
            workflowOptionsList.classList.add('show');
            workflowOptionsList.style.cssText = `
                display: block !important;
                position: absolute;
                width: 100%;
                height: auto;
                max-height: none;
                overflow: visible;
                z-index: 99999 !important;
                background: white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            `;
            document.body.classList.add('workflow-dropdown-open');
        }
    };
    workflowCustomSelect.addEventListener('click', toggleWorkflowDropdown);
    workflowCustomSelect.addEventListener('touchstart', toggleWorkflowDropdown, { passive: false });
    const handleWorkflowOptionSelect = (e) => {
        e.preventDefault(); e.stopPropagation();
        const option = e.target.closest('.option');
        if (!option) return;
        const value = option.dataset.value;
        const text = option.textContent;
        workflowSelect.value = value;
        workflowSelectedText.textContent = text;
        closeWorkflowDropdown();
        if (value === 'create-new') { showWorkflowCreation(); }
    };
    workflowOptionsList.addEventListener('click', handleWorkflowOptionSelect);
    workflowOptionsList.addEventListener('touchstart', handleWorkflowOptionSelect, { passive: false });

    // --- WORDLIST DROPDOWN ---
    const wordlistSelect = document.getElementById('wordlistSelect');
    // Remove any existing custom-select immediately after wordlistSelect
    nextElem = wordlistSelect.nextElementSibling;
    while (nextElem && nextElem.classList && nextElem.classList.contains('custom-select')) {
        const toRemove = nextElem;
        nextElem = nextElem.nextElementSibling;
        toRemove.parentNode.removeChild(toRemove);
    }
    // Create new custom select
    const wordlistCustomSelect = document.createElement('div');
    wordlistCustomSelect.className = 'custom-select';
    wordlistCustomSelect.id = 'wordlistCustomSelect';
    wordlistCustomSelect.innerHTML = `
        <div class="selected-text">${wordlistSelect.options[wordlistSelect.selectedIndex]?.textContent || 'ENUK Wordlist'}</div>
        <div class="options-list"></div>
    `;
    wordlistSelect.insertAdjacentElement('afterend', wordlistCustomSelect);
    const wordlistSelectedText = wordlistCustomSelect.querySelector('.selected-text');
    const wordlistOptionsList = wordlistCustomSelect.querySelector('.options-list');
    wordlistCustomSelect.style.zIndex = '100';
    wordlistOptionsList.style.zIndex = '101';
    // Populate options
    wordlistOptionsList.innerHTML = '';
    Array.from(wordlistSelect.options).forEach(option => {
        const customOption = document.createElement('div');
        customOption.className = 'option';
        customOption.textContent = option.textContent;
        customOption.dataset.value = option.value;
        if (option.selected) { customOption.classList.add('selected'); }
        wordlistOptionsList.appendChild(customOption);
    });
    // Event handlers
    const closeWordlistDropdown = () => {
        wordlistOptionsList.classList.remove('show');
        wordlistOptionsList.style.cssText = '';
    };
    const toggleWordlistDropdown = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        closeWorkflowDropdown();
        if (wordlistOptionsList.classList.contains('show')) {
            closeWordlistDropdown();
        } else {
            wordlistOptionsList.classList.add('show');
            wordlistOptionsList.style.cssText = `
                display: block !important;
                position: absolute;
                width: 100%;
                height: auto;
                max-height: none;
                overflow: visible;
                z-index: 101;
                background: white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            `;
        }
    };
    wordlistCustomSelect.addEventListener('click', toggleWordlistDropdown);
    wordlistCustomSelect.addEventListener('touchstart', toggleWordlistDropdown, { passive: false });
    const handleWordlistOptionSelect = (e) => {
        e.preventDefault(); e.stopPropagation();
        const option = e.target.closest('.option');
        if (!option) return;
        const value = option.dataset.value;
        const text = option.textContent;
        wordlistSelect.value = value;
        wordlistSelectedText.textContent = text;
        closeWordlistDropdown();
    };
    wordlistOptionsList.addEventListener('click', handleWordlistOptionSelect);
    wordlistOptionsList.addEventListener('touchstart', handleWordlistOptionSelect, { passive: false });

    // --- OUTSIDE CLICK HANDLERS ---
    const closeDropdowns = (e) => {
        if (!workflowCustomSelect.contains(e.target)) { closeWorkflowDropdown(); }
        if (!wordlistCustomSelect.contains(e.target)) { closeWordlistDropdown(); }
    };
    document.addEventListener('click', closeDropdowns);
    document.addEventListener('touchstart', closeDropdowns, { passive: true });

    // Set up button listeners
    setupButtonListeners();
}

// Function to setup button listeners
function setupButtonListeners() {
    // Create Workflow button
    const createWorkflowButton = document.getElementById('createWorkflowButton');
    if (createWorkflowButton) {
        createWorkflowButton.replaceWith(createWorkflowButton.cloneNode(true));
        const newCreateWorkflowButton = document.getElementById('createWorkflowButton');
        newCreateWorkflowButton.addEventListener('click', showWorkflowCreation);
        newCreateWorkflowButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            showWorkflowCreation();
        }, { passive: false });
    }
    
    // Toggle Saved Workflows button
    const toggleSavedWorkflowsButton = document.getElementById('toggleSavedWorkflows');
    if (toggleSavedWorkflowsButton) {
        toggleSavedWorkflowsButton.replaceWith(toggleSavedWorkflowsButton.cloneNode(true));
        const newToggleButton = document.getElementById('toggleSavedWorkflows');
        newToggleButton.addEventListener('click', toggleSavedWorkflows);
        newToggleButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            toggleSavedWorkflows();
        }, { passive: false });
    }
    
    // Cancel Workflow button
    const cancelWorkflowButton = document.getElementById('cancelWorkflowButton');
    if (cancelWorkflowButton) {
        cancelWorkflowButton.replaceWith(cancelWorkflowButton.cloneNode(true));
        const newCancelWorkflowButton = document.getElementById('cancelWorkflowButton');
        newCancelWorkflowButton.addEventListener('click', hideWorkflowCreation);
        newCancelWorkflowButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            hideWorkflowCreation();
        }, { passive: false });
    }
    
    // Save Workflow button
    const saveWorkflowButton = document.getElementById('saveWorkflowButton');
    if (saveWorkflowButton) {
        saveWorkflowButton.replaceWith(saveWorkflowButton.cloneNode(true));
        const newSaveWorkflowButton = document.getElementById('saveWorkflowButton');
        newSaveWorkflowButton.addEventListener('click', saveWorkflow);
        newSaveWorkflowButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            saveWorkflow();
        }, { passive: false });
    }
    
    // Perform button
    const performButton = document.getElementById('performButton');
    if (performButton) {
        performButton.replaceWith(performButton.cloneNode(true));
        const newPerformButton = document.getElementById('performButton');
        newPerformButton.addEventListener('click', async () => {
            const selectedWorkflow = document.getElementById('workflowSelect').value;
            if (!selectedWorkflow) {
                alert('Please select a workflow first');
                return;
            }
            try {
                const workflow = workflows.find(w => w.name === selectedWorkflow);
                if (!workflow) {
                    throw new Error('Selected workflow not found');
                }
                document.getElementById('homepage').style.display = 'none';
                document.getElementById('workflowCreation').style.display = 'none';
                const workflowExecution = document.getElementById('workflowExecution');
                workflowExecution.style.display = 'block';
                await executeWorkflow(workflow.steps);
            } catch (error) {
                console.error('Error executing workflow:', error);
                alert('Error executing workflow: ' + error.message);
            }
        });
        newPerformButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            newPerformButton.click();
        }, { passive: false });
    }
}

// Function to add feature to selected features list
function addFeatureToList(feature) {
    const selectedFeaturesList = document.getElementById('selectedFeaturesList');
    if (!selectedFeaturesList) return;
    
    // Check if feature is already selected
    const existingFeature = selectedFeaturesList.querySelector(`[data-feature="${feature}"]`);
    if (!existingFeature) {
        const featureItem = document.createElement('div');
        featureItem.className = 'selected-feature-item';
        featureItem.setAttribute('data-feature', feature);
        featureItem.draggable = true;
        
        const featureName = document.createElement('span');
        featureName.textContent = feature.toUpperCase();
        featureItem.appendChild(featureName);
        
        // Add click event to remove feature
        featureItem.addEventListener('click', () => {
            featureItem.remove();
        });
        
        // Add touch and drag events for mobile
        featureItem.addEventListener('touchstart', (e) => {
            e.preventDefault();
            featureItem.classList.add('dragging');
            featureItem.remove();
        }, { passive: false });
        
        featureItem.addEventListener('touchend', (e) => {
            e.preventDefault();
            featureItem.classList.remove('dragging');
        }, { passive: false });
        
        featureItem.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', feature);
            e.dataTransfer.effectAllowed = 'move';
            featureItem.classList.add('dragging');
        });
        
        featureItem.addEventListener('dragend', () => {
            featureItem.classList.remove('dragging');
        });
        
        selectedFeaturesList.appendChild(featureItem);
    }
}

// Function to check if a letter is curved
function isCurvedLetter(letter) {
    if (!letter) return false;
    letter = letter.toUpperCase();
    return letterShapes.curved.has(letter);
}

// Function to filter words by curved letter positions
function filterWordsByCurvedPositions(words, positions) {
    // Special case: if input is "0", filter for words with all straight letters in first 5 positions
    if (positions === "0") {
        return words.filter(word => {
            // Check first 5 positions (or word length if shorter)
            for (let i = 0; i < Math.min(5, word.length); i++) {
                if (isCurvedLetter(word[i])) {
                    return false; // Reject if any curved letter found
                }
            }
            return true; // Keep if all letters are straight
        });
    }

    // Convert positions string to array of numbers and validate
    const positionArray = positions.split('')
        .map(Number)
        .filter(pos => pos >= 1 && pos <= 5); // Only allow positions 1-5
    
    if (positionArray.length === 0) {
        console.log('No valid positions provided');
        return words;
    }
    
    return words.filter(word => {
        // Skip words shorter than the highest required position
        const maxPosition = Math.max(...positionArray);
        if (word.length < maxPosition) {
            return false;
        }
        
        // Check each position from 1 to 5
        for (let i = 0; i < 5; i++) {
            const pos = i + 1; // Convert to 1-based position
            const letter = word[i];
            
            // Skip if we've reached the end of the word
            if (!letter) {
                continue;
            }
            
            if (positionArray.includes(pos)) {
                // This position should have a curved letter
                if (!isCurvedLetter(letter)) {
                    return false;
                }
            } else {
                // This position should have a straight letter
                if (isCurvedLetter(letter)) {
                    return false;
                }
            }
        }
        
        return true;
    });
}

// Word categories mapping
const wordCategories = {
    // Business and commerce
    business: new Set(['BUSINESS', 'COMPANY', 'CORPORATION', 'ENTERPRISE', 'INDUSTRY', 'MARKET', 'TRADE', 'COMMERCE', 'OFFICE', 'STORE', 'SHOP']),
    
    // Technology and electronics
    technology: new Set(['COMPUTER', 'PHONE', 'CAMERA', 'RADIO', 'TELEVISION', 'LAPTOP', 'CHARGING', 'BATTERY', 'SCREEN', 'KEYBOARD', 'MOUSE', 'PRINTER', 'SCANNER', 'ROUTER', 'SERVER', 'NETWORK', 'WIFI', 'BLUETOOTH', 'USB', 'HDMI']),
    
    // Food and drink
    food: new Set(['PIZZA', 'PASTA', 'BURGER', 'SANDWICH', 'SALAD', 'SOUP', 'STEW', 'CAKE', 'BREAD', 'COFFEE', 'TEA', 'WINE', 'BEER', 'MEAT', 'FISH', 'CHICKEN', 'RICE', 'NOODLE', 'FRUIT', 'VEGETABLE']),
    
    // Elements and chemistry
    element: new Set(['CARBON', 'OXYGEN', 'NITROGEN', 'HYDROGEN', 'SILVER', 'GOLD', 'IRON', 'COPPER', 'ALUMINUM', 'CALCIUM', 'SODIUM', 'POTASSIUM', 'MAGNESIUM', 'CHLORINE', 'FLUORINE', 'BROMINE', 'IODINE']),
    
    // Transportation
    transport: new Set(['CARRIAGE', 'TRAIN', 'PLANE', 'BOAT', 'SHIP', 'TRUCK', 'BUS', 'TAXI', 'CAR', 'BIKE', 'MOTORCYCLE', 'HELICOPTER', 'SUBWAY', 'TRAM', 'FERRY', 'JET', 'ROCKET', 'SPACESHIP']),
    
    // Buildings and structures
    building: new Set(['HOUSE', 'BUILDING', 'TOWER', 'BRIDGE', 'TUNNEL', 'GATE', 'WALL', 'CASTLE', 'PALACE', 'TEMPLE', 'CHURCH', 'MOSQUE', 'SYNAGOGUE', 'STADIUM', 'ARENA', 'THEATER', 'CINEMA', 'MUSEUM', 'LIBRARY', 'SCHOOL', 'HOSPITAL', 'OFFICE', 'FACTORY', 'WAREHOUSE', 'STORE', 'SHOP', 'MARKET', 'MALL', 'PARK', 'GARDEN', 'PARK', 'PLAYGROUND', 'POOL', 'GARDEN', 'FARM', 'BARN', 'SHED', 'GARAGE', 'STABLE']),
    
    // Nature and environment
    nature: new Set(['RIVER', 'MOUNTAIN', 'FOREST', 'OCEAN', 'LAKE', 'STREAM', 'VALLEY', 'DESERT', 'JUNGLE', 'MEADOW', 'GRASSLAND', 'WETLAND', 'CAVE', 'VOLCANO', 'GLACIER', 'ISLAND', 'BEACH', 'COAST', 'CLIFF', 'CANYON']),
    
    // Animals
    animal: new Set(['LION', 'TIGER', 'ELEPHANT', 'GIRAFFE', 'MONKEY', 'DOLPHIN', 'WHALE', 'SHARK', 'EAGLE', 'HAWK', 'OWL', 'PENGUIN', 'KANGAROO', 'KOALA', 'PANDA', 'BEAR', 'WOLF', 'FOX', 'DEER', 'RABBIT', 'SQUIRREL', 'MOUSE', 'RAT', 'HAMSTER', 'GERBIL', 'GUINEA', 'PIG', 'FERRET', 'WEASEL', 'OTTER', 'BEAVER', 'RACCOON', 'SKUNK', 'BADGER', 'HEDGEHOG', 'PORCUPINE', 'SLOTH', 'ANTEATER', 'ARMADILLO', 'PLATYPUS', 'ECHIDNA', 'ANIMAL']),
    
    // Plants
    plant: new Set(['TREE', 'FLOWER', 'GRASS', 'BUSH', 'VINE', 'LEAF', 'ROSE', 'LILY', 'TULIP', 'DAISY', 'SUNFLOWER', 'PALM', 'PINE', 'OAK', 'MAPLE', 'BAMBOO', 'CACTUS', 'MUSHROOM', 'FERN', 'MOSS', 'HERB', 'SPICE', 'SEED', 'SPROUT', 'BUD', 'STEM', 'BRANCH', 'TRUNK', 'ROOT', 'BARK', 'THORN', 'PETAL', 'POLLEN', 'NECTAR', 'SAP', 'PLANT']),
    
    // Weather
    weather: new Set(['RAIN', 'STORM', 'CLOUD', 'WIND', 'SUN', 'SNOW', 'FROST', 'THUNDER', 'LIGHTNING', 'HAIL', 'SLEET', 'FOG', 'MIST', 'HUMIDITY', 'DROUGHT', 'FLOOD', 'TORNADO', 'HURRICANE', 'CYCLONE', 'BLIZZARD']),
    
    // Time
    time: new Set(['YEAR', 'MONTH', 'WEEK', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'CENTURY', 'DECADE', 'SEASON', 'SPRING', 'SUMMER', 'AUTUMN', 'WINTER', 'MORNING', 'EVENING', 'NIGHT', 'DAWN', 'DUSK', 'TIME', 'PERIOD', 'ERA', 'AGE', 'STAGE', 'PHASE', 'STEP', 'POINT', 'MOMENT', 'INSTANT', 'WHILE', 'DURATION', 'SPAN', 'INTERVAL', 'GAP', 'BREAK', 'PAUSE']),
    
    // Body parts
    body: new Set(['HEAD', 'HAND', 'FOOT', 'ARM', 'LEG', 'EYE', 'EAR', 'NOSE', 'MOUTH', 'FACE', 'HAIR', 'SKIN', 'BONE', 'MUSCLE', 'HEART', 'LUNG', 'LIVER', 'BRAIN', 'STOMACH', 'INTESTINE']),
    
    // Clothing
    clothing: new Set(['SHIRT', 'PANTS', 'DRESS', 'SKIRT', 'JACKET', 'COAT', 'HAT', 'SHOES', 'SOCKS', 'GLOVES', 'SCARF', 'TIE', 'BELT', 'WATCH', 'JEWELRY', 'NECKLACE', 'BRACELET', 'RING', 'EARRING']),
    
    // Tools
    tool: new Set(['HAMMER', 'SCREWDRIVER', 'WRENCH', 'PLIERS', 'DRILL', 'SAW', 'AXE', 'SHOVEL', 'RAKE', 'BROOM', 'MOP', 'BRUSH', 'KNIFE', 'FORK', 'SPOON', 'PLATE', 'BOWL', 'CUP', 'GLASS']),
    
    // Furniture
    furniture: new Set(['TABLE', 'CHAIR', 'SOFA', 'BED', 'DESK', 'SHELF', 'CABINET', 'WARDROBE', 'DRESSER', 'BOOKCASE', 'COUCH', 'OTTOMAN', 'STOOL', 'BENCH', 'MIRROR', 'LAMP', 'CLOCK', 'PICTURE']),
    
    // Music
    music: new Set(['PIANO', 'GUITAR', 'DRUM', 'VIOLIN', 'FLUTE', 'TRUMPET', 'SAXOPHONE', 'CLARINET', 'HARP', 'CELLO', 'BASS', 'ORGAN', 'ACCORDION', 'TAMBOURINE', 'CYMBAL', 'XYLOPHONE', 'HARMONICA', 'MUSIC', 'SONG', 'MELODY', 'HARMONY', 'RHYTHM', 'BEAT', 'TUNE', 'NOTE', 'CHORD', 'SCALE', 'INSTRUMENT']),
    
    // Materials and products
    material: new Set(['PAPER', 'PLASTIC', 'METAL', 'WOOD', 'GLASS', 'RUBBER', 'LEATHER', 'FABRIC', 'CLOTH', 'COTTON', 'SILK', 'WOOL', 'NYLON', 'POLYESTER', 'CELLOPHANE', 'CELLOTAPE', 'TAPE', 'FOIL', 'FILM', 'SHEET', 'ROLL', 'STRIP', 'BAND', 'CORD', 'ROPE', 'STRING', 'WIRE', 'CABLE', 'PIPE', 'TUBE', 'ROD', 'BEAM', 'PLANK', 'BOARD', 'TILE', 'BRICK', 'STONE', 'CONCRETE', 'CEMENT', 'PAINT', 'INK', 'DYE', 'PIGMENT', 'WAX', 'OIL', 'GREASE', 'GLUE', 'ADHESIVE', 'SEALANT', 'COATING', 'FINISH']),
    
    // Sports
    sport: new Set(['FOOTBALL', 'BASKETBALL', 'TENNIS', 'GOLF', 'SWIMMING', 'RUNNING', 'JUMPING', 'THROWING', 'CATCHING', 'KICKING', 'HITTING', 'SCORING', 'RACING', 'COMPETITION', 'TOURNAMENT', 'CHAMPIONSHIP']),
    
    // Colors
    color: new Set(['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'ORANGE', 'BLACK', 'WHITE', 'PINK', 'BROWN', 'GRAY', 'GOLD', 'SILVER', 'BRONZE', 'MAROON', 'NAVY', 'TEAL', 'TURQUOISE', 'INDIGO', 'VIOLET', 'COLOR', 'HUE', 'SHADE', 'TINT', 'TONE']),
    
    // Emotions
    emotion: new Set(['HAPPY', 'SAD', 'ANGRY', 'SCARED', 'EXCITED', 'WORRIED', 'CALM', 'NERVOUS', 'ANXIOUS', 'DEPRESSED', 'JOYFUL', 'PEACEFUL', 'FRUSTRATED', 'CONFUSED', 'SURPRISED', 'DISGUSTED', 'EMBARRASSED']),
    
    // Professions
    profession: new Set(['DOCTOR', 'TEACHER', 'LAWYER', 'ENGINEER', 'ARTIST', 'MUSICIAN', 'SCIENTIST', 'WRITER', 'ACTOR', 'DIRECTOR', 'CHEF', 'FARMER', 'DRIVER', 'PILOT', 'SOLDIER', 'POLICE', 'FIREFIGHTER']),
    
    // Places
    place: new Set(['CITY', 'TOWN', 'VILLAGE', 'COUNTRY', 'STATE', 'PROVINCE', 'REGION', 'CONTINENT', 'ISLAND', 'PENINSULA', 'BAY', 'GULF', 'STRAIT', 'CHANNEL', 'HARBOR', 'PORT', 'AIRPORT', 'STATION', 'TERMINAL', 'PARK', 'GARDEN', 'PLAYGROUND', 'FIELD', 'GROUND', 'AREA', 'ZONE', 'SPACE', 'PLACE', 'LOCATION', 'SITE', 'SPOT', 'POINT', 'CORNER', 'EDGE', 'SIDE', 'END', 'START', 'MIDDLE', 'CENTER']),
    
    // Education
    education: new Set(['SCHOOL', 'COLLEGE', 'UNIVERSITY', 'CLASS', 'COURSE', 'LESSON', 'LECTURE', 'SEMINAR', 'WORKSHOP', 'TRAINING', 'STUDY', 'LEARN', 'TEACH', 'EDUCATE', 'GRADUATE', 'DEGREE', 'DIPLOMA', 'CERTIFICATE']),
    
    // Communication
    communication: new Set(['LETTER', 'EMAIL', 'MESSAGE', 'TEXT', 'CALL', 'PHONE', 'VOICE', 'SPEAK', 'TALK', 'CHAT', 'CONVERSATION', 'DISCUSSION', 'MEETING', 'CONFERENCE', 'PRESENTATION', 'BROADCAST', 'TRANSMISSION']),
    
    // Money and finance
    finance: new Set(['MONEY', 'CASH', 'COIN', 'BANK', 'ACCOUNT', 'CREDIT', 'DEBIT', 'LOAN', 'MORTGAGE', 'INVESTMENT', 'STOCK', 'BOND', 'SHARE', 'DIVIDEND', 'INTEREST', 'TAX', 'INSURANCE', 'PENSION']),
    
    // Health and medicine
    health: new Set(['HEALTH', 'MEDICAL', 'DOCTOR', 'NURSE', 'PATIENT', 'HOSPITAL', 'CLINIC', 'PHARMACY', 'MEDICINE', 'DRUG', 'VACCINE', 'TREATMENT', 'THERAPY', 'SURGERY', 'RECOVERY', 'WELLNESS', 'FITNESS']),
    
    // Entertainment
    entertainment: new Set(['MOVIE', 'FILM', 'THEATER', 'CINEMA', 'SHOW', 'PLAY', 'MUSICAL', 'CONCERT', 'PERFORMANCE', 'GAME', 'SPORT', 'COMPETITION', 'FESTIVAL', 'CELEBRATION', 'PARTY', 'EVENT', 'EXHIBITION', 'ADVENTURE', 'PARK', 'PLAYGROUND', 'CARNIVAL', 'FAIR', 'CIRCUS', 'ZOO', 'AQUARIUM', 'MUSEUM', 'GALLERY', 'STUDIO', 'STAGE', 'ARENA', 'STADIUM']),
    
    // Science
    science: new Set(['SCIENCE', 'RESEARCH', 'EXPERIMENT', 'LABORATORY', 'OBSERVATION', 'THEORY', 'HYPOTHESIS', 'ANALYSIS', 'DATA', 'RESULT', 'DISCOVERY', 'INVENTION', 'INNOVATION', 'TECHNOLOGY', 'ENGINEERING', 'MATHEMATICS']),
    
    // Scientific instruments and devices
    instrument: new Set(['ACCELERATOR', 'ACCELEROMETER', 'THERMOMETER', 'BAROMETER', 'HYGROMETER', 'ANEMOMETER', 'SPECTROMETER', 'MICROSCOPE', 'TELESCOPE', 'OSCILLOSCOPE', 'VOLTMETER', 'AMMETER', 'OHMMETER', 'MULTIMETER', 'CALORIMETER', 'CHROMATOGRAPH', 'ELECTROMETER', 'GALVANOMETER', 'MANOMETER', 'PHOTOMETER', 'RADAR', 'SONAR', 'SEISMOMETER', 'GRAVIMETER', 'MAGNETOMETER', 'GYROSCOPE', 'COMPASS', 'PROTRACTOR', 'MICROMETER', 'CALIPER']),
    
    // Government
    government: new Set(['GOVERNMENT', 'POLITICS', 'POLICY', 'LAW', 'REGULATION', 'ADMINISTRATION', 'DEPARTMENT', 'AGENCY', 'COMMITTEE', 'COUNCIL', 'PARLIAMENT', 'CONGRESS', 'SENATE', 'ELECTION', 'VOTE', 'CITIZEN']),
    
    // Military
    military: new Set(['MILITARY', 'ARMY', 'NAVY', 'AIRFORCE', 'SOLDIER', 'OFFICER', 'COMMANDER', 'GENERAL', 'ADMIRAL', 'COLONEL', 'CAPTAIN', 'LIEUTENANT', 'SERGEANT', 'TROOP', 'BATTALION', 'REGIMENT', 'DIVISION']),
    
    // Religion
    religion: new Set(['RELIGION', 'FAITH', 'BELIEF', 'GOD', 'CHURCH', 'TEMPLE', 'MOSQUE', 'SYNAGOGUE', 'PRAYER', 'WORSHIP', 'SACRED', 'HOLY', 'DIVINE', 'SPIRITUAL', 'RELIGIOUS', 'THEOLOGICAL', 'MYSTICAL']),
    
    // Recreation and leisure
    recreation: new Set(['PARK', 'PLAYGROUND', 'GARDEN', 'POOL', 'BEACH', 'LAKE', 'RIVER', 'MOUNTAIN', 'TRAIL', 'PATH', 'FIELD', 'COURT', 'PITCH', 'GROUND', 'SPACE', 'AREA', 'ZONE', 'SITE', 'LOCATION', 'PLACE', 'SPOT', 'VENUE']),
    
    // Compound words
    compound: new Set(['ADVENTURE', 'PLAYGROUND', 'PARK', 'GARDEN', 'HOUSE', 'ROOM', 'PLACE', 'SPACE', 'TIME', 'WORK', 'LIFE', 'WORLD', 'LIGHT', 'SIDE', 'WAY', 'LINE', 'POINT', 'LEVEL', 'FORM', 'TYPE', 'STYLE', 'MODE', 'STATE', 'PHASE', 'STAGE', 'STEP', 'PART', 'PIECE', 'UNIT', 'ITEM', 'THING', 'OBJECT', 'ELEMENT', 'FACTOR', 'ASPECT', 'FEATURE', 'TRAIT', 'QUALITY', 'NATURE', 'CHARACTER', 'PERSON', 'PLACE', 'THING', 'BLACK', 'WHITE', 'RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'ORANGE', 'PINK', 'BROWN', 'GRAY']),
    
    // Activities and actions
    activity: new Set(['PLAY', 'GAME', 'SPORT', 'EXERCISE', 'WORK', 'STUDY', 'LEARN', 'TEACH', 'READ', 'WRITE', 'DRAW', 'PAINT', 'SING', 'DANCE', 'ACT', 'PERFORM', 'PRACTICE', 'TRAIN', 'COMPETE', 'RACE', 'RUN', 'JUMP', 'SWIM', 'CLIMB', 'WALK', 'RIDE', 'DRIVE', 'FLY', 'SAIL', 'TRAVEL', 'EXPLORE', 'ADVENTURE', 'DISCOVER', 'CREATE', 'BUILD', 'MAKE', 'DO']),
    
    // States and conditions
    state: new Set(['STATE', 'CONDITION', 'SITUATION', 'CIRCUMSTANCE', 'POSITION', 'PLACE', 'LEVEL', 'STAGE', 'PHASE', 'STEP', 'POINT', 'MOMENT', 'TIME', 'PERIOD', 'ERA', 'AGE', 'FORM', 'TYPE', 'KIND', 'SORT', 'NATURE', 'CHARACTER', 'QUALITY', 'TRAIT', 'FEATURE', 'ASPECT', 'FACTOR', 'ELEMENT', 'PART', 'PIECE', 'UNIT', 'ITEM', 'THING', 'OBJECT']),
    
    // Movement and motion
    movement: new Set(['MOVE', 'MOTION', 'MOVEMENT', 'FLOW', 'STREAM', 'CURRENT', 'DRIFT', 'FLOW', 'FLUX', 'FLOW', 'STREAM', 'CURRENT', 'DRIFT', 'FLOW', 'FLUX', 'FLOW', 'STREAM', 'CURRENT', 'DRIFT', 'FLOW', 'FLUX', 'FLOW', 'STREAM', 'CURRENT', 'DRIFT', 'FLOW', 'FLUX', 'FLOW', 'STREAM', 'CURRENT', 'DRIFT', 'FLOW', 'FLUX']),
    
    // Size and dimension
    size: new Set(['SIZE', 'DIMENSION', 'LENGTH', 'WIDTH', 'HEIGHT', 'DEPTH', 'THICKNESS', 'WEIGHT', 'MASS', 'VOLUME', 'AREA', 'SPACE', 'EXTENT', 'RANGE', 'SCOPE', 'SCALE', 'PROPORTION', 'RATIO', 'AMOUNT', 'QUANTITY', 'NUMBER', 'COUNT', 'TOTAL', 'SUM', 'AVERAGE', 'MEDIAN', 'MODE', 'RANGE', 'SPREAD', 'DISTRIBUTION']),
    
    // Quality and characteristic
    quality: new Set(['QUALITY', 'CHARACTERISTIC', 'TRAIT', 'FEATURE', 'ASPECT', 'FACTOR', 'ELEMENT', 'PART', 'PIECE', 'UNIT', 'ITEM', 'THING', 'OBJECT', 'NATURE', 'CHARACTER', 'TYPE', 'KIND', 'SORT', 'FORM', 'STYLE', 'MODE', 'WAY', 'MANNER', 'METHOD', 'APPROACH', 'TECHNIQUE', 'PROCESS', 'PROCEDURE', 'SYSTEM', 'STRUCTURE', 'PATTERN', 'DESIGN', 'PLAN', 'SCHEME', 'STRATEGY', 'TACTIC']),
    
    // Fruits and berries
    fruit: new Set(['APPLE', 'BANANA', 'ORANGE', 'LEMON', 'LIME', 'GRAPE', 'PEACH', 'PLUM', 'CHERRY', 'BERRY', 'BLACKBERRY', 'RASPBERRY', 'STRAWBERRY', 'BLUEBERRY', 'CRANBERRY', 'GOOSEBERRY', 'ELDERBERRY', 'MELON', 'WATERMELON', 'CANTALOUPE', 'HONEYDEW', 'PINEAPPLE', 'MANGO', 'PAPAYA', 'KIWI', 'FIG', 'DATE', 'PRUNE', 'RAISIN', 'CURRANT', 'FRUIT']),
    
    // Birds
    bird: new Set(['BIRD', 'EAGLE', 'HAWK', 'FALCON', 'OWL', 'VULTURE', 'BLACKBIRD', 'ROBIN', 'SPARROW', 'FINCH', 'CARDINAL', 'BLUEBIRD', 'THRUSH', 'WREN', 'WARBLER', 'SWALLOW', 'SWIFT', 'MARTIN', 'LARK', 'NIGHTINGALE', 'CUCKOO', 'WOODPECKER', 'DOVE', 'PIGEON', 'PARROT', 'MACAW', 'COCKATOO', 'BUDGIE', 'CANARY', 'CHICKEN', 'TURKEY', 'DUCK', 'GOOSE', 'SWAN', 'PELICAN', 'STORK', 'HERON', 'CRANE', 'FLAMINGO', 'PENGUIN', 'OSTRICH', 'EMU', 'KIWI']),
};

// Function to get word category
function getWordCategory(word) {
    const upperWord = word.toUpperCase();
    
    // Check each category
    for (const [category, words] of Object.entries(wordCategories)) {
        // Check if the word starts with any of the category words
        for (const categoryWord of words) {
            if (upperWord.startsWith(categoryWord)) {
                return category;
            }
        }
    }
    
    return null; // No category found
}

// Function to check if words are in the same family
function areWordsInSameFamily(word1, word2) {
    // Get the first 5 characters of each word
    const prefix1 = word1.slice(0, 5).toLowerCase();
    const prefix2 = word2.slice(0, 5).toLowerCase();
    
    // Words must share the first 5 characters exactly
    if (prefix1 !== prefix2) {
        return false;
    }
    
    // Get categories for both words
    const category1 = getWordCategory(word1);
    const category2 = getWordCategory(word2);
    
    // If either word is in a specific category (fruit, bird, etc.), they must match exactly
    const specificCategories = ['fruit', 'bird', 'animal', 'plant', 'music', 'material'];
    if (specificCategories.includes(category1) || specificCategories.includes(category2)) {
        return category1 === category2;
    }
    
    // For compound words, check if they share the same base word
    const baseWords = {
        'apple': ['pie', 'mac', 'sauce', 'juice', 'cider'],
        'black': ['berry', 'bird', 'board', 'smith', 'mail'],
        'blue': ['berry', 'bird', 'print', 'jeans'],
        'red': ['berry', 'bird', 'wood', 'wine'],
        'white': ['board', 'wash', 'wine', 'fish'],
        'green': ['house', 'wood', 'tea', 'bean'],
        'yellow': ['stone', 'wood', 'cake'],
        'brown': ['stone', 'sugar', 'rice'],
        'gray': ['stone', 'matter', 'area'],
        'pink': ['slip', 'eye', 'lady'],
        'purple': ['heart', 'haze', 'rain'],
        'orange': ['juice', 'peel', 'tree'],
        'gold': ['fish', 'mine', 'rush'],
        'silver': ['fish', 'mine', 'ware'],
        'bronze': ['age', 'medal', 'statue']
    };
    
    // Check if both words are compound words with the same base
    for (const [base, suffixes] of Object.entries(baseWords)) {
        if (word1.toLowerCase().startsWith(base) && word2.toLowerCase().startsWith(base)) {
            // Check if both words end with one of the known suffixes
            const suffix1 = word1.toLowerCase().slice(base.length);
            const suffix2 = word2.toLowerCase().slice(base.length);
            if (suffixes.includes(suffix1) && suffixes.includes(suffix2)) {
                return true;
            }
        }
    }
    
    // If no specific category match and no compound word match, use the original category check
    return category1 !== null && category1 === category2;
}

// Function to group similar words
function groupSimilarWords(words) {
    const groups = new Map(); // Maps representative word to its group
    const processedWords = new Set();
    
    // Sort words by length (shorter first) and then alphabetically
    const sortedWords = [...words].sort((a, b) => {
        if (a.length === b.length) {
            return a.localeCompare(b);
        }
        return a.length - b.length;
    });
    
    // First pass: identify word families
    for (let i = 0; i < sortedWords.length; i++) {
        const word = sortedWords[i];
        
        // Skip if already processed
        if (processedWords.has(word)) continue;
        
        // Start a new group with this word
        const group = [word];
        processedWords.add(word);
        
        // Look for related words
        for (let j = i + 1; j < sortedWords.length; j++) {
            const otherWord = sortedWords[j];
            
            // Skip if already processed
            if (processedWords.has(otherWord)) continue;
            
            // Check if words are in the same family
            if (areWordsInSameFamily(word, otherWord)) {
                group.push(otherWord);
                processedWords.add(otherWord);
            }
        }
        
        // Only create a group if we found related words
        if (group.length > 1) {
            // Sort the group by length and then alphabetically
            group.sort((a, b) => {
                if (a.length === b.length) {
                    return a.localeCompare(b);
                }
                return a.length - b.length;
            });
            
            // Use the shortest word as the representative
            const representative = group[0];
            groups.set(representative, group);
        }
    }
    
    return {
        representativeWords: groups,
        displayWords: Array.from(groups.keys())
    };
}

// Function to create and show overlay
function showWordGroupOverlay(words) {
    // Create overlay container
    const overlay = document.createElement('div');
    overlay.className = 'word-group-overlay';
    
    // Create content container
    const content = document.createElement('div');
    content.className = 'word-group-content';
    
    // Add words to content
    words.forEach(word => {
        const wordElement = document.createElement('div');
        wordElement.className = 'word-group-item';
        wordElement.textContent = word;
        content.appendChild(wordElement);
    });
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'word-group-close';
    closeButton.textContent = '×';
    closeButton.onclick = () => {
        document.body.removeChild(overlay);
    };
    
    // Assemble overlay
    content.appendChild(closeButton);
    overlay.appendChild(content);
    
    // Add click handler to close when clicking outside content
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    };
    
    // Add to document
    document.body.appendChild(overlay);
}

// Handle workflow creation
document.getElementById('createWorkflowButton').addEventListener('click', () => {
    document.getElementById('homepage').style.display = 'none';
    document.getElementById('workflowCreation').style.display = 'block';
});

// Function to save workflow
function saveWorkflow() {
    const workflowNameInput = document.getElementById('workflowName');
    const workflowName = workflowNameInput ? workflowNameInput.value.trim() : '';
    const selectedFeatures = Array.from(document.querySelectorAll('#selectedFeaturesList .selected-feature-item'))
        .map(item => item.dataset.feature);
    
    // Validate workflow name
    if (!workflowName) {
        alert('Please enter a workflow name');
        if (workflowNameInput) {
            workflowNameInput.focus();
        }
        return;
    }
    
    // Validate selected features
    if (selectedFeatures.length === 0) {
        alert('Please select at least one feature');
        return;
    }
    
    // Check if workflow name already exists
    if (workflows.some(w => w.name === workflowName)) {
        alert('A workflow with this name already exists. Please choose a different name.');
        if (workflowNameInput) {
            workflowNameInput.focus();
        }
        return;
    }

    try {
        // Create new workflow
        const newWorkflow = {
            name: workflowName,
            steps: selectedFeatures.map(feature => ({ feature }))
        };
        
        // Add to workflows array
        workflows.push(newWorkflow);
        
        // Save to localStorage
        localStorage.setItem('workflows', JSON.stringify(workflows));
        
        // Update workflow select
        const workflowSelect = document.getElementById('workflowSelect');
        if (workflowSelect) {
            const option = document.createElement('option');
            option.value = newWorkflow.name;
            option.textContent = newWorkflow.name;
            workflowSelect.appendChild(option);
        }
        
        // Clear form
        if (workflowNameInput) {
            workflowNameInput.value = '';
        }
        document.getElementById('selectedFeaturesList').innerHTML = '';
        
        // Reinitialize dropdowns
        initializeDropdowns();
        
        // Show success message and return to homepage
        alert('Workflow saved successfully!');
        hideWorkflowCreation();
        
    } catch (error) {
        console.error('Error saving workflow:', error);
        alert('There was an error saving the workflow. Please try again.');
    }
}

// Handle cancel workflow creation
document.getElementById('cancelWorkflowButton').addEventListener('click', () => {
    document.getElementById('workflowCreation').style.display = 'none';
    document.getElementById('homepage').style.display = 'block';
    
    // Clear form
    document.getElementById('workflowName').value = '';
    document.querySelectorAll('.feature-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
});

// Handle workflow selection change
workflowSelect.addEventListener('change', function() {
    if (this.value === 'create-new') {
        showWorkflowCreation();
    }
});

// Add touch event handling for workflow selection
workflowSelect.addEventListener('touchstart', function(e) {
    e.preventDefault();
    // Trigger the native select dropdown
    this.click();
}, { passive: false });

// Add touch event handling for workflow options
workflowSelect.addEventListener('touchend', function(e) {
    e.preventDefault();
    const selectedOption = this.options[this.selectedIndex];
    if (selectedOption && selectedOption.value === 'create-new') {
        showWorkflowCreation();
    }
}, { passive: false });

// Function to load word list
async function loadWordList() {
    try {
        const startTime = performance.now();
        console.log('=== WORDLIST LOADING START ===');
        
        // Show loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loadingIndicator';
        loadingIndicator.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 10px; 
                        z-index: 10000; text-align: center;">
                <div>Loading wordlist...</div>
                <div id="loadingProgress" style="margin-top: 10px; font-size: 12px;">Initializing...</div>
            </div>
        `;
        document.body.appendChild(loadingIndicator);
        
        const updateProgress = (message) => {
            const progressElement = document.getElementById('loadingProgress');
            if (progressElement) {
                progressElement.textContent = message;
            }
            console.log('Progress:', message);
        };
        
        const wordlistSelect = document.getElementById('wordlistSelect');
        const selectedWordlist = wordlistSelect.value;
        console.log('Selected wordlist value:', selectedWordlist);
        let wordlistPath;
        let gzippedPath;
        
        switch(selectedWordlist) {
            case '19127':
                wordlistPath = 'words/19127.txt';
                gzippedPath = 'words/19127.txt.gz';
                break;
            case 'emotions':
                wordlistPath = 'words/EmotionsJobsSpiritAnimals.txt';
                gzippedPath = 'words/EmotionsJobsSpiritAnimals.txt.gz';
                break;
            case '134k':
                wordlistPath = 'words/134K.txt';
                gzippedPath = 'words/134K.txt.gz';
                break;
            case 'boysnames':
                wordlistPath = 'words/BoysNames.txt';
                gzippedPath = 'words/BoysNames.txt.gz';
                break;
            case 'girlsnames':
                wordlistPath = 'words/GirlsNames.txt';
                gzippedPath = 'words/GirlsNames.txt.gz';
                break;
            case 'allnames':
                wordlistPath = 'words/AllNames.txt';
                gzippedPath = 'words/AllNames.txt.gz';
                break;
            case 'colouritems':
                wordlistPath = 'words/ColourItems.txt';
                gzippedPath = 'words/ColourItems.txt.gz';
                break;
            case 'enuk':
            default:
                wordlistPath = 'words/ENUK-Long words Noun.txt';
                gzippedPath = 'words/ENUK-Long words Noun.txt.gz';
                break;
            case 'months_starsigns':
                wordlistPath = 'words/MONTHS_STARSIGNS.txt';
                break;
        }
        console.log('Selected wordlist path:', wordlistPath);
        console.log('Gzipped path:', gzippedPath);
        
        let response;
        let text;
        let usedGzip = false;
        
        // Try gzipped file first for better performance
        try {
            updateProgress('Loading compressed file...');
            console.log('Attempting to load gzipped file...');
            const fetchStart = performance.now();
            response = await fetch(gzippedPath);
            const fetchTime = performance.now() - fetchStart;
            console.log(`Fetch time: ${fetchTime.toFixed(2)}ms`);
            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));
            
            if (response.ok) {
                updateProgress('Decompressing file...');
                const decompressStart = performance.now();
                const arrayBuffer = await response.arrayBuffer();
                const bufferTime = performance.now() - decompressStart;
                console.log(`ArrayBuffer time: ${bufferTime.toFixed(2)}ms`);
                console.log('ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');
                
                // Decompress using pako (if available) or fallback to text
                if (typeof pako !== 'undefined') {
                    console.log('Pako library available, decompressing...');
                    const pakoStart = performance.now();
                    const decompressed = pako.inflate(new Uint8Array(arrayBuffer), { to: 'string' });
                    const pakoTime = performance.now() - pakoStart;
                    console.log(`Pako decompression time: ${pakoTime.toFixed(2)}ms`);
                    console.log('Decompressed size:', decompressed.length, 'characters');
                    text = decompressed;
                    usedGzip = true;
                    console.log('✅ Successfully loaded and decompressed gzipped file');
                } else {
                    console.log('❌ Pako not available, falling back to uncompressed');
                    throw new Error('Pako not available, falling back to uncompressed');
                }
            } else {
                console.log('❌ Gzipped file not found, falling back to uncompressed');
                throw new Error('Gzipped file not found, falling back to uncompressed');
            }
        } catch (gzipError) {
            console.log('❌ Gzipped file failed, loading uncompressed file:', gzipError.message);
            updateProgress('Loading uncompressed file...');
            response = await fetch(wordlistPath);
            if (!response.ok) {
                throw new Error('Failed to load wordlist');
            }
            text = await response.text();
            usedGzip = false;
        }
        
        console.log('Text loaded, length:', text.length);
        console.log('Used gzip:', usedGzip);
        updateProgress('Processing wordlist...');
        
        // Optimize the word processing
        const processStart = performance.now();
        
        // Use more efficient string processing
        const lines = text.split('\n');
        console.log(`Split into ${lines.length} lines`);
        
        // Use Set for faster filtering and deduplication
        const wordSet = new Set();
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (trimmed) {
                wordSet.add(trimmed);
            }
        }
        
        wordList = Array.from(wordSet);
        const processTime = performance.now() - processStart;
        console.log(`Processing time: ${processTime.toFixed(2)}ms`);
        console.log('Filtered words count:', wordList.length);
        
        currentFilteredWords = [...wordList];
        currentWordlistForVowels = [...wordList];
        
        const totalTime = performance.now() - startTime;
        console.log(`Total loading time: ${totalTime.toFixed(2)}ms`);
        console.log('Wordlist loaded successfully:', wordList.length, 'words');
        console.log('=== WORDLIST LOADING END ===');
        
        // Remove loading indicator
        if (loadingIndicator.parentNode) {
            loadingIndicator.parentNode.removeChild(loadingIndicator);
        }
        
        return wordList;
    } catch (error) {
        console.error('Error loading wordlist:', error);
        // Remove loading indicator on error
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator && loadingIndicator.parentNode) {
            loadingIndicator.parentNode.removeChild(loadingIndicator);
        }
        throw error;
    }
}

// Add lazy loading flag
let wordListLoaded = false;
let lastLoadedWordlist = '';

// Function to execute workflow
async function executeWorkflow(steps) {
    try {
        // Get the currently selected wordlist
        const wordlistSelect = document.getElementById('wordlistSelect');
        const selectedWordlist = wordlistSelect.value;
        console.log('Selected wordlist:', selectedWordlist);
        
        // Check if we need to load a new wordlist
        const needsReload = !wordListLoaded || 
                           wordList.length === 0 || 
                           lastLoadedWordlist !== selectedWordlist;
        
        if (needsReload) {
            await loadWordList();
            wordListLoaded = true;
            lastLoadedWordlist = selectedWordlist;
        }
        console.log('Wordlist loaded, word count:', wordList.length);
        
        // Reset workflow state at the beginning of each workflow
        resetWorkflowState();
        console.log('Workflow state reset');
        
        // Reset all feature states
        currentFilteredWords = [...wordList]; // Start with the full wordlist
        lexiconCompleted = false;
        originalLexCompleted = false;
        eeeCompleted = false;
        hasAdjacentConsonants = null;
        hasO = null;
        selectedCurvedLetter = null;
        currentVowelIndex = 0;
        uniqueVowels = [];
        currentFilteredWordsForVowels = [];
        currentPosition1Word = '';
        leastFrequentLetter = null;  // Reset least frequent letter state
        
        // Reset used letters at the start of a new workflow
        usedLettersInWorkflow = [];
        
        // Reset T9 state at the beginning of each workflow
        t9StringsMap.clear();
        t9StringsCalculated = false;
        t9OneLieBlankIndex = null;
        t9OneLiePossibleDigits = [];
        t9OneLieSelectedDigits = [];
        
        console.log('Starting workflow with steps:', steps);
        console.log('Using wordlist:', selectedWordlist);
        console.log('Current word count:', currentFilteredWords.length);
        
        // Hide homepage and show workflow execution
        const homepage = document.getElementById('homepage');
        const workflowExecution = document.getElementById('workflowExecution');
        
        if (homepage) {
            homepage.style.display = 'none';
        }
        
        if (workflowExecution) {
            workflowExecution.style.display = 'flex';
            workflowExecution.style.flexDirection = 'column';
            workflowExecution.style.height = '100dvh';
        }

        // Add home button if it doesn't exist
        let homeButton = document.getElementById('homeButton');
        if (!homeButton) {
            homeButton = document.createElement('button');
            homeButton.id = 'homeButton';
            homeButton.className = 'home-button';
            homeButton.innerHTML = '⌂';
            homeButton.title = 'Return to Home';
            
            // Function to handle home button action
            const handleHomeAction = () => {
                // Hide workflow execution
                if (workflowExecution) {
                    workflowExecution.style.display = 'none';
                }
                // Show homepage
                if (homepage) {
                    homepage.style.display = 'block';
                }
                // Remove reset button if it exists
                const resetButton = document.getElementById('resetWorkflowButton');
                if (resetButton) {
                    resetButton.remove();
                }
                // Remove home button
                homeButton.remove();
            };
            
            // Add both click and touch events
            homeButton.addEventListener('click', handleHomeAction);
            homeButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                handleHomeAction();
            }, { passive: false });
            
            // Insert home button next to the header
            const header = document.querySelector('.header');
            if (header) {
                header.insertBefore(homeButton, header.firstChild);
            }
        }

        // Add reset button if it doesn't exist
        let resetButton = document.getElementById('resetWorkflowButton');
        if (!resetButton) {
            resetButton = document.createElement('button');
            resetButton.id = 'resetWorkflowButton';
            resetButton.className = 'reset-workflow-button';
            resetButton.innerHTML = '↺';
            resetButton.title = 'Reset Workflow';
            
            // Function to handle reset action
            const handleResetAction = () => {
                if (currentWorkflow) {
                    executeWorkflow(currentWorkflow.steps);
                }
            };
            
            // Add both click and touch events
            resetButton.addEventListener('click', handleResetAction);
            resetButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                handleResetAction();
            }, { passive: false });
            
            document.body.appendChild(resetButton);
        }
        
        // Store current workflow for reset functionality
        currentWorkflow = { steps };
        
        // Create feature elements if they don't exist
        const featureElements = {
            position1Feature: createPosition1Feature(),
            vowelFeature: createVowelFeature(),
            oFeature: createOFeature(),
            lexiconFeature: createLexiconFeature(),
            eeeFeature: createEeeFeature(),
            eeeFirstFeature: createEeeFirstFeature(),
            originalLexFeature: createOriginalLexFeature(),
            consonantQuestion: createConsonantQuestion(),
            colour3Feature: createColour3Feature(),
            shapeFeature: createShapeFeature(),
            curvedFeature: createCurvedFeature(),
            lengthFeature: createLengthFeature(),
            mostFrequentFeature: createMostFrequentFeature(),
            leastFrequentFeature: createLeastFrequentFeature(),
            notInFeature: createNotInFeature(),
            abcde: createAbcdeFeature(),
            abc: createAbcFeature(),
            findEee: createFindEeeFeature(),
            positionConsFeature: createPositionConsFeature(),
            firstCurvedFeature: createFirstCurvedFeature(),
            pinFeature: createPinFeature(),
        };
        
        // Add all feature elements to the document body
        Object.values(featureElements).forEach(element => {
            if (element) {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                document.body.appendChild(element);
                element.style.display = 'none';
                element.classList.remove('completed');
            }
        });
        
        // Get or create the feature area and results container
        let featureArea = document.getElementById('featureArea');
        let resultsContainer = document.getElementById('results');
        
        if (!resultsContainer) {
            resultsContainer = document.createElement('div');
            resultsContainer.id = 'results';
            resultsContainer.className = 'results-container';
            workflowExecution.appendChild(resultsContainer);
        }
        
        if (!featureArea) {
            featureArea = document.createElement('div');
            featureArea.id = 'featureArea';
            featureArea.className = 'feature-area';
            workflowExecution.appendChild(featureArea);
        }
        
        // Set up the layout - 50/50 split
        // Top half: results container (wordlist)
        resultsContainer.style.flex = '0 0 50%';
        resultsContainer.style.minHeight = '0';
        resultsContainer.style.overflowY = 'auto';
        resultsContainer.style.padding = '20px';
        resultsContainer.style.backgroundColor = '#fff';
        resultsContainer.style.borderBottom = '1px solid #ddd';
        
        // Bottom half: feature area
        featureArea.style.flex = '0 0 50%';
        featureArea.style.minHeight = '0';
        featureArea.style.overflowY = 'auto';
        featureArea.style.padding = '20px';
        featureArea.style.backgroundColor = '#f5f5f5';
        
        // Clear any existing content
        featureArea.innerHTML = '';
        resultsContainer.innerHTML = '';
        
        // Display initial wordlist
        displayResults(currentFilteredWords);
        
        // Track the rank of MOST FREQUENT features
        let mostFrequentRank = 1;
        
        // Execute each step in sequence
        for (const step of steps) {
            console.log('Executing step:', step);
            
            let featureId = step.feature + 'Feature';
            if (step.feature === 'consonant') {
                featureId = 'consonantQuestion';
            }
            
            // Always create a fresh feature element for each step
            let featureElement;
            switch (step.feature) {
                case 'mostFrequent':
                    featureElement = createMostFrequentFeature();
                    break;
                case 'leastFrequent':
                    featureElement = createLeastFrequentFeature();
                    break;
                case 'length':
                    featureElement = createLengthFeature();
                    break;
                case 'notIn':
                    featureElement = createNotInFeature();
                    break;
                case 'position1':
                    featureElement = createPosition1Feature();
                    break;
                case 'consMid':
                    featureElement = createConsMidFeature();
                    break;
                case 'consMid2':
                    featureElement = createConsMid2Feature();
                    break;
                case 'vowel':
                    featureElement = createVowelFeature();
                    break;
                case 'vowel2':
                    featureElement = createVowel2Feature();
                    break;
                case 'vowelPos':
                    featureElement = createVowelPosFeature();
                    break;
                case 'name':
                    featureElement = createNameFeature();
                    break;
                case 'o':
                    featureElement = createOFeature();
                    break;
                case 'lexicon':
                    featureElement = createLexiconFeature();
                    break;
                case 'eee':
                    featureElement = createEeeFeature();
                    break;
                case 'eeeFirst':
                    featureElement = createEeeFirstFeature();
                    break;
                case 'originalLex':
                    featureElement = createOriginalLexFeature();
                    break;
                case 'consonant':
                    featureElement = createConsonantQuestion();
                    break;
                case 'colour3':
                    featureElement = createColour3Feature();
                    break;
                case 'shape':
                    featureElement = createShapeFeature();
                    break;
                case 'curved':
                    featureElement = createCurvedFeature();
                    break;
                case 'abcde':
                    featureElement = createAbcdeFeature();
                    break;
                case 'abc':
                    featureElement = createAbcFeature();
                    break;
                case 'findEee':
                    featureElement = createFindEeeFeature();
                    break;
                case 'positionCons':
                    featureElement = createPositionConsFeature();
                    break;
                case 'firstCurved':
                    featureElement = createFirstCurvedFeature();
                    break;
                case 'pin':
                    featureElement = createPinFeature();
                    break;
                case 'pianoForte':
                    featureElement = createPianoForteFeature();
                    break;
                case 'pianoPiano':
                    featureElement = createPianoPianoFeature();
                    break;
                case 't9Length':
                    featureElement = createT9LengthFeature();
                    break;
                case 't9LastTwo':
                    featureElement = createT9LastTwoFeature();
                    break;
                case 't9OneLie':
                    featureElement = createT9OneLieFeature();
                    break;
                case 't9Repeat':
                    featureElement = createT9RepeatFeature();
                    break;
                case 't9Higher':
                    featureElement = createT9HigherFeature();
                    break;
                case 't9OneTruth':
                    featureElement = createT9OneTruthFeature();
                    break;
                case 't9B':
                    featureElement = createT9BFeature();
                    break;
                case 'alphaNumeric':
                    featureElement = createAlphaNumericFeature();
                    break;
                case 'lettersAbove':
                    featureElement = createLettersAboveFeature();
                    break;
                case 'dictionaryAlpha':
                    featureElement = createDictionaryAlphaFeature();
                    break;
                case 'smlLength':
                    featureElement = createSmlLengthFeature();
                    break;
                default:
                    featureElement = null;
            }
            if (!featureElement) {
                console.log('No feature element created for:', step.feature);
                continue;
            }
            console.log('Created feature element for:', step.feature, featureElement);
            featureArea.innerHTML = '';
            featureArea.appendChild(featureElement);
            featureElement.style.display = 'block';
            console.log('Feature element display set to block');
            
            // For MOST FREQUENT feature, use the current rank
            if (step.feature === 'mostFrequent') {
                mostFrequentLetter = findMostFrequentLetter(currentFilteredWords, mostFrequentRank);
                if (mostFrequentLetter) {
                    const letterDisplay = featureElement.querySelector('.letter');
                    if (letterDisplay) {
                        letterDisplay.textContent = mostFrequentLetter;
                    }
                }
            }
            // For LEAST FREQUENT feature
            else if (step.feature === 'leastFrequent') {
                leastFrequentLetter = findLeastFrequentLetter(currentFilteredWords);
                if (leastFrequentLetter) {
                    const letterDisplay = featureElement.querySelector('.letter');
                    if (letterDisplay) {
                        letterDisplay.textContent = leastFrequentLetter;
                    }
                }
            }
            
            // Set up event listeners for this feature
            setupFeatureListeners(step.feature, (filteredWords) => {
                currentFilteredWords = filteredWords;
                displayResults(currentFilteredWords);
            });
            
            // Wait for user interaction
            await new Promise((resolve) => {
                const handleFeatureComplete = () => {
                    console.log(`Feature ${featureId} completed`);
                    featureElement.classList.add('completed');
                    featureElement.style.display = 'none';
                    
                    // If this was the MOST FREQUENT feature and YES was selected, increment the rank
                    if (step.feature === 'mostFrequent' && mostFrequentLetter) {
                        usedLettersInWorkflow.push(mostFrequentLetter);
                        mostFrequentRank++;
                    }
                    
                    resolve();
                };
                
                featureElement.addEventListener('completed', handleFeatureComplete, { once: true });
            });
        }
        
        // Show final results
        displayResults(currentFilteredWords);
    } catch (error) {
        console.error('Error executing workflow:', error);
        throw error;
    }
}

// Export button helpers
function initializeExportButton() {
    if (exportButton) {
        return;
    }
    
    exportButton = document.createElement('button');
    exportButton.id = 'exportButton';
    exportButton.className = 'home-button export-button';
    exportButton.innerHTML = '💾';
    exportButton.title = 'Export filtered wordlist as .txt file';
    
    const triggerExport = () => {
        if (!latestExportWords || latestExportWords.length === 0) {
            alert('No words to export!');
            return;
        }

        const defaultName = `filtered_wordlist_${new Date().toISOString().slice(0, 10)}.txt`;
        let userFileName = prompt('Enter a name for your export (.txt):', defaultName);

        if (userFileName === null) {
            return; // User cancelled
        }

        userFileName = userFileName.trim();
        if (!userFileName) {
            userFileName = defaultName;
        }
        if (!userFileName.toLowerCase().endsWith('.txt')) {
            userFileName += '.txt';
        }

        exportWordlist(latestExportWords, userFileName);
    };
    
    exportButton.addEventListener('click', triggerExport);
    exportButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        triggerExport();
    }, { passive: false });
    
    document.body.appendChild(exportButton);
    updateExportButtonState([]);
}

function updateExportButtonState(words = latestExportWords) {
    latestExportWords = Array.isArray(words) ? [...words] : [];
    
    if (!exportButton) {
        return;
    }
    
    const hasWords = latestExportWords.length > 0;
    exportButton.disabled = !hasWords;
    exportButton.classList.toggle('export-button--disabled', !hasWords);
}

// Function to export wordlist as .txt file
function exportWordlist(words, fileName) {
    if (!words || words.length === 0) {
        alert('No words to export!');
        return;
    }
    
    // Create the content for the .txt file
    const content = words.join('\n');
    
    // Create a blob with the content
    const blob = new Blob([content], { type: 'text/plain' });
    
    // Create a download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeFilename(fileName) || `filtered_wordlist_${new Date().toISOString().slice(0, 10)}.txt`;
    
    // Trigger the download
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function sanitizeFilename(name) {
    if (!name) return '';
    return name.replace(/[<>:"/\\|?*]+/g, '_').slice(0, 200);
}

// Helper functions to create feature elements
function createPosition1Feature() {
    const div = document.createElement('div');
    div.id = 'position1Feature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">SHORT WORD</h2>
        <div class="position-input">
            <input type="text" id="position1Input" placeholder="Enter a word">
            <button id="position1Button">SUBMIT</button>
            <button id="position1DoneButton">DONE</button>
        </div>
    `;
    return div;
}

function createConsMidFeature() {
    const div = document.createElement('div');
    div.id = 'consMidFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">3 LETTER WORD</h2>
        <div class="position-input">
            <input type="text" id="consMidInput" placeholder="Enter a word">
            <button id="consMidButton">SUBMIT</button>
            <button id="consMidDoneButton">DONE</button>
        </div>
    `;
    return div;
}

function createConsMid2Feature() {
    const div = document.createElement('div');
    div.id = 'consMid2Feature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">CONS MID</h2>
        <div class="position-input">
            <input type="text" id="consMid2Input" placeholder="Enter a word">
            <button id="consMid2Button">SUBMIT</button>
            <button id="consMid2DoneButton">DONE</button>
        </div>
    `;
    return div;
}

function createVowelFeature() {
    const div = document.createElement('div');
    div.id = 'vowelFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">VOWEL</h2>
        <div class="vowel-letter"></div>
        <div class="button-container">
            <button class="vowel-btn yes-btn">YES</button>
            <button class="vowel-btn no-btn">NO</button>
        </div>
        <div class="position-buttons">
            <button class="position-btn" data-position="1">1</button>
            <button class="position-btn" data-position="2">2</button>
            <button class="position-btn" data-position="3">3</button>
            <button class="position-btn" data-position="4">4</button>
            <button class="position-btn" data-position="5">5</button>
            <button class="position-btn" data-position="6">6</button>
            <button class="position-btn" data-position="7">7</button>
            <button class="position-btn" data-position="8">8</button>
        </div>
    `;
    return div;
}

function createVowel2Feature() {
    const div = document.createElement('div');
    div.id = 'vowel2Feature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">VOWEL2</h2>
        <div class="vowel-letter"></div>
        <div class="button-container">
            <button class="vowel-btn yes-btn">YES</button>
            <button class="vowel-btn no-btn">NO</button>
        </div>
        <div class="section-buttons">
            <button class="section-btn" data-section="start">START</button>
            <button class="section-btn" data-section="middle">MIDDLE</button>
            <button class="section-btn" data-section="end">END</button>
        </div>
    `;
    return div;
}

function createVowelPosFeature() {
    console.log('Creating VOWEL POS feature element');
    const div = document.createElement('div');
    div.id = 'vowelPosFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">VOWEL POS</h2>
        <div class="vowel-letter"></div>
        <div class="button-container">
            <button class="vowel-btn yes-btn">YES</button>
            <button class="vowel-btn no-btn">NO</button>
        </div>
        <div class="section-buttons">
            <button class="section-btn" data-section="begin">BEGIN</button>
            <button class="section-btn" data-section="mid">MID</button>
            <button class="section-btn" data-section="end">END</button>
        </div>
    `;
    console.log('VOWEL POS feature element created:', div);
    return div;
}

function createNameFeature() {
    const div = document.createElement('div');
    div.id = 'nameFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">NAME</h2>
        <div class="name-input-container" style="margin: 20px 0;">
            <input type="text" id="nameInput" placeholder="Enter full name (e.g., John Smith)" style="padding: 10px; width: 100%; max-width: 300px; font-size: 16px;">
        </div>
        <div class="vowel-buttons" style="display: flex; justify-content: center; gap: 10px; margin: 20px 0; flex-wrap: wrap;">
            <button class="vowel-btn" data-vowel="a">A</button>
            <button class="vowel-btn" data-vowel="e">E</button>
            <button class="vowel-btn" data-vowel="i">I</button>
            <button class="vowel-btn" data-vowel="o">O</button>
            <button class="vowel-btn" data-vowel="u">U</button>
        </div>
        <div class="section-buttons" style="display: flex; justify-content: center; gap: 10px; margin: 20px 0;">
            <button class="section-btn" data-section="start">START</button>
            <button class="section-btn" data-section="middle">MID</button>
            <button class="section-btn" data-section="end">END</button>
        </div>
        <div style="display: flex; justify-content: center; margin-top: 20px;">
            <button id="nameSubmitButton" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">SUBMIT</button>
            <button id="nameNoVowelButton" style="padding: 10px 20px; background: #ff9800; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; margin-left: 10px;">NO VOWEL</button>
            <button id="nameSkipButton" class="skip-button" style="margin-left: 10px;">SKIP</button>
        </div>
    `;
    return div;
}

function createOFeature() {
    const div = document.createElement('div');
    div.id = 'oFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">O?</h2>
        <div class="button-container">
            <button id="oYesBtn" class="yes-btn">YES</button>
            <button id="oNoBtn" class="no-btn">NO</button>
            <button id="oSkipBtn" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

function createLexiconFeature() {
    const div = document.createElement('div');
    div.id = 'lexiconFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">LEXICON</h2>
        <div class="lexicon-input">
            <input type="text" id="lexiconInput" placeholder="Enter positions (e.g., 123)">
            <button id="lexiconButton">SUBMIT</button>
            <button id="lexiconSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

function createEeeFeature() {
    const div = document.createElement('div');
    div.id = 'eeeFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">EEE?</h2>
        <div class="button-container">
            <button id="eeeButton">E</button>
            <button id="eeeYesBtn" class="yes-btn">YES</button>
            <button id="eeeNoBtn" class="no-btn">NO</button>
        </div>
    `;
    return div;
}

function createEeeFirstFeature() {
    const div = document.createElement('div');
    div.id = 'eeeFirstFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">EEEFIRST</h2>
        <div class="button-container">
            <button id="eeeFirstButton">E</button>
            <button id="eeeFirstYesBtn" class="yes-btn">YES</button>
            <button id="eeeFirstNoBtn" class="no-btn">NO</button>
        </div>
        <button id="eeeFirstSkipButton" class="skip-button">SKIP</button>
    `;
    return div;
}

function createOriginalLexFeature() {
    const div = document.createElement('div');
    div.id = 'originalLexFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">LEXICON</h2>
        <div class="position-info">
            <div class="position-display">Position: <span class="position-number">1</span></div>
            <div class="possible-letters">Possible letters: <span class="letters-list"></span></div>
        </div>
        <div class="lexicon-input">
            <input type="text" id="originalLexInput" placeholder="Enter a word">
            <button id="originalLexButton">SUBMIT</button>
            <button id="originalLexSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

function createConsonantQuestion() {
    const div = document.createElement('div');
    div.id = 'consonantQuestion';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">CONSONANTS TOGETHER?</h2>
        <div class="button-container">
            <button id="consonantYesBtn" class="yes-btn">YES</button>
            <button id="consonantNoBtn" class="no-btn">NO</button>
        </div>
    `;
    return div;
}

function createColour3Feature() {
    const div = document.createElement('div');
    div.id = 'colour3Feature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">COLOUR3</h2>
        <div class="button-container">
            <button id="colour3YesBtn" class="yes-btn">YES</button>
            <button id="colour3SkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

function createShapeFeature() {
    const div = document.createElement('div');
    div.id = 'shapeFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">SHAPE</h2>
        <div class="shape-display">
            <div class="position-display"></div>
            <div class="category-buttons"></div>
        </div>
    `;
    return div;
}

function createCurvedFeature() {
    const div = document.createElement('div');
    div.id = 'curvedFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">CURVED</h2>
        <div class="curved-buttons">
            <button class="curved-btn">B</button>
            <button class="curved-btn">C</button>
            <button class="curved-btn">D</button>
            <button class="curved-btn">G</button>
            <button class="curved-btn">J</button>
            <button class="curved-btn">O</button>
            <button class="curved-btn">P</button>
            <button class="curved-btn">Q</button>
            <button class="curved-btn">R</button>
            <button class="curved-btn">S</button>
            <button class="curved-btn">U</button>
        </div>
        <button id="curvedSkipBtn" class="skip-button">SKIP</button>
    `;
    return div;
}

function createLengthFeature() {
    const div = document.createElement('div');
    div.id = 'lengthFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">LENGTH</h2>
        <div class="length-input">
            <input type="text" id="lengthInput" placeholder="Enter length (3+)" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
            <button id="lengthButton">SUBMIT</button>
            <button id="lengthSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

function createMostFrequentFeature() {
    const div = document.createElement('div');
    div.id = 'mostFrequentFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">MOST FREQUENT</h2>
        <div class="frequent-letter-display">
            <div class="letter">-</div>
        </div>
        <div class="button-container">
            <button id="frequentYesBtn" class="yes-btn">YES</button>
            <button id="frequentNoBtn" class="no-btn">NO</button>
            <button id="frequentSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

function createLeastFrequentFeature() {
    const div = document.createElement('div');
    div.id = 'leastFrequentFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">LEAST FREQUENT</h2>
        <div class="frequent-letter-display">
            <div class="letter">-</div>
        </div>
        <div class="button-container">
            <button id="leastFrequentYesBtn" class="yes-btn">YES</button>
            <button id="leastFrequentNoBtn" class="no-btn">NO</button>
            <button id="leastFrequentSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

function createNotInFeature() {
    const div = document.createElement('div');
    div.id = 'notInFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">NOT IN</h2>
        <div class="input-group">
            <input type="text" id="notInInput" placeholder="Enter letters...">
            <button id="notInButton">SUBMIT</button>
            <button id="notInSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

// --- ABCDE Feature Logic ---
function createAbcdeFeature() {
    const div = document.createElement('div');
    div.id = 'abcdeFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">ABCDE</h2>
        <div class="abcde-row" style="display: flex; justify-content: center; gap: 10px;">
            <button class="abcde-btn" data-letter="A">A</button>
            <button class="abcde-btn" data-letter="B">B</button>
            <button class="abcde-btn" data-letter="C">C</button>
            <button class="abcde-btn" data-letter="D">D</button>
            <button class="abcde-btn" data-letter="E">E</button>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 20px; gap: 10px;">
            <button id="abcdeDoneButton">DONE</button>
            <button id="abcdeNoneButton" class="none-button">NONE</button>
            <button id="abcdeSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

// --- ABC Feature Logic ---
function createAbcFeature() {
    const div = document.createElement('div');
    div.id = 'abcFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">ABC</h2>
        <div class="abc-row" style="display: flex; justify-content: center; gap: 10px;">
            <button class="abc-btn" data-letter="A">A</button>
            <button class="abc-btn" data-letter="B">B</button>
            <button class="abc-btn" data-letter="C">C</button>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 20px; gap: 10px;">
            <button id="abcDoneButton">DONE</button>
            <button id="abcNoneButton" class="none-button">NONE</button>
            <button id="abcSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

// --- PIANO FORTE Feature Logic ---
function createPianoForteFeature() {
    const div = document.createElement('div');
    div.id = 'pianoForteFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">PIANO FORTE</h2>
        <div class="piano-forte-row" style="display: flex; justify-content: center; gap: 10px;">
            <button class="piano-forte-btn" data-letter="A">A</button>
            <button class="piano-forte-btn" data-letter="B">B</button>
            <button class="piano-forte-btn" data-letter="C">C</button>
            <button class="piano-forte-btn" data-letter="D">D</button>
            <button class="piano-forte-btn" data-letter="E">E</button>
            <button class="piano-forte-btn" data-letter="F">F</button>
            <button class="piano-forte-btn" data-letter="G">G</button>
        </div>
        <div id="pianoForteStringDisplay" style="display: flex; justify-content: center; align-items: center; min-height: 50px; margin-top: 20px; padding: 10px; font-size: 24px; font-weight: bold; color: #1B5E20; letter-spacing: 8px;">
            <span id="pianoForteString">-</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 20px; gap: 10px;">
            <button id="pianoForteSubmitButton">SUBMIT</button>
            <button id="pianoForteNoneButton" class="none-button">NONE</button>
            <button id="pianoForteSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

// --- PIANO PIANO Feature Logic ---
function createPianoPianoFeature() {
    const div = document.createElement('div');
    div.id = 'pianoPianoFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">PIANO PIANO</h2>
        <div class="piano-piano-row" style="display: flex; justify-content: center; gap: 10px;">
            <button class="piano-piano-btn" data-count="1">1</button>
            <button class="piano-piano-btn" data-count="2">2</button>
            <button class="piano-piano-btn" data-count="3">3</button>
            <button class="piano-piano-btn" data-count="4">4</button>
            <button class="piano-piano-btn" data-count="5">5</button>
            <button class="piano-piano-btn" data-count="6">6</button>
            <button class="piano-piano-btn" data-count="7">7</button>
        </div>
        <div id="pianoPianoDisplay" style="display: flex; justify-content: center; align-items: center; min-height: 50px; margin-top: 20px; padding: 10px; font-size: 24px; font-weight: bold; color: #1B5E20;">
            <span id="pianoPianoString">-</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 20px; gap: 10px;">
            <button id="pianoPianoSubmitButton">SUBMIT</button>
            <button id="pianoPianoNoneButton" class="none-button">NONE</button>
            <button id="pianoPianoSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

// --- T9 LENGTH Feature Logic ---
function createT9LengthFeature() {
    const div = document.createElement('div');
    div.id = 't9LengthFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">LENGTH</h2>
        <div class="length-input">
            <input type="text" id="t9LengthInput" placeholder="Enter length (3+)" inputmode="numeric" pattern="[0-9]*" autocomplete="off" min="3">
            <button id="t9LengthButton">SUBMIT</button>
            <button id="t9LengthSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

// --- T9 LAST TWO Feature Logic ---
function createT9LastTwoFeature() {
    const div = document.createElement('div');
    div.id = 't9LastTwoFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">LAST TWO</h2>
        <div class="t9-last-two-row" style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
            <button class="t9-last-two-btn" data-digit="2">2</button>
            <button class="t9-last-two-btn" data-digit="3">3</button>
            <button class="t9-last-two-btn" data-digit="4">4</button>
            <button class="t9-last-two-btn" data-digit="5">5</button>
            <button class="t9-last-two-btn" data-digit="6">6</button>
            <button class="t9-last-two-btn" data-digit="7">7</button>
            <button class="t9-last-two-btn" data-digit="8">8</button>
            <button class="t9-last-two-btn" data-digit="9">9</button>
        </div>
        <div id="t9LastTwoDisplay" style="display: flex; justify-content: center; align-items: center; min-height: 50px; margin-top: 20px; padding: 10px; font-size: 24px; font-weight: bold; color: #1B5E20;">
            <span id="t9LastTwoString">-</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 20px; gap: 10px;">
            <button id="t9LastTwoSubmitButton">SUBMIT</button>
            <button id="t9LastTwoResetButton" class="reset-button">RESET</button>
            <button id="t9LastTwoSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

// --- T9 1 LIE (4) Feature Logic ---
function createT9OneLieFeature() {
    const div = document.createElement('div');
    div.id = 't9OneLieFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">1 LIE (L4)</h2>
        <div class="t9-one-lie-row" style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
            <button class="t9-one-lie-btn" data-digit="2">2</button>
            <button class="t9-one-lie-btn" data-digit="3">3</button>
            <button class="t9-one-lie-btn" data-digit="4">4</button>
            <button class="t9-one-lie-btn" data-digit="5">5</button>
            <button class="t9-one-lie-btn" data-digit="6">6</button>
            <button class="t9-one-lie-btn" data-digit="7">7</button>
            <button class="t9-one-lie-btn" data-digit="8">8</button>
            <button class="t9-one-lie-btn" data-digit="9">9</button>
            <button class="t9-one-lie-btn blank-btn" data-digit="BLANK" style="background-color: #f44336; color: white; font-weight: bold;">B</button>
        </div>
        <div id="t9OneLieDisplay" style="display: flex; justify-content: center; align-items: center; min-height: 50px; margin-top: 20px; padding: 10px; font-size: 24px; font-weight: bold; color: #1B5E20;">
            <span id="t9OneLieString">-</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 20px; gap: 10px;">
            <button id="t9OneLieSubmitButton">SUBMIT</button>
            <button id="t9OneLieResetButton" class="reset-button">RESET</button>
            <button id="t9OneLieSkipButton" class="skip-button">SKIP</button>
            <div id="t9OneLiePossibleDigits" style="margin-top: 15px; padding: 10px; font-size: 14px; color: #666; text-align: center; min-height: 20px;">
                <span style="font-weight: bold;">Possible T9 digits for BLANK:</span> <span id="t9OneLiePossibleDigitsList">-</span>
            </div>
        </div>
    `;
    return div;
}

// --- T9 REPEAT Feature Logic ---
function createT9RepeatFeature() {
    const div = document.createElement('div');
    div.id = 't9RepeatFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">Repeat?</h2>
        <p style="text-align: center; margin: 20px 0; font-size: 18px; font-weight: bold;">Repeated Digits?</p>
        <div class="button-container">
            <button id="t9RepeatYesBtn" class="yes-btn">YES</button>
            <button id="t9RepeatNoBtn" class="no-btn">NO</button>
            <button id="t9RepeatSkipBtn" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

// --- T9 HIGHER Feature Logic ---
function createT9HigherFeature() {
    const div = document.createElement('div');
    div.id = 't9HigherFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">Higher?</h2>
        <p style="text-align: center; margin: 20px 0; font-size: 18px; font-weight: bold;">Second digit higher than first?</p>
        <div class="button-container">
            <button id="t9HigherYesBtn" class="yes-btn">YES</button>
            <button id="t9HigherNoBtn" class="no-btn">NO</button>
            <button id="t9HigherSameBtn" class="yes-btn" style="background-color: #ff9800;">SAME</button>
            <button id="t9HigherSkipBtn" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

// --- T9 1 TRUTH (F4) Feature Logic ---
function createT9OneTruthFeature() {
    const div = document.createElement('div');
    div.id = 't9OneTruthFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">1 TRUTH (F4)</h2>
        <div class="t9-one-truth-row" style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
            <button class="t9-one-truth-btn" data-digit="2">2</button>
            <button class="t9-one-truth-btn" data-digit="3">3</button>
            <button class="t9-one-truth-btn" data-digit="4">4</button>
            <button class="t9-one-truth-btn" data-digit="5">5</button>
            <button class="t9-one-truth-btn" data-digit="6">6</button>
            <button class="t9-one-truth-btn" data-digit="7">7</button>
            <button class="t9-one-truth-btn" data-digit="8">8</button>
            <button class="t9-one-truth-btn" data-digit="9">9</button>
            <button class="t9-one-truth-btn blank-btn" data-digit="BLANK" style="background-color: #f44336; color: white; font-weight: bold;">B</button>
        </div>
        <div id="t9OneTruthDisplay" style="display: flex; justify-content: center; align-items: center; min-height: 50px; margin-top: 20px; padding: 10px; font-size: 24px; font-weight: bold; color: #1B5E20;">
            <span id="t9OneTruthString">-</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 20px; gap: 10px;">
            <button id="t9OneTruthSubmitButton">SUBMIT</button>
            <button id="t9OneTruthResetButton" class="reset-button">RESET</button>
            <button id="t9OneTruthSkipButton" class="skip-button">SKIP</button>
            <div id="t9OneTruthPossibleDigits" style="margin-top: 15px; padding: 10px; font-size: 14px; color: #666; text-align: center; min-height: 20px;">
                <span style="font-weight: bold;">Possible T9 digits for BLANK:</span> <span id="t9OneTruthPossibleDigitsList">-</span>
            </div>
        </div>
    `;
    return div;
}

// --- T9 B Feature Logic ---
function createT9BFeature() {
    const div = document.createElement('div');
    div.id = 't9BFeature';
    div.className = 'feature-section';
    
    // Get possible digits from stored data
    const possibleDigits = t9OneLiePossibleDigits.length > 0 ? t9OneLiePossibleDigits : [];
    
    div.innerHTML = `
        <h2 class="feature-title">B-IDENTITY</h2>
        <p style="text-align: center; margin: 20px 0; font-size: 16px; color: #666;">
            Select the T9 digit for the BLANK position from 1 LIE (L4)
        </p>
        <div class="t9-b-row" style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
            ${possibleDigits.map(digit => 
                `<button class="t9-b-btn" data-digit="${digit}" style="padding: 15px 25px; font-size: 18px; font-weight: bold; background-color: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; min-width: 60px;">${digit}</button>`
            ).join('')}
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 20px; gap: 10px;">
            <button id="t9BSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

// --- AlphaNumeric Feature Logic ---
function createAlphaNumericFeature() {
    const div = document.createElement('div');
    div.id = 'alphaNumericFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">AlphaNumeric</h2>
        <div class="button-container">
            <button id="alphaNumericYesBtn" class="yes-btn">YES</button>
            <button id="alphaNumericNoBtn" class="no-btn">NO</button>
            <button id="alphaNumericSkipBtn" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

// --- Letters Above Feature Logic ---
function createLettersAboveFeature() {
    const div = document.createElement('div');
    div.id = 'lettersAboveFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">Letters Above</h2>
        <div class="length-input">
            <input type="text" id="lettersAboveInput" placeholder="Enter number (0-26)" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
            <button id="lettersAboveButton">SUBMIT</button>
            <button id="lettersAboveSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

// --- Dictionary (Alpha) Feature Logic ---
function createDictionaryAlphaFeature() {
    const div = document.createElement('div');
    div.id = 'dictionaryAlphaFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">Dictionary (Alpha)</h2>
        <div class="section-buttons">
            <button class="section-btn" data-section="begin">Beginning</button>
            <button class="section-btn" data-section="mid">Middle</button>
            <button class="section-btn" data-section="end">End</button>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 20px; gap: 10px;">
            <button id="dictionaryAlphaSubmitButton">SUBMIT</button>
            <button id="dictionaryAlphaSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

// --- S/M/L (Length) Feature Logic ---
function createSmlLengthFeature() {
    const div = document.createElement('div');
    div.id = 'smlLengthFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">S/M/L (Length)</h2>
        <div class="section-buttons">
            <button class="section-btn" data-section="small">Small</button>
            <button class="section-btn" data-section="medium">Medium</button>
            <button class="section-btn" data-section="long">Long</button>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 20px; gap: 10px;">
            <button id="smlLengthSubmitButton">SUBMIT</button>
            <button id="smlLengthSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

// --- FIND-EEE Feature Logic ---
function createFindEeeFeature() {
    const div = document.createElement('div');
    div.id = 'findEeeFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <h2 class="feature-title">FIND-EEE</h2>
        <div class="find-eee-row" style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
            <button class="find-eee-btn" data-letter="B">B</button>
            <button class="find-eee-btn" data-letter="C">C</button>
            <button class="find-eee-btn" data-letter="D">D</button>
            <button class="find-eee-btn" data-letter="E">E</button>
            <button class="find-eee-btn" data-letter="G">G</button>
            <button class="find-eee-btn" data-letter="P">P</button>
            <button class="find-eee-btn" data-letter="T">T</button>
            <button class="find-eee-btn" data-letter="V">V</button>
            <button class="find-eee-btn" data-letter="Z">Z</button>
        </div>
        <div class="find-eee-position-row" style="display: flex; justify-content: center; gap: 10px; margin-top: 15px;">
            <button class="find-eee-position-btn" data-position="1">1</button>
            <button class="find-eee-position-btn" data-position="2">2</button>
            <button class="find-eee-position-btn" data-position="3">3</button>
            <button class="find-eee-position-btn" data-position="4">4</button>
            <button class="find-eee-position-btn" data-position="5">5</button>
            <button class="find-eee-position-btn" data-position="6">6</button>
            <button class="find-eee-position-btn" data-position="7">7</button>
            <button class="find-eee-position-btn" data-position="8">8</button>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 20px; gap: 10px;">
            <button id="findEeeSkipButton" class="skip-button">SKIP</button>
        </div>
    `;
    return div;
}

function createPositionConsFeature() {
    const div = document.createElement('div');
    div.id = 'positionConsFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <div class="feature-title">POSITION-CONS</div>
        <div class="position-cons-form">
            <div class="position-cons-main-layout">
                <div class="position-cons-left">
                    <div class="position-cons-input-group">
                        <label for="positionConsPosition">Position (1-6)</label>
                        <input type="number" id="positionConsPosition" min="1" max="6" placeholder="1-6">
                    </div>
                    <div class="position-cons-input-group">
                        <label for="positionConsLetters">Letters</label>
                        <input type="text" id="positionConsLetters" placeholder="Enter letters...">
                    </div>
                    <div class="position-cons-input-group">
                        <label for="positionConsCount">Letter count (total)</label>
                        <input type="number" id="positionConsCount" min="0" placeholder="0+">
                    </div>
                </div>
                <div class="position-cons-right">
                    <button id="positionConsGenerate" class="secondary-btn">Random Letters</button>
                    <button id="positionConsSubmit" class="primary-btn">FILTER</button>
                </div>
            </div>
            <div id="positionConsMessage" class="position-cons-message"></div>
        </div>
    `;
    return div;
}

function createFirstCurvedFeature() {
    const div = document.createElement('div');
    div.id = 'firstCurvedFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <div class="feature-title">FIRST CURVED</div>
        <div class="position-cons-form">
            <div class="position-input">
                <label for="firstCurvedPosition">Position of first curved letter</label>
                <input type="number" id="firstCurvedPosition" min="1" placeholder="Enter position...">
            </div>
            <button id="firstCurvedSubmit" class="primary-btn">SUBMIT</button>
            <div id="firstCurvedMessage" class="position-cons-message"></div>
        </div>
    `;
    return div;
}

function createPinFeature() {
    const div = document.createElement('div');
    div.id = 'pinFeature';
    div.className = 'feature-section';
    div.innerHTML = `
        <div class="feature-title">PIN</div>
        <div class="position-cons-form">
            <div class="pin-inputs-grid">
                <input type="text" id="pinWord1" class="pin-word-input" placeholder="Word 1">
                <input type="text" id="pinWord4" class="pin-word-input" placeholder="Word 4">
                <input type="text" id="pinWord2" class="pin-word-input" placeholder="Word 2">
                <input type="text" id="pinWord5" class="pin-word-input" placeholder="Word 5">
                <input type="text" id="pinWord3" class="pin-word-input" placeholder="Word 3">
                <input type="text" id="pinWord6" class="pin-word-input" placeholder="Word 6">
                <input type="text" id="pinCode" class="pin-code-input" placeholder="CODE" maxlength="6">
                <button id="pinSubmit" class="primary-btn pin-submit-btn">SUBMIT</button>
            </div>
            <div id="pinMessage" class="position-cons-message"></div>
        </div>
    `;
    return div;
}

// Filtering logic for ABCDE feature
function filterWordsByAbcde(words, yesLetters) {
    return words.filter(word => {
        const wordUpper = word.toUpperCase();
        // Convert yesLetters to uppercase for consistent comparison
        const yesLettersUpper = yesLetters.map(letter => letter.toUpperCase());
        // Must include all YES letters
        for (const letter of yesLettersUpper) {
            if (!wordUpper.includes(letter)) return false;
        }
        // Must NOT include any of the other letters (A-E not in yesLetters)
        for (const letter of ['A','B','C','D','E']) {
            if (!yesLettersUpper.includes(letter) && wordUpper.includes(letter)) return false;
        }
        return true;
    });
}

// Filtering logic for ABC feature
function filterWordsByAbc(words, yesLetters) {
    return words.filter(word => {
        const wordUpper = word.toUpperCase();
        // Convert yesLetters to uppercase for consistent comparison
        const yesLettersUpper = yesLetters.map(letter => letter.toUpperCase());
        // Must include all YES letters
        for (const letter of yesLettersUpper) {
            if (!wordUpper.includes(letter)) return false;
        }
        // Must NOT include any of the other letters (A-C not in yesLetters)
        for (const letter of ['A','B','C']) {
            if (!yesLettersUpper.includes(letter) && wordUpper.includes(letter)) return false;
        }
        return true;
    });
}

// Filtering logic for PIANO FORTE feature (chronological order)
function filterWordsByPianoForte(words, letterSequence) {
    return words.filter(word => {
        const wordUpper = word.toUpperCase();
        const sequence = letterSequence.map(letter => letter.toUpperCase());
        
        // Get unique letters that were pressed
        const pressedLetters = new Set(sequence);
        
        // Get letters that were NOT pressed (A-G not in sequence)
        const unpressedLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].filter(
            letter => !pressedLetters.has(letter)
        );
        
        // Check that unpressed letters are NOT in the word
        for (const letter of unpressedLetters) {
            if (wordUpper.includes(letter)) return false;
        }
        
        // Extract only A-G letters from the word, maintaining their order
        const wordPressedSequence = wordUpper.split('').filter(char => 
            ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(char)
        );
        
        // Check if the extracted sequence matches the pressed sequence exactly
        if (wordPressedSequence.length !== sequence.length) {
            return false;
        }
        
        // Check each letter matches in order
        for (let i = 0; i < sequence.length; i++) {
            if (wordPressedSequence[i] !== sequence[i]) {
                return false;
            }
        }
        
        return true;
    });
}

// Filtering logic for PIANO PIANO feature
function filterWordsByPianoPiano(words, count) {
    return words.filter(word => {
        const wordUpper = word.toUpperCase();
        
        // Extract only A-G letters from the word
        const agLetters = wordUpper.split('').filter(char => 
            ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(char)
        );
        
        // Check if the count matches exactly
        return agLetters.length === count;
    });
}

// Filtering logic for T9 LENGTH feature
function filterWordsByT9Length(words, length) {
    // Calculate T9 strings if not already done
    calculateT9Strings(words);
    
    return words.filter(word => {
        const t9String = t9StringsMap.get(word) || wordToT9(word);
        return t9String.length === length;
    });
}

// Filtering logic for T9 LAST TWO feature
function filterWordsByT9LastTwo(words, lastTwo) {
    // Calculate T9 strings if not already done
    calculateT9Strings(words);
    
    return words.filter(word => {
        const t9String = t9StringsMap.get(word) || wordToT9(word);
        // Check if T9 string ends with the last two digits
        return t9String.length >= 2 && t9String.slice(-2) === lastTwo;
    });
}

// Filtering logic for T9 REPEAT feature
function filterWordsByT9Repeat(words, hasRepeat) {
    // Calculate T9 strings if not already done
    calculateT9Strings(words);
    
    return words.filter(word => {
        const t9String = t9StringsMap.get(word) || wordToT9(word);
        
        // Check for consecutive repeated digits
        for (let i = 0; i < t9String.length - 1; i++) {
            if (t9String[i] === t9String[i + 1]) {
                return hasRepeat; // Found a repeat
            }
        }
        
        return !hasRepeat; // No repeats found
    });
}

// Filtering logic for T9 HIGHER feature
function filterWordsByT9Higher(words, option) {
    // Calculate T9 strings if not already done
    calculateT9Strings(words);
    
    return words.filter(word => {
        const t9String = t9StringsMap.get(word) || wordToT9(word);
        
        // Must have at least 2 digits
        if (t9String.length < 2) return false;
        
        const firstDigit = parseInt(t9String[0]);
        const secondDigit = parseInt(t9String[1]);
        
        if (option === 'yes') {
            return secondDigit > firstDigit;
        } else if (option === 'no') {
            return secondDigit < firstDigit;
        } else if (option === 'same') {
            return secondDigit === firstDigit;
        }
        
        return false;
    });
}

// Filtering logic for T9 1 TRUTH (F4) feature
function filterWordsByT9OneTruth(words, selectedDigits) {
    // Calculate T9 strings if not already done
    calculateT9Strings(words);
    
    // Check if BLANK is used (marking a specific position as the truth)
    const blankIndex = selectedDigits.indexOf('BLANK');
    const hasBlank = blankIndex !== -1;
    
    return words.filter(word => {
        const t9String = t9StringsMap.get(word) || wordToT9(word);
        
        // Must have at least 4 digits
        if (t9String.length < 4) return false;
        
        const firstFour = t9String.slice(0, 4);
        const firstFourDigits = firstFour.split('');
        
        if (hasBlank) {
            // BLANK is specified - only check that specific position as the truth
            // All other positions must be incorrect (NOT match)
            
            // Check that all non-BLANK positions do NOT match (they are incorrect)
            for (let i = 0; i < 4; i++) {
                if (i !== blankIndex && selectedDigits[i] !== 'BLANK') {
                    if (firstFourDigits[i] === selectedDigits[i]) {
                        return false; // This position should be wrong but it matches
                    }
                }
            }
            
            // The BLANK position is correct (we don't check what it is, just that others are wrong)
            return true; // All conditions met
        } else {
            // No BLANK - check all 4 scenarios where exactly one digit is correct
            // Convert selectedDigits array to string for backward compatibility
            const digits = Array.isArray(selectedDigits) ? selectedDigits : selectedDigits.split('');
            
            // Scenario 1: First digit correct, others wrong
            if (firstFourDigits[0] === digits[0] && 
                firstFourDigits[1] !== digits[1] && 
                firstFourDigits[2] !== digits[2] && 
                firstFourDigits[3] !== digits[3]) {
                return true;
            }
            
            // Scenario 2: Second digit correct, others wrong
            if (firstFourDigits[0] !== digits[0] && 
                firstFourDigits[1] === digits[1] && 
                firstFourDigits[2] !== digits[2] && 
                firstFourDigits[3] !== digits[3]) {
                return true;
            }
            
            // Scenario 3: Third digit correct, others wrong
            if (firstFourDigits[0] !== digits[0] && 
                firstFourDigits[1] !== digits[1] && 
                firstFourDigits[2] === digits[2] && 
                firstFourDigits[3] !== digits[3]) {
                return true;
            }
            
            // Scenario 4: Fourth digit correct, others wrong
            if (firstFourDigits[0] !== digits[0] && 
                firstFourDigits[1] !== digits[1] && 
                firstFourDigits[2] !== digits[2] && 
                firstFourDigits[3] === digits[3]) {
                return true;
            }
        }
        
        return false;
    });
}

// Helper function to calculate possible T9 digits for BLANK position
function calculatePossibleT9DigitsForBlank(words, selectedDigits) {
    // Check if BLANK is used
    const blankIndex = selectedDigits.indexOf('BLANK');
    if (blankIndex === -1 || selectedDigits.length !== 4) {
        return [];
    }
    
    // Calculate T9 strings if not already done
    calculateT9Strings(words);
    
    const possibleDigits = new Set();
    
    words.forEach(word => {
        const t9String = t9StringsMap.get(word) || wordToT9(word);
        
        // Must have at least 4 digits
        if (t9String.length < 4) return;
        
        const lastFour = t9String.slice(-4);
        const lastFourDigits = lastFour.split('');
        
        // Check if this word matches the pattern (non-BLANK positions must match)
        let matches = true;
        for (let i = 0; i < 4; i++) {
            if (i !== blankIndex && selectedDigits[i] !== 'BLANK') {
                if (lastFourDigits[i] !== selectedDigits[i]) {
                    matches = false;
                    break;
                }
            }
        }
        
        if (matches) {
            // This word matches the pattern, add its T9 digit at the BLANK position
            possibleDigits.add(lastFourDigits[blankIndex]);
        }
    });
    
    return Array.from(possibleDigits).sort();
}

// Helper function to calculate possible T9 digits for BLANK position in 1 TRUTH (F4)
function calculatePossibleT9DigitsForBlankTruth(words, selectedDigits) {
    // Check if BLANK is used
    const blankIndex = selectedDigits.indexOf('BLANK');
    if (blankIndex === -1 || selectedDigits.length !== 4) {
        return [];
    }
    
    // Calculate T9 strings if not already done
    calculateT9Strings(words);
    
    const possibleDigits = new Set();
    
    words.forEach(word => {
        const t9String = t9StringsMap.get(word) || wordToT9(word);
        
        // Must have at least 4 digits
        if (t9String.length < 4) return;
        
        const firstFour = t9String.slice(0, 4);
        const firstFourDigits = firstFour.split('');
        
        // Check if this word matches the pattern:
        // BLANK position is correct (we collect all possible values),
        // other positions must NOT match (they are incorrect)
        let matches = true;
        for (let i = 0; i < 4; i++) {
            if (i === blankIndex) {
                // BLANK position - this will be collected, continue
                continue;
            } else if (selectedDigits[i] !== 'BLANK') {
                // Non-BLANK positions must NOT match (they are incorrect)
                if (firstFourDigits[i] === selectedDigits[i]) {
                    matches = false;
                    break;
                }
            }
        }
        
        if (matches) {
            // This word matches the pattern (BLANK position is correct, others are wrong)
            // Add its T9 digit at the BLANK position
            possibleDigits.add(firstFourDigits[blankIndex]);
        }
    });
    
    return Array.from(possibleDigits).sort();
}

// Filtering logic for T9 B feature
function filterWordsByT9B(words, selectedDigit) {
    // Calculate T9 strings if not already done
    calculateT9Strings(words);
    
    // Must have stored data from 1 LIE (L4)
    if (t9OneLieBlankIndex === null || t9OneLieSelectedDigits.length !== 4) {
        return words; // Return unfiltered if no data
    }
    
    return words.filter(word => {
        const t9String = t9StringsMap.get(word) || wordToT9(word);
        
        // Must have at least 4 digits
        if (t9String.length < 4) return false;
        
        const lastFour = t9String.slice(-4);
        const lastFourDigits = lastFour.split('');
        
        // Check that all non-BLANK positions match
        for (let i = 0; i < 4; i++) {
            if (i !== t9OneLieBlankIndex && t9OneLieSelectedDigits[i] !== 'BLANK') {
                if (lastFourDigits[i] !== t9OneLieSelectedDigits[i]) {
                    return false; // This position must match and doesn't
                }
            }
        }
        
        // The BLANK position must match the selected digit
        return lastFourDigits[t9OneLieBlankIndex] === selectedDigit;
    });
}

// Filtering logic for T9 1 LIE (4) feature
function filterWordsByT9OneLie(words, selectedDigits) {
    // Calculate T9 strings if not already done
    calculateT9Strings(words);
    
    // Check if BLANK is used (marking a specific position as the lie)
    const blankIndex = selectedDigits.indexOf('BLANK');
    const hasBlank = blankIndex !== -1;
    
    return words.filter(word => {
        const t9String = t9StringsMap.get(word) || wordToT9(word);
        
        // Must have at least 4 digits
        if (t9String.length < 4) return false;
        
        const lastFour = t9String.slice(-4);
        const lastFourDigits = lastFour.split('');
        
        if (hasBlank) {
            // BLANK is specified - only check that specific position as the lie
            // All other positions must be correct
            
            // Check that all non-BLANK positions match
            for (let i = 0; i < 4; i++) {
                if (i !== blankIndex && selectedDigits[i] !== 'BLANK') {
                    if (lastFourDigits[i] !== selectedDigits[i]) {
                        return false; // This position must match and doesn't
                    }
                }
            }
            
            // The BLANK position must NOT match (it's the lie)
            // Since BLANK means "this position is wrong", we just need to ensure
            // all other positions are correct, which we've already checked above
            return true; // All conditions met
        } else {
            // No BLANK - check all 4 scenarios where exactly one digit is wrong
            // Scenario 1: First digit wrong, others correct
            if (lastFourDigits[1] === selectedDigits[1] && 
                lastFourDigits[2] === selectedDigits[2] && 
                lastFourDigits[3] === selectedDigits[3] && 
                lastFourDigits[0] !== selectedDigits[0]) {
                return true;
            }
            
            // Scenario 2: Second digit wrong, others correct
            if (lastFourDigits[0] === selectedDigits[0] && 
                lastFourDigits[2] === selectedDigits[2] && 
                lastFourDigits[3] === selectedDigits[3] && 
                lastFourDigits[1] !== selectedDigits[1]) {
                return true;
            }
            
            // Scenario 3: Third digit wrong, others correct
            if (lastFourDigits[0] === selectedDigits[0] && 
                lastFourDigits[1] === selectedDigits[1] && 
                lastFourDigits[3] === selectedDigits[3] && 
                lastFourDigits[2] !== selectedDigits[2]) {
                return true;
            }
            
            // Scenario 4: Fourth digit wrong, others correct
            if (lastFourDigits[0] === selectedDigits[0] && 
                lastFourDigits[1] === selectedDigits[1] && 
                lastFourDigits[2] === selectedDigits[2] && 
                lastFourDigits[3] !== selectedDigits[3]) {
                return true;
            }
        }
        
        return false;
    });
}

// --- AlphaNumeric Filter Logic ---
function filterWordsByAlphaNumeric(words, keepRule) {
    return words.filter(word => {
        const wordLength = word.length;
        const upperWord = word.toUpperCase();
        
        // Check if word follows the rule: length matches letter position AND letter is in word
        let followsRule = false;
        for (let i = 1; i <= 26 && i <= wordLength; i++) {
            const letter = String.fromCharCode(64 + i); // A=65, B=66, etc.
            if (wordLength === i && upperWord.includes(letter)) {
                followsRule = true;
                break;
            }
        }
        
        // YES: keep words that follow rule, NO: keep words that don't follow rule
        return keepRule ? followsRule : !followsRule;
    });
}

// --- Letters Above Filter Logic ---
function filterWordsByLettersAbove(words, count) {
    const numCount = parseInt(count, 10);
    if (isNaN(numCount) || numCount < 0 || numCount > 26) {
        return words; // Invalid input, return all words
    }
    
    return words.filter(word => {
        const upperWord = word.toUpperCase();
        const lettersInWord = new Set(upperWord.split('').filter(c => c >= 'A' && c <= 'Z'));
        
        // Check if there exists a letter L in the word such that
        // exactly 'count' letters before L (in alphabet) are also in the word
        for (const letter of lettersInWord) {
            const letterPos = letter.charCodeAt(0) - 64; // A=1, B=2, etc.
            
            // Count how many letters before this letter are in the word
            let lettersBeforeCount = 0;
            for (let i = 1; i < letterPos; i++) {
                const beforeLetter = String.fromCharCode(64 + i);
                if (lettersInWord.has(beforeLetter)) {
                    lettersBeforeCount++;
                }
            }
            
            // If exactly 'count' letters before are in the word, this word matches
            if (lettersBeforeCount === numCount) {
                return true;
            }
        }
        
        return false;
    });
}

// --- Dictionary (Alpha) Filter Logic ---
function filterWordsByDictionaryAlpha(words, section) {
    return words.filter(word => {
        if (!word || word.length === 0) return false;
        const firstLetter = word[0].toUpperCase();
        const letterCode = firstLetter.charCodeAt(0);
        
        // A=65, M=77, I=73, T=84, N=78, Z=90
        if (section === 'begin') {
            // Beginning: A-M
            return letterCode >= 65 && letterCode <= 77;
        } else if (section === 'mid') {
            // Middle: I-T
            return letterCode >= 73 && letterCode <= 84;
        } else if (section === 'end') {
            // End: N-Z
            return letterCode >= 78 && letterCode <= 90;
        }
        return false;
    });
}

// --- S/M/L (Length) Filter Logic ---
function filterWordsBySmlLength(words, category) {
    return words.filter(word => {
        const length = word.length;
        if (category === 'small') {
            // Small: 1-6 characters
            return length >= 1 && length <= 6;
        } else if (category === 'medium') {
            // Medium: 5-9 characters
            return length >= 5 && length <= 9;
        } else if (category === 'long') {
            // Long: 7+ characters
            return length >= 7;
        }
        return false;
    });
}

// Filtering logic for FIRST CURVED feature
function filterWordsByFirstCurved(words, position) {
    if (!Array.isArray(words) || typeof position !== 'number' || position < 1) return [];
    
    const curvedLetters = letterShapes.curved;
    const targetIndex = position - 1;
    
    return words.filter(word => {
        const upperWord = word.toUpperCase();
        
        // Exclude words shorter than the target position
        if (upperWord.length <= targetIndex) return false;
        
        // Check that the target position IS curved
        if (!curvedLetters.has(upperWord[targetIndex])) return false;
        
        // Check that all positions BEFORE the target are NOT curved
        for (let i = 0; i < targetIndex; i++) {
            if (curvedLetters.has(upperWord[i])) return false;
        }
        
        return true;
    });
}

// Filtering logic for PIN feature
function filterWordsByPin(words, wordBoxes, code) {
    if (!Array.isArray(words) || !Array.isArray(wordBoxes) || !code) return [];
    
    // Extract only digits from code, max 6
    const digitsOnly = code.toString().replace(/[^0-9]/g, '').slice(0, 6);
    if (!digitsOnly) return [];
    
    // Get non-empty word boxes and their corresponding code digits
    const wordCodePairs = [];
    for (let i = 0; i < wordBoxes.length && i < digitsOnly.length; i++) {
        const word = (wordBoxes[i] || '').trim().toUpperCase();
        if (word) {
            const codeDigit = parseInt(digitsOnly[i], 10);
            if (!isNaN(codeDigit)) {
                wordCodePairs.push({ word, codeDigit });
            }
        }
    }
    
    if (wordCodePairs.length === 0) return [];
    
    // Filter words that match all code requirements
    return words.filter(targetWord => {
        const upperTarget = targetWord.toUpperCase();
        
        // Check each word-code pair
        for (const { word, codeDigit } of wordCodePairs) {
            // Count total occurrences: for each letter in the word box,
            // count how many times it appears in the target word
            let occurrenceCount = 0;
            
            // Create a map to track how many times each letter from word box
            // has been "used" from the target word
            const targetLetterCounts = new Map();
            for (const letter of upperTarget) {
                targetLetterCounts.set(letter, (targetLetterCounts.get(letter) || 0) + 1);
            }
            
            // For each letter in the word box, count occurrences in target
            for (const letter of word) {
                const available = targetLetterCounts.get(letter) || 0;
                if (available > 0) {
                    occurrenceCount++;
                    // Decrement to avoid double-counting the same letter instance
                    targetLetterCounts.set(letter, available - 1);
                }
            }
            
            // Must match exactly
            if (occurrenceCount !== codeDigit) {
                return false;
            }
        }
        
        return true;
    }).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

// Filtering logic for FIND-EEE feature
function filterWordsByFindEee(words, selectedLetter, selectedPosition) {
    return words.filter(word => {
        if (selectedPosition === null) {
            // Only letter filtering - word must contain the letter anywhere
            return word.toUpperCase().includes(selectedLetter);
        } else {
            // Letter + position filtering - word must have the letter at the specific position
            const position = selectedPosition - 1;
            return word.length > position && word[position].toUpperCase() === selectedLetter;
        }
    });
}

// Function to setup feature listeners
function setupFeatureListeners(feature, callback) {
    switch (feature) {
        case 'position1': {
            const position1Button = document.getElementById('position1Button');
            const position1DoneButton = document.getElementById('position1DoneButton');
            const position1Input = document.getElementById('position1Input');
            
            if (position1Button) {
                position1Button.onclick = () => {
                    const input = position1Input?.value.trim();
                    if (input) {
                        const consonants = getConsonantsInOrder(input);
                        if (consonants.length >= 2) {
                            const filteredWords = filterWordsByPosition1(currentFilteredWords, consonants);
                            // Store the input word for vowel feature
                            currentPosition1Word = input.toUpperCase(); // Ensure it's uppercase
                            callback(filteredWords);
                            document.getElementById('position1Feature').dispatchEvent(new Event('completed'));
    } else {
                            alert('Please enter a word with at least 2 consonants');
                        }
                    } else {
                        alert('Please enter a word');
                    }
                };
                
                // Add touch event for mobile
                position1Button.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    position1Button.click();
                }, { passive: false });
            }
            
            if (position1DoneButton) {
                position1DoneButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('position1Feature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                position1DoneButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    position1DoneButton.click();
                }, { passive: false });
            }
            break;
        }
        
        case 'consMid': {
            const consMidButton = document.getElementById('consMidButton');
            const consMidDoneButton = document.getElementById('consMidDoneButton');
            const consMidInput = document.getElementById('consMidInput');
            
            if (consMidButton) {
                consMidButton.onclick = () => {
                    const input = consMidInput?.value.trim();
                    if (input) {
                        const letters = input.toLowerCase().split('').filter(char => /[a-z]/.test(char));
                        if (letters.length >= 2) {
                            const filteredWords = filterWordsByConsMid(currentFilteredWords, letters);
                            // Store the input word for potential future use
                            currentPosition1Word = input.toUpperCase(); // Ensure it's uppercase
                            callback(filteredWords);
                            document.getElementById('consMidFeature').dispatchEvent(new Event('completed'));
                        } else {
                            alert('Please enter a word with at least 2 letters');
                        }
                    } else {
                        alert('Please enter a word');
                    }
                };
                
                // Add touch event for mobile
                consMidButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    consMidButton.click();
                }, { passive: false });
            }
            
            if (consMidDoneButton) {
                consMidDoneButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('consMidFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                consMidDoneButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    consMidDoneButton.click();
                }, { passive: false });
            }
            break;
        }
        
        case 'consMid2': {
            const consMid2Button = document.getElementById('consMid2Button');
            const consMid2DoneButton = document.getElementById('consMid2DoneButton');
            const consMid2Input = document.getElementById('consMid2Input');
            
            if (consMid2Button) {
                consMid2Button.onclick = () => {
                    const input = consMid2Input?.value.trim();
                    if (input) {
                        const consonants = getConsonantsInOrder(input);
                        if (consonants.length >= 2) {
                            const filteredWords = filterWordsByConsMid2(currentFilteredWords, consonants);
                            // Store the input word for potential future use
                            currentPosition1Word = input.toUpperCase(); // Ensure it's uppercase
                            callback(filteredWords);
                            document.getElementById('consMid2Feature').dispatchEvent(new Event('completed'));
                        } else {
                            alert('Please enter a word with at least 2 consonants');
                        }
                    } else {
                        alert('Please enter a word');
                    }
                };
                
                // Add touch event for mobile
                consMid2Button.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    consMid2Button.click();
                }, { passive: false });
            }
            
            if (consMid2DoneButton) {
                consMid2DoneButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('consMid2Feature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                consMid2DoneButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    consMid2DoneButton.click();
                }, { passive: false });
            }
            break;
        }
            
        case 'vowel': {
            const vowelYesBtn = document.querySelector('#vowelFeature .yes-btn');
            const vowelNoBtn = document.querySelector('#vowelFeature .no-btn');
            const positionBtns = document.querySelectorAll('#vowelFeature .position-btn');
            
            // Initialize vowel processing with current words
            currentFilteredWordsForVowels = [...currentFilteredWords];
            originalFilteredWords = [...currentFilteredWords];
            currentVowelIndex = 0;
            
            // Get vowels from Position 1 word in order
            const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
            uniqueVowels = [];
            if (currentPosition1Word) {
                for (const char of currentPosition1Word.toLowerCase()) {
                    if (vowels.has(char)) {
                        uniqueVowels.push(char);
                    }
                }
            }
            
            // Set up the vowel display
            const vowelFeature = document.getElementById('vowelFeature');
            const vowelLetter = vowelFeature.querySelector('.vowel-letter');
            if (uniqueVowels.length > 0) {
                vowelLetter.textContent = uniqueVowels[0].toUpperCase();
                vowelLetter.style.display = 'inline-block';
            }

            // Function to filter words by vowel position
            function filterWordsByVowelPosition(words, vowel, position) {
                return words.filter(word => {
                    // Convert position to 0-based index
                    const pos = position - 1;
                    // Check if word is long enough and has the vowel in the specified position
                    return word.length > pos && word[pos].toLowerCase() === vowel.toLowerCase();
                });
            }

            // Add click handlers for position buttons
            positionBtns.forEach(btn => {
                btn.onclick = () => {
                    const position = parseInt(btn.dataset.position);
                    const currentVowel = uniqueVowels[currentVowelIndex];
                    if (currentVowel) {
                        const filteredWords = filterWordsByVowelPosition(currentFilteredWords, currentVowel, position);
                        callback(filteredWords);
                        document.getElementById('vowelFeature').dispatchEvent(new Event('completed'));
                    }
                };
                
                // Add touch event for mobile
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    btn.click();
                }, { passive: false });
            });

            // Existing YES/NO button handlers remain unchanged
            if (vowelYesBtn) {
                vowelYesBtn.onclick = () => {
                    handleVowelSelection(true);
                };
                
                // Add touch event for mobile
                vowelYesBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    vowelYesBtn.click();
                }, { passive: false });
            }
            
            if (vowelNoBtn) {
                vowelNoBtn.onclick = () => {
                    handleVowelSelection(false);
                };
                
                // Add touch event for mobile
                vowelNoBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    vowelNoBtn.click();
                }, { passive: false });
            }
            break;
        }
            
        case 'vowel2': {
            const vowelYesBtn = document.querySelector('#vowel2Feature .yes-btn');
            const vowelNoBtn = document.querySelector('#vowel2Feature .no-btn');
            const sectionBtns = document.querySelectorAll('#vowel2Feature .section-btn');
            
            // Initialize vowel processing with current words
            currentFilteredWordsForVowels = [...currentFilteredWords];
            originalFilteredWords = [...currentFilteredWords];
            currentVowelIndex = 0;
            
            // Get vowels from Position 1 word in order
            const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
            uniqueVowels = [];
            if (currentPosition1Word) {
                for (const char of currentPosition1Word.toLowerCase()) {
                    if (vowels.has(char)) {
                        uniqueVowels.push(char);
                    }
                }
            }
            
            // Set up the vowel display
            const vowelFeature = document.getElementById('vowel2Feature');
            const vowelLetter = vowelFeature.querySelector('.vowel-letter');
            if (uniqueVowels.length > 0) {
                vowelLetter.textContent = uniqueVowels[0].toUpperCase();
                vowelLetter.style.display = 'inline-block';
            }

            // Function to filter words by vowel section (start, middle, end)
            function filterWordsByVowelSection(words, vowel, section) {
                return words.filter(word => {
                    const wordLower = word.toLowerCase();
                    const vowelLower = vowel.toLowerCase();
                    
                    if (!wordLower.includes(vowelLower)) {
                        return false; // Word doesn't contain the vowel
                    }
                    
                    const wordLength = word.length;
                    
                    // Find all positions where the vowel appears
                    const vowelPositions = [];
                    for (let i = 0; i < wordLength; i++) {
                        if (wordLower[i] === vowelLower) {
                            vowelPositions.push(i);
                        }
                    }
                    
                    // Check if any vowel position is in the specified section
                    return vowelPositions.some(pos => {
                        if (section === 'start') {
                            // First half: positions 0 to Math.floor(wordLength/2)
                            return pos <= Math.floor(wordLength / 2);
                        } else if (section === 'end') {
                            // Last half: positions Math.ceil(wordLength/2) to end
                            return pos >= Math.ceil(wordLength / 2);
                        } else if (section === 'middle') {
                            // Middle half: positions in the middle third
                            const start = Math.floor(wordLength / 3);
                            const end = Math.ceil((2 * wordLength) / 3);
                            return pos >= start && pos < end;
                        }
                        return false;
                    });
                });
            }

            // Add click handlers for section buttons
            sectionBtns.forEach(btn => {
                btn.onclick = () => {
                    const section = btn.dataset.section;
                    const currentVowel = uniqueVowels[currentVowelIndex];
                    if (currentVowel) {
                        const filteredWords = filterWordsByVowelSection(currentFilteredWords, currentVowel, section);
                        callback(filteredWords);
                        document.getElementById('vowel2Feature').dispatchEvent(new Event('completed'));
                    }
                };
                
                // Add touch event for mobile
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    btn.click();
                }, { passive: false });
            });

            // YES/NO button handlers
            if (vowelYesBtn) {
                vowelYesBtn.onclick = () => {
                    const currentVowel = uniqueVowels[currentVowelIndex];
                    if (currentVowel) {
                        const filteredWords = currentFilteredWords.filter(word => word.toLowerCase().includes(currentVowel.toLowerCase()));
                        callback(filteredWords);
                        document.getElementById('vowel2Feature').dispatchEvent(new Event('completed'));
                    }
                };
                // Add touch event for mobile
                vowelYesBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    vowelYesBtn.click();
                }, { passive: false });
            }
            
            if (vowelNoBtn) {
                vowelNoBtn.onclick = () => {
                    const currentVowel = uniqueVowels[currentVowelIndex];
                    if (currentVowel) {
                        const filteredWords = currentFilteredWords.filter(word => !word.toLowerCase().includes(currentVowel.toLowerCase()));
                        callback(filteredWords);
                        document.getElementById('vowel2Feature').dispatchEvent(new Event('completed'));
                    }
                };
                // Add touch event for mobile
                vowelNoBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    vowelNoBtn.click();
                }, { passive: false });
            }
            break;
        }
            
        case 'vowelPos': {
            const vowelPosYesBtn = document.querySelector('#vowelPosFeature .yes-btn');
            const vowelPosNoBtn = document.querySelector('#vowelPosFeature .no-btn');
            const vowelPosPositionBtns = document.querySelectorAll('#vowelPosFeature .position-btn');
            
            // Initialize vowel processing with current words
            currentFilteredWordsForVowels = [...currentFilteredWords];
            originalFilteredWords = [...currentFilteredWords];
            currentVowelIndex = 0;
            
            // Get vowels from Position 1 word in order
            const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
            uniqueVowels = [];
            if (currentPosition1Word) {
                for (const char of currentPosition1Word.toLowerCase()) {
                    if (vowels.has(char)) {
                        uniqueVowels.push(char);
                    }
                }
            }
            
            // Set up the vowel display
            const vowelPosFeature = document.getElementById('vowelPosFeature');
            const vowelPosLetter = vowelPosFeature.querySelector('.vowel-letter');
            if (uniqueVowels.length > 0) {
                vowelPosLetter.textContent = uniqueVowels[0].toUpperCase();
                vowelPosLetter.style.display = 'inline-block';
            }

            // Function to get section positions based on word length
            function getSectionPositions(wordLength) {
                const beginEnd = Math.ceil(wordLength / 2);
                
                let midStart, midEnd;
                if (wordLength <= 5) {
                    midStart = 2;
                    midEnd = wordLength - 1;
                } else if (wordLength <= 8) {
                    midStart = 2;
                    midEnd = wordLength - 1;
                } else if (wordLength <= 12) {
                    midStart = 4;
                    midEnd = wordLength - 1;
                } else {
                    midStart = 4;
                    midEnd = wordLength - 1;
                }
                
                return {
                    begin: [0, beginEnd],
                    mid: [midStart - 1, midEnd],
                    end: [beginEnd, wordLength]
                };
            }

            // Function to filter words by vowel section
            function filterWordsByVowelSection(words, vowel, section) {
                return words.filter(word => {
                    const wordLower = word.toLowerCase();
                    const sections = getSectionPositions(word.length);
                    const [start, end] = sections[section];
                    const sectionText = wordLower.slice(start, end);
                    return sectionText.includes(vowel.toLowerCase());
                });
            }

            // Add click handlers for section buttons
            const vowelPosSectionBtns = document.querySelectorAll('#vowelPosFeature .section-btn');
            vowelPosSectionBtns.forEach(btn => {
                btn.onclick = () => {
                    const section = btn.dataset.section;
                    const currentVowel = uniqueVowels[currentVowelIndex];
                    if (currentVowel) {
                        const filteredWords = filterWordsByVowelSection(currentFilteredWords, currentVowel, section);
                        callback(filteredWords);
                        // Immediately advance to the next feature
                        document.getElementById('vowelPosFeature').dispatchEvent(new Event('completed'));
                    }
                };
                
                // Add touch event for mobile
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    btn.click();
                }, { passive: false });
            });

            // YES/NO button handlers
            if (vowelPosYesBtn) {
                vowelPosYesBtn.onclick = () => {
                    const currentVowel = uniqueVowels[currentVowelIndex];
                    if (currentVowel) {
                        const filteredWords = currentFilteredWords.filter(word => word.toLowerCase().includes(currentVowel.toLowerCase()));
                        callback(filteredWords);
                        document.getElementById('vowelPosFeature').dispatchEvent(new Event('completed'));
                    }
                };
                // Add touch event for mobile
                vowelPosYesBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    vowelPosYesBtn.click();
                }, { passive: false });
            }
            
            if (vowelPosNoBtn) {
                vowelPosNoBtn.onclick = () => {
                    const currentVowel = uniqueVowels[currentVowelIndex];
                    if (currentVowel) {
                        const filteredWords = currentFilteredWords.filter(word => !word.toLowerCase().includes(currentVowel.toLowerCase()));
                        callback(filteredWords);
                        document.getElementById('vowelPosFeature').dispatchEvent(new Event('completed'));
                    }
                };
                // Add touch event for mobile
                vowelPosNoBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    vowelPosNoBtn.click();
                }, { passive: false });
            }
            break;
        }
            
        case 'name': {
            const nameInput = document.getElementById('nameInput');
            const nameSubmitButton = document.getElementById('nameSubmitButton');
            const nameSkipButton = document.getElementById('nameSkipButton');
            const vowelButtons = document.querySelectorAll('#nameFeature .vowel-btn');
            const sectionButtons = document.querySelectorAll('#nameFeature .section-btn');
            
            let selectedVowel = null;
            let selectedSection = null;
            
            // Vowel button handlers
            vowelButtons.forEach(btn => {
                btn.onclick = () => {
                    // Remove previous selection
                    vowelButtons.forEach(b => b.classList.remove('active'));
                    // Add selection to clicked button
                    btn.classList.add('active');
                    selectedVowel = btn.dataset.vowel;
                };
                
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    btn.onclick();
                }, { passive: false });
            });
            
            // Section button handlers
            sectionButtons.forEach(btn => {
                btn.onclick = () => {
                    // Remove previous selection
                    sectionButtons.forEach(b => b.classList.remove('active'));
                    // Add selection to clicked button
                    btn.classList.add('active');
                    selectedSection = btn.dataset.section;
                };
                
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    btn.onclick();
                }, { passive: false });
            });
            
            // Helper function to filter words by vowel section (same as VOWEL-POS)
            function filterWordsByVowelSection(words, vowel, section) {
                return words.filter(word => {
                    const wordLower = word.toLowerCase();
                    const vowelLower = vowel.toLowerCase();
                    
                    if (!wordLower.includes(vowelLower)) {
                        return false; // Word doesn't contain the vowel
                    }
                    
                    const wordLength = word.length;
                    
                    // Find all positions where the vowel appears
                    const vowelPositions = [];
                    for (let i = 0; i < wordLength; i++) {
                        if (wordLower[i] === vowelLower) {
                            vowelPositions.push(i);
                        }
                    }
                    
                    // Check if any vowel position is in the specified section
                    return vowelPositions.some(pos => {
                        if (section === 'start') {
                            // First half: positions 0 to Math.floor(wordLength/2)
                            return pos <= Math.floor(wordLength / 2);
                        } else if (section === 'end') {
                            // Last half: positions Math.ceil(wordLength/2) to end
                            return pos >= Math.ceil(wordLength / 2);
                        } else if (section === 'middle') {
                            // Middle half: positions in the middle third
                            const start = Math.floor(wordLength / 3);
                            const end = Math.ceil((2 * wordLength) / 3);
                            return pos >= start && pos < end;
                        }
                        return false;
                    });
                });
            }
            
            if (nameSubmitButton) {
                nameSubmitButton.onclick = () => {
                    const nameInputValue = nameInput?.value.trim();
                    
                    if (!nameInputValue) {
                        alert('Please enter a full name');
                        return;
                    }
                    
                    // Extract initials (first letter of first name and surname)
                    const nameParts = nameInputValue.split(/\s+/).filter(part => part.length > 0);
                    if (nameParts.length < 2) {
                        alert('Please enter both first name and surname');
                        return;
                    }
                    
                    const initials = nameParts.map(part => part[0].toLowerCase()).join('');
                    const consonants = getConsonantsInOrder(initials);
                    
                    if (consonants.length < 2) {
                        alert('The initials must contain at least 2 consonants');
                        return;
                    }
                    
                    if (!selectedVowel) {
                        alert('Please select a vowel');
                        return;
                    }
                    
                    if (!selectedSection) {
                        alert('Please select a position (START/MID/END)');
                        return;
                    }
                    
                    // Filter by consonants (like Short Word)
                    let filteredWords = filterWordsByPosition1(currentFilteredWords, consonants);
                    
                    // Filter by vowel position (like VOWEL-POS)
                    filteredWords = filterWordsByVowelSection(filteredWords, selectedVowel, selectedSection);
                    
                    callback(filteredWords);
                    document.getElementById('nameFeature').classList.add('completed');
                    document.getElementById('nameFeature').dispatchEvent(new Event('completed'));
                };
                
                nameSubmitButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    nameSubmitButton.onclick();
                }, { passive: false });
            }
            
            if (nameSkipButton) {
                nameSkipButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('nameFeature').classList.add('completed');
                    document.getElementById('nameFeature').dispatchEvent(new Event('completed'));
                };
                
                nameSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    nameSkipButton.onclick();
                }, { passive: false });
            }
            
            // No Vowel button handler
            const nameNoVowelButton = document.getElementById('nameNoVowelButton');
            if (nameNoVowelButton) {
                nameNoVowelButton.onclick = () => {
                    const nameInputValue = nameInput?.value.trim();
                    
                    if (!nameInputValue) {
                        alert('Please enter a full name');
                        return;
                    }
                    
                    // Extract initials (first letter of first name and surname)
                    const nameParts = nameInputValue.split(/\s+/).filter(part => part.length > 0);
                    if (nameParts.length < 2) {
                        alert('Please enter both first name and surname');
                        return;
                    }
                    
                    const initials = nameParts.map(part => part[0].toLowerCase()).join('');
                    const consonants = getConsonantsInOrder(initials);
                    
                    if (consonants.length < 2) {
                        alert('The initials must contain at least 2 consonants');
                        return;
                    }
                    
                    // Filter by consonants only (like Short Word) - bypass vowel selection
                    const filteredWords = filterWordsByPosition1(currentFilteredWords, consonants);
                    
                    callback(filteredWords);
                    document.getElementById('nameFeature').classList.add('completed');
                    document.getElementById('nameFeature').dispatchEvent(new Event('completed'));
                };
                
                nameNoVowelButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    nameNoVowelButton.onclick();
                }, { passive: false });
            }
            break;
        }
            
        case 'o': {
            const oYesBtn = document.getElementById('oYesBtn');
            const oNoBtn = document.getElementById('oNoBtn');
            const oSkipBtn = document.getElementById('oSkipBtn');
            
            if (oYesBtn) {
                oYesBtn.onclick = () => {
                    const filteredWords = filterWordsByO(currentFilteredWords, true);
                    callback(filteredWords);
                    document.getElementById('oFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                oYesBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    oYesBtn.click();
                }, { passive: false });
            }
            
            if (oNoBtn) {
                oNoBtn.onclick = () => {
                    const filteredWords = filterWordsByO(currentFilteredWords, false);
                    callback(filteredWords);
                    document.getElementById('oFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                oNoBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    oNoBtn.click();
                }, { passive: false });
            }
            
            if (oSkipBtn) {
                oSkipBtn.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('oFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                oSkipBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    oSkipBtn.click();
                }, { passive: false });
            }
            break;
        }
            
        case 'curved': {
            const curvedButtons = document.querySelectorAll('.curved-btn');
            const curvedSkipBtn = document.getElementById('curvedSkipBtn');
            
            curvedButtons.forEach(button => {
                button.onclick = () => {
                    const letter = button.textContent;
                    const filteredWords = filterWordsByCurvedPositions(currentFilteredWords, letter);
                    callback(filteredWords);
                    document.getElementById('curvedFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                button.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    button.click();
                }, { passive: false });
            });
            
            if (curvedSkipBtn) {
                curvedSkipBtn.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('curvedFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                curvedSkipBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    curvedSkipBtn.click();
                }, { passive: false });
            }
            break;
        }
            
        case 'colour3': {
            const colour3YesBtn = document.getElementById('colour3YesBtn');
            const colour3SkipButton = document.getElementById('colour3SkipButton');
            
            if (colour3YesBtn) {
                colour3YesBtn.onclick = () => {
                    const filteredWords = filterWordsByColour3(currentFilteredWords);
                    callback(filteredWords);
                    document.getElementById('colour3Feature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                colour3YesBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    colour3YesBtn.click();
                }, { passive: false });
            }
            
            if (colour3SkipButton) {
                colour3SkipButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('colour3Feature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                colour3SkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    colour3SkipButton.click();
                }, { passive: false });
            }
            break;
        }
            
        case 'lexicon': {
            const lexiconButton = document.getElementById('lexiconButton');
            const lexiconSkipButton = document.getElementById('lexiconSkipButton');
            
            if (lexiconButton) {
                lexiconButton.onclick = () => {
                    const input = document.getElementById('lexiconInput')?.value.trim();
                    if (input) {
                        const filteredWords = filterWordsByLexicon(currentFilteredWords, input);
                        callback(filteredWords);
                        document.getElementById('lexiconFeature').dispatchEvent(new Event('completed'));
                    } else {
                        alert('Please enter positions (e.g., 123)');
                    }
                };
                
                // Add touch event for mobile
                lexiconButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    lexiconButton.click();
                }, { passive: false });
            }
            
            if (lexiconSkipButton) {
                lexiconSkipButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('lexiconFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                lexiconSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    lexiconSkipButton.click();
                }, { passive: false });
            }
            break;
        }
            
        case 'consonant': {
            const consonantYesBtn = document.getElementById('consonantYesBtn');
            const consonantNoBtn = document.getElementById('consonantNoBtn');
            
            if (consonantYesBtn) {
                consonantYesBtn.onclick = () => {
                    hasAdjacentConsonants = true;
                    const filteredWords = currentFilteredWords.filter(word => hasWordAdjacentConsonants(word));
                    callback(filteredWords);
                    document.getElementById('consonantQuestion').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                consonantYesBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    consonantYesBtn.click();
                }, { passive: false });
            }
            
            if (consonantNoBtn) {
                consonantNoBtn.onclick = () => {
                    hasAdjacentConsonants = false;
                    const filteredWords = currentFilteredWords.filter(word => !hasWordAdjacentConsonants(word));
                    callback(filteredWords);
                    document.getElementById('consonantQuestion').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                consonantNoBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    consonantNoBtn.click();
                }, { passive: false });
            }
            break;
        }
            
        case 'eee': {
            const eeeButton = document.getElementById('eeeButton');
            const eeeYesBtn = document.getElementById('eeeYesBtn');
            const eeeNoBtn = document.getElementById('eeeNoBtn');
            
            if (eeeButton) {
                eeeButton.onclick = () => {
                    const filteredWords = filterWordsByEee(currentFilteredWords, 'E');
                    callback(filteredWords);
                    document.getElementById('eeeFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                eeeButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    eeeButton.click();
                }, { passive: false });
            }
            
            if (eeeYesBtn) {
                eeeYesBtn.onclick = () => {
                    const filteredWords = filterWordsByEee(currentFilteredWords, 'YES');
                    callback(filteredWords);
                    document.getElementById('eeeFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                eeeYesBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    eeeYesBtn.click();
                }, { passive: false });
            }
            
            if (eeeNoBtn) {
                eeeNoBtn.onclick = () => {
                    const filteredWords = filterWordsByEee(currentFilteredWords, 'NO');
                    callback(filteredWords);
                    document.getElementById('eeeFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                eeeNoBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    eeeNoBtn.click();
                }, { passive: false });
            }
            break;
        }

        case 'eeeFirst': {
            const eeeFirstButton = document.getElementById('eeeFirstButton');
            const eeeFirstYesBtn = document.getElementById('eeeFirstYesBtn');
            const eeeFirstNoBtn = document.getElementById('eeeFirstNoBtn');
            const eeeFirstSkipButton = document.getElementById('eeeFirstSkipButton');
            
            if (eeeFirstButton) {
                eeeFirstButton.onclick = () => {
                    const filteredWords = filterWordsByEeeFirst(currentFilteredWords, 'E');
                    callback(filteredWords);
                    document.getElementById('eeeFirstFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                eeeFirstButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    eeeFirstButton.click();
                }, { passive: false });
            }
            
            if (eeeFirstYesBtn) {
                eeeFirstYesBtn.onclick = () => {
                    const filteredWords = filterWordsByEeeFirst(currentFilteredWords, 'YES');
                    callback(filteredWords);
                    document.getElementById('eeeFirstFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                eeeFirstYesBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    eeeFirstYesBtn.click();
                }, { passive: false });
            }
            
            if (eeeFirstNoBtn) {
                eeeFirstNoBtn.onclick = () => {
                    const filteredWords = filterWordsByEeeFirst(currentFilteredWords, 'NO');
                    callback(filteredWords);
                    document.getElementById('eeeFirstFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                eeeFirstNoBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    eeeFirstNoBtn.click();
                }, { passive: false });
            }

            if (eeeFirstSkipButton) {
                eeeFirstSkipButton.onclick = () => {
                    callback(currentFilteredWords); // Keep the current word list unchanged
                    document.getElementById('eeeFirstFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                eeeFirstSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    eeeFirstSkipButton.click();
                }, { passive: false });
            }
            break;
        }
        
        case 'originalLex': {
            const originalLexButton = document.getElementById('originalLexButton');
            const originalLexSkipButton = document.getElementById('originalLexSkipButton');
            const originalLexInput = document.getElementById('originalLexInput');
            
            // Find position with most variance and update display
            const { position, letters } = findPositionWithMostVariance(currentFilteredWords);
            originalLexPosition = position;
            
            // Update position display
            const positionNumber = document.querySelector('#originalLexFeature .position-number');
            if (positionNumber) {
                positionNumber.textContent = position + 1; // Convert to 1-based position
            }
            
            // Update possible letters display
            const lettersList = document.querySelector('#originalLexFeature .letters-list');
            if (lettersList) {
                lettersList.textContent = letters.join(', ');
            }
            
            if (originalLexButton) {
                originalLexButton.onclick = () => {
                    const input = originalLexInput?.value.trim();
                    if (input) {
                        const filteredWords = filterWordsByOriginalLex(currentFilteredWords, originalLexPosition, input);
                        callback(filteredWords);
                        document.getElementById('originalLexFeature').dispatchEvent(new Event('completed'));
                    } else {
                        alert('Please enter a word');
                    }
                };
                
                // Add touch event for mobile
                originalLexButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    originalLexButton.click();
                }, { passive: false });
            }
            
            if (originalLexSkipButton) {
                originalLexSkipButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('originalLexFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                originalLexSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    originalLexSkipButton.click();
                }, { passive: false });
            }
            break;
        }

        case 'length': {
            const lengthButton = document.getElementById('lengthButton');
            const lengthSkipButton = document.getElementById('lengthSkipButton');
            const lengthInput = document.getElementById('lengthInput');
            
            if (lengthButton) {
                lengthButton.onclick = () => {
                    const input = lengthInput?.value.trim();
                    if (input) {
                        const length = parseInt(input);
                        if (length >= 3) {
                            const filteredWords = filterWordsByLength(currentFilteredWords, length);
                            callback(filteredWords);
                            document.getElementById('lengthFeature').dispatchEvent(new Event('completed'));
                        } else {
                            alert('Please enter a length of 3 or more');
                        }
                    } else {
                        alert('Please enter a length');
                    }
                };
                
                // Add touch event for mobile
                lengthButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    lengthButton.click();
                }, { passive: false });
            }
            
            if (lengthSkipButton) {
                lengthSkipButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('lengthFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                lengthSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    lengthSkipButton.click();
                }, { passive: false });
            }
            break;
        }

        case 'mostFrequent': {
            const frequentYesBtn = document.getElementById('frequentYesBtn');
            const frequentNoBtn = document.getElementById('frequentNoBtn');
            const frequentSkipButton = document.getElementById('frequentSkipButton');
            const letterDisplay = document.querySelector('#mostFrequentFeature .letter');
            
            // Find and display most frequent letter (will skip already-answered letters)
            mostFrequentLetter = findMostFrequentLetter(currentFilteredWords);
            
            if (letterDisplay) {
                if (mostFrequentLetter) {
                    letterDisplay.textContent = mostFrequentLetter;
                    letterDisplay.style.color = '#000'; // Normal color
                    // Enable buttons if we have a letter
                    if (frequentYesBtn) frequentYesBtn.disabled = false;
                    if (frequentNoBtn) frequentNoBtn.disabled = false;
                } else {
                    letterDisplay.textContent = 'No more unique letters';
                    // Disable buttons if no more letters
                    if (frequentYesBtn) frequentYesBtn.disabled = true;
                    if (frequentNoBtn) frequentNoBtn.disabled = true;
                }
            }
            
            if (frequentYesBtn) {
                frequentYesBtn.onclick = () => {
                    if (mostFrequentLetter) {
                        // Update workflow state
                        workflowState.confirmedLetters.add(mostFrequentLetter);
                        console.log(`MOST FREQUENT: ${mostFrequentLetter} confirmed`);
                        logWorkflowState();
                        
                        const filteredWords = filterWordsByMostFrequent(currentFilteredWords, mostFrequentLetter, true);
                        callback(filteredWords);
                        document.getElementById('mostFrequentFeature').classList.add('completed');
                        document.getElementById('mostFrequentFeature').dispatchEvent(new Event('completed'));
                    }
                };
                
                // Add touch event for mobile
                frequentYesBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (!frequentYesBtn.disabled) {
                        frequentYesBtn.click();
                    }
                }, { passive: false });
            }
            
            if (frequentNoBtn) {
                frequentNoBtn.onclick = () => {
                    if (mostFrequentLetter) {
                        // Update workflow state
                        workflowState.excludedLetters.add(mostFrequentLetter);
                        console.log(`MOST FREQUENT: ${mostFrequentLetter} excluded`);
                        logWorkflowState();
                        
                        const filteredWords = filterWordsByMostFrequent(currentFilteredWords, mostFrequentLetter, false);
                        callback(filteredWords);
                        document.getElementById('mostFrequentFeature').classList.add('completed');
                        document.getElementById('mostFrequentFeature').dispatchEvent(new Event('completed'));
                    }
                };
                
                // Add touch event for mobile
                frequentNoBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (!frequentNoBtn.disabled) {
                        frequentNoBtn.click();
                    }
                }, { passive: false });
            }
            
            if (frequentSkipButton) {
                frequentSkipButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('mostFrequentFeature').classList.add('completed');
                    document.getElementById('mostFrequentFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                frequentSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    frequentSkipButton.click();
                }, { passive: false });
            }
            break;
        }

        case 'leastFrequent': {
            const leastFrequentYesBtn = document.getElementById('leastFrequentYesBtn');
            const leastFrequentNoBtn = document.getElementById('leastFrequentNoBtn');
            const leastFrequentSkipButton = document.getElementById('leastFrequentSkipButton');
            const letterDisplay = document.querySelector('#leastFrequentFeature .letter');
            
            // Find and display least frequent letter (will skip already-answered letters)
            leastFrequentLetter = findLeastFrequentLetter(currentFilteredWords);
            
            if (letterDisplay) {
                if (leastFrequentLetter) {
                    letterDisplay.textContent = leastFrequentLetter;
                    letterDisplay.style.color = '#000'; // Normal color
                    // Enable buttons if we have a letter
                    if (leastFrequentYesBtn) leastFrequentYesBtn.disabled = false;
                    if (leastFrequentNoBtn) leastFrequentNoBtn.disabled = false;
                } else {
                    letterDisplay.textContent = 'No more unique letters';
                    // Disable buttons if no more letters
                    if (leastFrequentYesBtn) leastFrequentYesBtn.disabled = true;
                    if (leastFrequentNoBtn) leastFrequentNoBtn.disabled = true;
                }
            }
            
            if (leastFrequentYesBtn) {
                leastFrequentYesBtn.onclick = () => {
                    if (leastFrequentLetter) {
                        // Update workflow state
                        workflowState.confirmedLetters.add(leastFrequentLetter);
                        console.log(`LEAST FREQUENT: ${leastFrequentLetter} confirmed`);
                        logWorkflowState();
                        
                        const filteredWords = filterWordsByLeastFrequent(currentFilteredWords, leastFrequentLetter, true);
                        callback(filteredWords);
                        document.getElementById('leastFrequentFeature').classList.add('completed');
                        document.getElementById('leastFrequentFeature').dispatchEvent(new Event('completed'));
                    }
                };
                
                // Add touch event for mobile
                leastFrequentYesBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (!leastFrequentYesBtn.disabled) {
                        leastFrequentYesBtn.click();
                    }
                }, { passive: false });
            }
            
            if (leastFrequentNoBtn) {
                leastFrequentNoBtn.onclick = () => {
                    if (leastFrequentLetter) {
                        // Update workflow state
                        workflowState.excludedLetters.add(leastFrequentLetter);
                        console.log(`LEAST FREQUENT: ${leastFrequentLetter} excluded`);
                        logWorkflowState();
                        
                        const filteredWords = filterWordsByLeastFrequent(currentFilteredWords, leastFrequentLetter, false);
                        callback(filteredWords);
                        document.getElementById('leastFrequentFeature').classList.add('completed');
                        document.getElementById('leastFrequentFeature').dispatchEvent(new Event('completed'));
                    }
                };
                
                // Add touch event for mobile
                leastFrequentNoBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (!leastFrequentNoBtn.disabled) {
                        leastFrequentNoBtn.click();
                    }
                }, { passive: false });
            }
            
            if (leastFrequentSkipButton) {
                leastFrequentSkipButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('leastFrequentFeature').classList.add('completed');
                    document.getElementById('leastFrequentFeature').dispatchEvent(new Event('completed'));
                };
                
                // Add touch event for mobile
                leastFrequentSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    leastFrequentSkipButton.click();
                }, { passive: false });
            }
            break;
        }

        case 'notIn': {
            const notInButton = document.getElementById('notInButton');
            const notInSkipButton = document.getElementById('notInSkipButton');
            const notInInput = document.getElementById('notInInput');

            if (notInButton && notInInput && notInSkipButton) {
                // Remove any existing event listeners
                const newNotInButton = notInButton.cloneNode(true);
                const newNotInSkipButton = notInSkipButton.cloneNode(true);
                const newNotInInput = notInInput.cloneNode(true);
                
                notInButton.parentNode.replaceChild(newNotInButton, notInButton);
                notInSkipButton.parentNode.replaceChild(newNotInSkipButton, notInSkipButton);
                notInInput.parentNode.replaceChild(newNotInInput, notInInput);

                newNotInButton.addEventListener('click', () => {
                    const letters = newNotInInput.value.toLowerCase();
                    if (letters) {
                        filterWordsByNotIn(letters);
                        callback(currentFilteredWords);
                        document.getElementById('notInFeature').classList.add('completed');
                        document.getElementById('notInFeature').dispatchEvent(new Event('completed'));
                    }
                });

                newNotInSkipButton.addEventListener('click', () => {
                    callback(currentFilteredWords);
                    document.getElementById('notInFeature').classList.add('completed');
                    document.getElementById('notInFeature').dispatchEvent(new Event('completed'));
                });

                // Add enter key support
                newNotInInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        newNotInButton.click();
                    }
                });

                // Add touch events for mobile
                newNotInButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    newNotInButton.click();
                }, { passive: false });

                newNotInSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    newNotInSkipButton.click();
                }, { passive: false });
            }
            break;
        }

        case 'abcde': {
            const yesBtns = Array.from(document.querySelectorAll('.abcde-btn'));
            const doneBtn = document.getElementById('abcdeDoneButton');
            const skipBtn = document.getElementById('abcdeSkipButton');
            const noneBtn = document.getElementById('abcdeNoneButton');
            let yesLetters = [];

            yesBtns.forEach(btn => {
                btn.classList.remove('active');
                btn.onclick = () => {
                    const letter = btn.dataset.letter;
                    if (yesLetters.includes(letter)) {
                        yesLetters = yesLetters.filter(l => l !== letter);
                        btn.classList.remove('active');
                    } else {
                        yesLetters.push(letter);
                        btn.classList.add('active');
                    }
                };
                // Touch event for mobile
                btn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    btn.onclick();
                }, { passive: false });
            });

            if (doneBtn) {
                doneBtn.onclick = () => {
                    // Update workflow state with ABCDE selections
                    workflowState.abcdeSelection = new Set(yesLetters);
                    
                    // Add selected letters to confirmed letters
                    yesLetters.forEach(letter => {
                        workflowState.confirmedLetters.add(letter);
                    });
                    
                    // Add unselected letters to excluded letters
                    ['A', 'B', 'C', 'D', 'E'].forEach(letter => {
                        if (!yesLetters.includes(letter)) {
                            workflowState.excludedLetters.add(letter);
                        }
                    });
                    
                    console.log(`ABCDE feature completed. Selected: ${yesLetters.join(', ')}`);
                    logWorkflowState();
                    
                    const filteredWords = filterWordsByAbcde(currentFilteredWords, yesLetters);
                    callback(filteredWords);
                    const featureDiv = document.getElementById('abcdeFeature');
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                };
                doneBtn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    doneBtn.onclick();
                }, { passive: false });
            }
            
            if (noneBtn) {
                noneBtn.onclick = () => {
                    // Update workflow state - exclude all ABCDE letters
                    workflowState.abcdeSelection = new Set([]);
                    
                    // Add all ABCDE letters to excluded letters
                    ['A', 'B', 'C', 'D', 'E'].forEach(letter => {
                        workflowState.excludedLetters.add(letter);
                    });
                    
                    console.log(`ABCDE feature completed. NONE selected - all letters excluded`);
                    logWorkflowState();
                    
                    // Filter out words containing any of A, B, C, D, E
                    const filteredWords = currentFilteredWords.filter(word => {
                        return !['A', 'B', 'C', 'D', 'E'].some(letter => 
                            word.toUpperCase().includes(letter)
                        );
                    });
                    
                    callback(filteredWords);
                    const featureDiv = document.getElementById('abcdeFeature');
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                };
                noneBtn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    noneBtn.onclick();
                }, { passive: false });
            }
            
            if (skipBtn) {
                skipBtn.onclick = () => {
                    callback(currentFilteredWords);
                    const featureDiv = document.getElementById('abcdeFeature');
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                };
                skipBtn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    skipBtn.onclick();
                }, { passive: false });
            }
            break;
        }
        case 'abc': {
            const yesBtns = Array.from(document.querySelectorAll('.abc-btn'));
            const doneBtn = document.getElementById('abcDoneButton');
            const skipBtn = document.getElementById('abcSkipButton');
            const noneBtn = document.getElementById('abcNoneButton');
            let yesLetters = [];

            yesBtns.forEach(btn => {
                btn.classList.remove('active');
                btn.onclick = () => {
                    const letter = btn.dataset.letter;
                    if (yesLetters.includes(letter)) {
                        yesLetters = yesLetters.filter(l => l !== letter);
                        btn.classList.remove('active');
                    } else {
                        yesLetters.push(letter);
                        btn.classList.add('active');
                    }
                };
                // Touch event for mobile
                btn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    btn.onclick();
                }, { passive: false });
            });

            if (doneBtn) {
                doneBtn.onclick = () => {
                    // Update workflow state with ABC selections
                    workflowState.abcSelection = new Set(yesLetters);
                    
                    // Add selected letters to confirmed letters
                    yesLetters.forEach(letter => {
                        workflowState.confirmedLetters.add(letter);
                    });
                    
                    // Add unselected letters to excluded letters
                    ['A', 'B', 'C'].forEach(letter => {
                        if (!yesLetters.includes(letter)) {
                            workflowState.excludedLetters.add(letter);
                        }
                    });
                    
                    console.log(`ABC feature completed. Selected: ${yesLetters.join(', ')}`);
                    logWorkflowState();
                    
                    const filteredWords = filterWordsByAbc(currentFilteredWords, yesLetters);
                    callback(filteredWords);
                    const featureDiv = document.getElementById('abcFeature');
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                };
                doneBtn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    doneBtn.onclick();
                }, { passive: false });
            }
            
            if (noneBtn) {
                noneBtn.onclick = () => {
                    // Update workflow state - exclude all ABC letters
                    workflowState.abcSelection = new Set([]);
                    
                    // Add all ABC letters to excluded letters
                    ['A', 'B', 'C'].forEach(letter => {
                        workflowState.excludedLetters.add(letter);
                    });
                    
                    console.log(`ABC feature completed. NONE selected - all letters excluded`);
                    logWorkflowState();
                    
                    // Filter out words containing any of A, B, C
                    const filteredWords = currentFilteredWords.filter(word => {
                        return !['A', 'B', 'C'].some(letter => 
                            word.toUpperCase().includes(letter)
                        );
                    });
                    
                    callback(filteredWords);
                    const featureDiv = document.getElementById('abcFeature');
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                };
                noneBtn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    noneBtn.onclick();
                }, { passive: false });
            }
            
            if (skipBtn) {
                skipBtn.onclick = () => {
                    callback(currentFilteredWords);
                    const featureDiv = document.getElementById('abcFeature');
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                };
                skipBtn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    skipBtn.onclick();
                }, { passive: false });
            }
            break;
        }
        case 'pianoForte': {
            const yesBtns = Array.from(document.querySelectorAll('.piano-forte-btn'));
            const submitBtn = document.getElementById('pianoForteSubmitButton');
            const skipBtn = document.getElementById('pianoForteSkipButton');
            const noneBtn = document.getElementById('pianoForteNoneButton');
            const stringDisplay = document.getElementById('pianoForteString');
            let letterSequence = []; // Array to store the chronological sequence

            // Initialize display
            if (stringDisplay) {
                stringDisplay.textContent = '-';
            }

            yesBtns.forEach(btn => {
                btn.classList.remove('active');
                btn.onclick = () => {
                    const letter = btn.dataset.letter;
                    // Add letter to sequence (can be pressed multiple times)
                    letterSequence.push(letter);
                    
                    // Update display
                    if (stringDisplay) {
                        stringDisplay.textContent = letterSequence.join('');
                    }
                    
                    // Visual feedback - briefly highlight the button
                    btn.classList.add('active');
                    setTimeout(() => {
                        btn.classList.remove('active');
                    }, 200);
                };
                // Touch event for mobile
                btn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    btn.onclick();
                }, { passive: false });
            });

            if (submitBtn) {
                submitBtn.onclick = () => {
                    if (letterSequence.length === 0) {
                        alert('Please select at least one letter');
                        return;
                    }
                    
                    // Update workflow state with Piano Forte selections
                    workflowState.pianoForteSelection = letterSequence;
                    
                    // Get unique pressed letters
                    const pressedLetters = new Set(letterSequence);
                    const unpressedLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].filter(
                        letter => !pressedLetters.has(letter)
                    );
                    
                    // Add pressed letters to confirmed letters
                    pressedLetters.forEach(letter => {
                        workflowState.confirmedLetters.add(letter);
                    });
                    
                    // Add unpressed letters to excluded letters
                    unpressedLetters.forEach(letter => {
                        workflowState.excludedLetters.add(letter);
                    });
                    
                    console.log(`Piano Forte feature completed. Sequence: ${letterSequence.join('')}`);
                    logWorkflowState();
                    
                    const filteredWords = filterWordsByPianoForte(currentFilteredWords, letterSequence);
                    callback(filteredWords);
                    const featureDiv = document.getElementById('pianoForteFeature');
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                };
                submitBtn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    submitBtn.onclick();
                }, { passive: false });
            }
            
            if (noneBtn) {
                noneBtn.onclick = () => {
                    // Update workflow state - exclude all Piano Forte letters
                    workflowState.pianoForteSelection = [];
                    
                    // Add all Piano Forte letters to excluded letters
                    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(letter => {
                        workflowState.excludedLetters.add(letter);
                    });
                    
                    console.log(`Piano Forte feature completed. NONE selected - all letters excluded`);
                    logWorkflowState();
                    
                    // Filter out words containing any of A, B, C, D, E, F, G
                    const filteredWords = currentFilteredWords.filter(word => {
                        return !['A', 'B', 'C', 'D', 'E', 'F', 'G'].some(letter => 
                            word.toUpperCase().includes(letter)
                        );
                    });
                    
                    callback(filteredWords);
                    const featureDiv = document.getElementById('pianoForteFeature');
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                };
                noneBtn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    noneBtn.onclick();
                }, { passive: false });
            }
            
            if (skipBtn) {
                skipBtn.onclick = () => {
                    callback(currentFilteredWords);
                    const featureDiv = document.getElementById('pianoForteFeature');
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                };
                skipBtn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    skipBtn.onclick();
                }, { passive: false });
            }
            break;
        }
        case 'pianoPiano': {
            const countBtns = Array.from(document.querySelectorAll('.piano-piano-btn'));
            const submitBtn = document.getElementById('pianoPianoSubmitButton');
            const skipBtn = document.getElementById('pianoPianoSkipButton');
            const noneBtn = document.getElementById('pianoPianoNoneButton');
            const countDisplay = document.getElementById('pianoPianoString');
            let selectedCount = null;

            // Initialize display
            if (countDisplay) {
                countDisplay.textContent = '-';
            }

            countBtns.forEach(btn => {
                btn.classList.remove('active');
                btn.onclick = () => {
                    // Remove active from all buttons
                    countBtns.forEach(b => b.classList.remove('active'));
                    
                    // Set selected count
                    selectedCount = parseInt(btn.dataset.count);
                    
                    // Update display
                    if (countDisplay) {
                        countDisplay.textContent = selectedCount.toString();
                    }
                    
                    // Visual feedback
                    btn.classList.add('active');
                };
                // Touch event for mobile
                btn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    btn.onclick();
                }, { passive: false });
            });

            if (submitBtn) {
                submitBtn.onclick = () => {
                    if (selectedCount === null) {
                        alert('Please select a count');
                        return;
                    }
                    
                    // Update workflow state
                    workflowState.pianoPianoSelection = selectedCount;
                    
                    console.log(`Piano Piano feature completed. Count: ${selectedCount}`);
                    logWorkflowState();
                    
                    const filteredWords = filterWordsByPianoPiano(currentFilteredWords, selectedCount);
                    callback(filteredWords);
                    const featureDiv = document.getElementById('pianoPianoFeature');
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                };
                submitBtn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    submitBtn.onclick();
                }, { passive: false });
            }
            
            if (noneBtn) {
                noneBtn.onclick = () => {
                    // Filter out words containing any A-G letters
                    const filteredWords = currentFilteredWords.filter(word => {
                        const wordUpper = word.toUpperCase();
                        return !['A', 'B', 'C', 'D', 'E', 'F', 'G'].some(letter => 
                            wordUpper.includes(letter)
                        );
                    });
                    
                    callback(filteredWords);
                    const featureDiv = document.getElementById('pianoPianoFeature');
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                };
                noneBtn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    noneBtn.onclick();
                }, { passive: false });
            }
            
            if (skipBtn) {
                skipBtn.onclick = () => {
                    callback(currentFilteredWords);
                    const featureDiv = document.getElementById('pianoPianoFeature');
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                };
                skipBtn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    skipBtn.onclick();
                }, { passive: false });
            }
            break;
        }
        case 't9Length': {
            const t9LengthButton = document.getElementById('t9LengthButton');
            const t9LengthInput = document.getElementById('t9LengthInput');
            const t9LengthSkipButton = document.getElementById('t9LengthSkipButton');
            
            if (t9LengthButton && t9LengthInput) {
                t9LengthButton.onclick = () => {
                    const lengthValue = parseInt(t9LengthInput.value.trim());
                    if (isNaN(lengthValue) || lengthValue < 3) {
                        alert('Please enter a valid length (3 or greater)');
                        return;
                    }
                    
                    // Calculate T9 strings if not already done
                    calculateT9Strings(currentFilteredWords);
                    
                    const filteredWords = filterWordsByT9Length(currentFilteredWords, lengthValue);
                    callback(filteredWords);
                    document.getElementById('t9LengthFeature').classList.add('completed');
                    document.getElementById('t9LengthFeature').dispatchEvent(new Event('completed'));
                };
                
                t9LengthButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9LengthButton.onclick();
                }, { passive: false });
                
                // Enter key support
                t9LengthInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        t9LengthButton.onclick();
                    }
                });
            }
            
            if (t9LengthSkipButton) {
                t9LengthSkipButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('t9LengthFeature').classList.add('completed');
                    document.getElementById('t9LengthFeature').dispatchEvent(new Event('completed'));
                };
                
                t9LengthSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9LengthSkipButton.onclick();
                }, { passive: false });
            }
            break;
        }
        case 't9LastTwo': {
            let selectedDigits = [];
            const t9LastTwoButtons = document.querySelectorAll('.t9-last-two-btn');
            const t9LastTwoDisplay = document.getElementById('t9LastTwoString');
            const t9LastTwoSubmitButton = document.getElementById('t9LastTwoSubmitButton');
            const t9LastTwoResetButton = document.getElementById('t9LastTwoResetButton');
            const t9LastTwoSkipButton = document.getElementById('t9LastTwoSkipButton');
            
            // Initialize display
            if (t9LastTwoDisplay) {
                t9LastTwoDisplay.textContent = '-';
            }
            
            // Number button handlers
            t9LastTwoButtons.forEach(btn => {
                btn.onclick = () => {
                    if (selectedDigits.length < 2) {
                        const digit = btn.dataset.digit;
                        selectedDigits.push(digit);
                        if (t9LastTwoDisplay) {
                            t9LastTwoDisplay.textContent = selectedDigits.join('');
                        }
                        btn.classList.add('active');
                    }
                };
                
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (selectedDigits.length < 2) {
                        const digit = btn.dataset.digit;
                        selectedDigits.push(digit);
                        if (t9LastTwoDisplay) {
                            t9LastTwoDisplay.textContent = selectedDigits.join('');
                        }
                        btn.classList.add('active');
                    }
                }, { passive: false });
            });
            
            // Submit button
            if (t9LastTwoSubmitButton) {
                t9LastTwoSubmitButton.onclick = () => {
                    if (selectedDigits.length !== 2) {
                        alert('Please select exactly 2 digits');
                        return;
                    }
                    
                    const lastTwo = selectedDigits.join('');
                    
                    // Calculate T9 strings if not already done
                    calculateT9Strings(currentFilteredWords);
                    
                    const filteredWords = filterWordsByT9LastTwo(currentFilteredWords, lastTwo);
                    callback(filteredWords);
                    document.getElementById('t9LastTwoFeature').classList.add('completed');
                    document.getElementById('t9LastTwoFeature').dispatchEvent(new Event('completed'));
                };
                
                t9LastTwoSubmitButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9LastTwoSubmitButton.onclick();
                }, { passive: false });
            }
            
            // Reset button
            if (t9LastTwoResetButton) {
                t9LastTwoResetButton.onclick = () => {
                    selectedDigits = [];
                    if (t9LastTwoDisplay) {
                        t9LastTwoDisplay.textContent = '-';
                    }
                    t9LastTwoButtons.forEach(btn => {
                        btn.classList.remove('active');
                    });
                };
                
                t9LastTwoResetButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9LastTwoResetButton.onclick();
                }, { passive: false });
            }
            
            // Skip button
            if (t9LastTwoSkipButton) {
                t9LastTwoSkipButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('t9LastTwoFeature').classList.add('completed');
                    document.getElementById('t9LastTwoFeature').dispatchEvent(new Event('completed'));
                };
                
                t9LastTwoSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9LastTwoSkipButton.onclick();
                }, { passive: false });
            }
            break;
        }
        case 't9OneLie': {
            let selectedDigits = [];
            const t9OneLieButtons = document.querySelectorAll('.t9-one-lie-btn');
            const t9OneLieDisplay = document.getElementById('t9OneLieString');
            const t9OneLiePossibleDigitsList = document.getElementById('t9OneLiePossibleDigitsList');
            const t9OneLieSubmitButton = document.getElementById('t9OneLieSubmitButton');
            const t9OneLieResetButton = document.getElementById('t9OneLieResetButton');
            const t9OneLieSkipButton = document.getElementById('t9OneLieSkipButton');
            
            // Function to update the possible digits display
            const updatePossibleDigits = () => {
                if (t9OneLiePossibleDigitsList) {
                    const blankIndex = selectedDigits.indexOf('BLANK');
                    if (blankIndex !== -1 && selectedDigits.length === 4) {
                        const possibleDigits = calculatePossibleT9DigitsForBlank(currentFilteredWords, selectedDigits);
                        if (possibleDigits.length > 0) {
                            t9OneLiePossibleDigitsList.textContent = possibleDigits.join(', ');
                        } else {
                            t9OneLiePossibleDigitsList.textContent = 'None found';
                        }
                    } else {
                        t9OneLiePossibleDigitsList.textContent = '-';
                    }
                }
            };
            
            // Initialize display
            if (t9OneLieDisplay) {
                t9OneLieDisplay.textContent = '-';
            }
            if (t9OneLiePossibleDigitsList) {
                t9OneLiePossibleDigitsList.textContent = '-';
            }
            
            // Number button handlers
            t9OneLieButtons.forEach(btn => {
                btn.onclick = () => {
                    if (selectedDigits.length < 4) {
                        const digit = btn.dataset.digit;
                        selectedDigits.push(digit);
                        if (t9OneLieDisplay) {
                            // Build display with red "B" for BLANK
                            const displayHTML = selectedDigits.map(d => {
                                if (d === 'BLANK') {
                                    return '<span style="color: #f44336; font-weight: bold;">B</span>';
                                }
                                return d;
                            }).join('');
                            t9OneLieDisplay.innerHTML = displayHTML;
                        }
                        btn.classList.add('active');
                        
                        // Update possible digits display
                        updatePossibleDigits();
                    }
                };
                
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (selectedDigits.length < 4) {
                        const digit = btn.dataset.digit;
                        selectedDigits.push(digit);
                        if (t9OneLieDisplay) {
                            // Build display with red "B" for BLANK
                            const displayHTML = selectedDigits.map(d => {
                                if (d === 'BLANK') {
                                    return '<span style="color: #f44336; font-weight: bold;">B</span>';
                                }
                                return d;
                            }).join('');
                            t9OneLieDisplay.innerHTML = displayHTML;
                        }
                        btn.classList.add('active');
                        
                        // Update possible digits display
                        updatePossibleDigits();
                    }
                }, { passive: false });
            });
            
            // Submit button
            if (t9OneLieSubmitButton) {
                t9OneLieSubmitButton.onclick = () => {
                    if (selectedDigits.length !== 4) {
                        alert('Please select exactly 4 digits (or use BLANK)');
                        return;
                    }
                    
                    // Calculate T9 strings if not already done
                    calculateT9Strings(currentFilteredWords);
                    
                    // Store data for "B" feature if BLANK is used
                    const blankIndex = selectedDigits.indexOf('BLANK');
                    if (blankIndex !== -1) {
                        t9OneLieBlankIndex = blankIndex;
                        t9OneLieSelectedDigits = [...selectedDigits];
                        t9OneLiePossibleDigits = calculatePossibleT9DigitsForBlank(currentFilteredWords, selectedDigits);
                    } else {
                        // Clear if no BLANK
                        t9OneLieBlankIndex = null;
                        t9OneLieSelectedDigits = [];
                        t9OneLiePossibleDigits = [];
                    }
                    
                    const filteredWords = filterWordsByT9OneLie(currentFilteredWords, selectedDigits);
                    callback(filteredWords);
                    document.getElementById('t9OneLieFeature').classList.add('completed');
                    document.getElementById('t9OneLieFeature').dispatchEvent(new Event('completed'));
                };
                
                t9OneLieSubmitButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9OneLieSubmitButton.onclick();
                }, { passive: false });
            }
            
            // Reset button
            if (t9OneLieResetButton) {
                t9OneLieResetButton.onclick = () => {
                    selectedDigits = [];
                    if (t9OneLieDisplay) {
                        t9OneLieDisplay.textContent = '-';
                    }
                    if (t9OneLiePossibleDigitsList) {
                        t9OneLiePossibleDigitsList.textContent = '-';
                    }
                    t9OneLieButtons.forEach(btn => {
                        btn.classList.remove('active');
                    });
                };
                
                t9OneLieResetButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9OneLieResetButton.onclick();
                }, { passive: false });
            }
            
            // Skip button
            if (t9OneLieSkipButton) {
                t9OneLieSkipButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('t9OneLieFeature').classList.add('completed');
                    document.getElementById('t9OneLieFeature').dispatchEvent(new Event('completed'));
                };
                
                t9OneLieSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9OneLieSkipButton.onclick();
                }, { passive: false });
            }
            break;
        }
        case 't9Repeat': {
            const t9RepeatYesBtn = document.getElementById('t9RepeatYesBtn');
            const t9RepeatNoBtn = document.getElementById('t9RepeatNoBtn');
            const t9RepeatSkipBtn = document.getElementById('t9RepeatSkipBtn');
            
            if (t9RepeatYesBtn) {
                t9RepeatYesBtn.onclick = () => {
                    calculateT9Strings(currentFilteredWords);
                    const filteredWords = filterWordsByT9Repeat(currentFilteredWords, true);
                    callback(filteredWords);
                    document.getElementById('t9RepeatFeature').classList.add('completed');
                    document.getElementById('t9RepeatFeature').dispatchEvent(new Event('completed'));
                };
                
                t9RepeatYesBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9RepeatYesBtn.onclick();
                }, { passive: false });
            }
            
            if (t9RepeatNoBtn) {
                t9RepeatNoBtn.onclick = () => {
                    calculateT9Strings(currentFilteredWords);
                    const filteredWords = filterWordsByT9Repeat(currentFilteredWords, false);
                    callback(filteredWords);
                    document.getElementById('t9RepeatFeature').classList.add('completed');
                    document.getElementById('t9RepeatFeature').dispatchEvent(new Event('completed'));
                };
                
                t9RepeatNoBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9RepeatNoBtn.onclick();
                }, { passive: false });
            }
            
            if (t9RepeatSkipBtn) {
                t9RepeatSkipBtn.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('t9RepeatFeature').classList.add('completed');
                    document.getElementById('t9RepeatFeature').dispatchEvent(new Event('completed'));
                };
                
                t9RepeatSkipBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9RepeatSkipBtn.onclick();
                }, { passive: false });
            }
            break;
        }
        case 't9Higher': {
            const t9HigherYesBtn = document.getElementById('t9HigherYesBtn');
            const t9HigherNoBtn = document.getElementById('t9HigherNoBtn');
            const t9HigherSameBtn = document.getElementById('t9HigherSameBtn');
            const t9HigherSkipBtn = document.getElementById('t9HigherSkipBtn');
            
            if (t9HigherYesBtn) {
                t9HigherYesBtn.onclick = () => {
                    calculateT9Strings(currentFilteredWords);
                    const filteredWords = filterWordsByT9Higher(currentFilteredWords, 'yes');
                    callback(filteredWords);
                    document.getElementById('t9HigherFeature').classList.add('completed');
                    document.getElementById('t9HigherFeature').dispatchEvent(new Event('completed'));
                };
                
                t9HigherYesBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9HigherYesBtn.onclick();
                }, { passive: false });
            }
            
            if (t9HigherNoBtn) {
                t9HigherNoBtn.onclick = () => {
                    calculateT9Strings(currentFilteredWords);
                    const filteredWords = filterWordsByT9Higher(currentFilteredWords, 'no');
                    callback(filteredWords);
                    document.getElementById('t9HigherFeature').classList.add('completed');
                    document.getElementById('t9HigherFeature').dispatchEvent(new Event('completed'));
                };
                
                t9HigherNoBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9HigherNoBtn.onclick();
                }, { passive: false });
            }
            
            if (t9HigherSameBtn) {
                t9HigherSameBtn.onclick = () => {
                    calculateT9Strings(currentFilteredWords);
                    const filteredWords = filterWordsByT9Higher(currentFilteredWords, 'same');
                    callback(filteredWords);
                    document.getElementById('t9HigherFeature').classList.add('completed');
                    document.getElementById('t9HigherFeature').dispatchEvent(new Event('completed'));
                };
                
                t9HigherSameBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9HigherSameBtn.onclick();
                }, { passive: false });
            }
            
            if (t9HigherSkipBtn) {
                t9HigherSkipBtn.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('t9HigherFeature').classList.add('completed');
                    document.getElementById('t9HigherFeature').dispatchEvent(new Event('completed'));
                };
                
                t9HigherSkipBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9HigherSkipBtn.onclick();
                }, { passive: false });
            }
            break;
        }
        case 't9OneTruth': {
            let selectedDigits = [];
            const t9OneTruthButtons = document.querySelectorAll('.t9-one-truth-btn');
            const t9OneTruthDisplay = document.getElementById('t9OneTruthString');
            const t9OneTruthPossibleDigitsList = document.getElementById('t9OneTruthPossibleDigitsList');
            const t9OneTruthSubmitButton = document.getElementById('t9OneTruthSubmitButton');
            const t9OneTruthResetButton = document.getElementById('t9OneTruthResetButton');
            const t9OneTruthSkipButton = document.getElementById('t9OneTruthSkipButton');
            
            // Function to update the possible digits display
            const updatePossibleDigits = () => {
                if (t9OneTruthPossibleDigitsList) {
                    const blankIndex = selectedDigits.indexOf('BLANK');
                    if (blankIndex !== -1 && selectedDigits.length === 4) {
                        const possibleDigits = calculatePossibleT9DigitsForBlankTruth(currentFilteredWords, selectedDigits);
                        if (possibleDigits.length > 0) {
                            t9OneTruthPossibleDigitsList.textContent = possibleDigits.join(', ');
                        } else {
                            t9OneTruthPossibleDigitsList.textContent = 'None found';
                        }
                    } else {
                        t9OneTruthPossibleDigitsList.textContent = '-';
                    }
                }
            };
            
            // Initialize display
            if (t9OneTruthDisplay) {
                t9OneTruthDisplay.textContent = '-';
            }
            if (t9OneTruthPossibleDigitsList) {
                t9OneTruthPossibleDigitsList.textContent = '-';
            }
            
            // Number button handlers
            t9OneTruthButtons.forEach(btn => {
                btn.onclick = () => {
                    if (selectedDigits.length < 4) {
                        const digit = btn.dataset.digit;
                        selectedDigits.push(digit);
                        if (t9OneTruthDisplay) {
                            // Build display with red "B" for BLANK
                            const displayHTML = selectedDigits.map(d => {
                                if (d === 'BLANK') {
                                    return '<span style="color: #f44336; font-weight: bold;">B</span>';
                                }
                                return d;
                            }).join('');
                            t9OneTruthDisplay.innerHTML = displayHTML;
                        }
                        btn.classList.add('active');
                        
                        // Update possible digits display
                        updatePossibleDigits();
                    }
                };
                
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (selectedDigits.length < 4) {
                        const digit = btn.dataset.digit;
                        selectedDigits.push(digit);
                        if (t9OneTruthDisplay) {
                            // Build display with red "B" for BLANK
                            const displayHTML = selectedDigits.map(d => {
                                if (d === 'BLANK') {
                                    return '<span style="color: #f44336; font-weight: bold;">B</span>';
                                }
                                return d;
                            }).join('');
                            t9OneTruthDisplay.innerHTML = displayHTML;
                        }
                        btn.classList.add('active');
                        
                        // Update possible digits display
                        updatePossibleDigits();
                    }
                }, { passive: false });
            });
            
            // Submit button
            if (t9OneTruthSubmitButton) {
                t9OneTruthSubmitButton.onclick = () => {
                    if (selectedDigits.length !== 4) {
                        alert('Please select exactly 4 digits (or use BLANK)');
                        return;
                    }
                    
                    // Calculate T9 strings if not already done
                    calculateT9Strings(currentFilteredWords);
                    
                    const filteredWords = filterWordsByT9OneTruth(currentFilteredWords, selectedDigits);
                    callback(filteredWords);
                    document.getElementById('t9OneTruthFeature').classList.add('completed');
                    document.getElementById('t9OneTruthFeature').dispatchEvent(new Event('completed'));
                };
                
                t9OneTruthSubmitButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9OneTruthSubmitButton.onclick();
                }, { passive: false });
            }
            
            // Reset button
            if (t9OneTruthResetButton) {
                t9OneTruthResetButton.onclick = () => {
                    selectedDigits = [];
                    if (t9OneTruthDisplay) {
                        t9OneTruthDisplay.textContent = '-';
                    }
                    if (t9OneTruthPossibleDigitsList) {
                        t9OneTruthPossibleDigitsList.textContent = '-';
                    }
                    t9OneTruthButtons.forEach(btn => {
                        btn.classList.remove('active');
                    });
                };
                
                t9OneTruthResetButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9OneTruthResetButton.onclick();
                }, { passive: false });
            }
            
            // Skip button
            if (t9OneTruthSkipButton) {
                t9OneTruthSkipButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('t9OneTruthFeature').classList.add('completed');
                    document.getElementById('t9OneTruthFeature').dispatchEvent(new Event('completed'));
                };
                
                t9OneTruthSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9OneTruthSkipButton.onclick();
                }, { passive: false });
            }
            break;
        }
        case 't9B': {
            // Validate that this follows 1 LIE (L4) with BLANK
            if (t9OneLieBlankIndex === null || t9OneLiePossibleDigits.length === 0) {
                alert('B feature must follow 1 LIE (L4) with a BLANK. Please use 1 LIE (L4) with BLANK first.');
                callback(currentFilteredWords);
                document.getElementById('t9BFeature').classList.add('completed');
                document.getElementById('t9BFeature').dispatchEvent(new Event('completed'));
                break;
            }
            
            const t9BButtons = document.querySelectorAll('.t9-b-btn');
            const t9BSkipButton = document.getElementById('t9BSkipButton');
            
            // Add click handlers for digit buttons
            t9BButtons.forEach(btn => {
                btn.onclick = () => {
                    const digit = btn.dataset.digit;
                    
                    // Calculate T9 strings if not already done
                    calculateT9Strings(currentFilteredWords);
                    
                    const filteredWords = filterWordsByT9B(currentFilteredWords, digit);
                    callback(filteredWords);
                    document.getElementById('t9BFeature').classList.add('completed');
                    document.getElementById('t9BFeature').dispatchEvent(new Event('completed'));
                };
                
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    btn.onclick();
                }, { passive: false });
            });
            
            // Skip button
            if (t9BSkipButton) {
                t9BSkipButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('t9BFeature').classList.add('completed');
                    document.getElementById('t9BFeature').dispatchEvent(new Event('completed'));
                };
                
                t9BSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    t9BSkipButton.onclick();
                }, { passive: false });
            }
            break;
        }
        case 'alphaNumeric': {
            const alphaNumericYesBtn = document.getElementById('alphaNumericYesBtn');
            const alphaNumericNoBtn = document.getElementById('alphaNumericNoBtn');
            const alphaNumericSkipBtn = document.getElementById('alphaNumericSkipBtn');
            
            if (alphaNumericYesBtn) {
                alphaNumericYesBtn.onclick = () => {
                    const filteredWords = filterWordsByAlphaNumeric(currentFilteredWords, true);
                    callback(filteredWords);
                    document.getElementById('alphaNumericFeature').classList.add('completed');
                    document.getElementById('alphaNumericFeature').dispatchEvent(new Event('completed'));
                };
                
                alphaNumericYesBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    alphaNumericYesBtn.onclick();
                }, { passive: false });
            }
            
            if (alphaNumericNoBtn) {
                alphaNumericNoBtn.onclick = () => {
                    const filteredWords = filterWordsByAlphaNumeric(currentFilteredWords, false);
                    callback(filteredWords);
                    document.getElementById('alphaNumericFeature').classList.add('completed');
                    document.getElementById('alphaNumericFeature').dispatchEvent(new Event('completed'));
                };
                
                alphaNumericNoBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    alphaNumericNoBtn.onclick();
                }, { passive: false });
            }
            
            if (alphaNumericSkipBtn) {
                alphaNumericSkipBtn.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('alphaNumericFeature').classList.add('completed');
                    document.getElementById('alphaNumericFeature').dispatchEvent(new Event('completed'));
                };
                
                alphaNumericSkipBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    alphaNumericSkipBtn.onclick();
                }, { passive: false });
            }
            break;
        }
        case 'lettersAbove': {
            const lettersAboveButton = document.getElementById('lettersAboveButton');
            const lettersAboveInput = document.getElementById('lettersAboveInput');
            const lettersAboveSkipButton = document.getElementById('lettersAboveSkipButton');
            
            if (lettersAboveButton && lettersAboveInput) {
                lettersAboveButton.onclick = () => {
                    const count = lettersAboveInput.value.trim();
                    if (count === '' || isNaN(parseInt(count, 10))) {
                        alert('Please enter a valid number (0-26)');
                        return;
                    }
                    
                    const numCount = parseInt(count, 10);
                    if (numCount < 0 || numCount > 26) {
                        alert('Please enter a number between 0 and 26');
                        return;
                    }
                    
                    const filteredWords = filterWordsByLettersAbove(currentFilteredWords, count);
                    callback(filteredWords);
                    document.getElementById('lettersAboveFeature').classList.add('completed');
                    document.getElementById('lettersAboveFeature').dispatchEvent(new Event('completed'));
                };
                
                lettersAboveButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    lettersAboveButton.onclick();
                }, { passive: false });
            }
            
            if (lettersAboveSkipButton) {
                lettersAboveSkipButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('lettersAboveFeature').classList.add('completed');
                    document.getElementById('lettersAboveFeature').dispatchEvent(new Event('completed'));
                };
                
                lettersAboveSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    lettersAboveSkipButton.onclick();
                }, { passive: false });
            }
            break;
        }
        case 'dictionaryAlpha': {
            const sectionBtns = document.querySelectorAll('#dictionaryAlphaFeature .section-btn');
            const dictionaryAlphaSkipButton = document.getElementById('dictionaryAlphaSkipButton');
            
            // Section button handlers - auto-submit on click
            sectionBtns.forEach(btn => {
                btn.onclick = () => {
                    const section = btn.dataset.section;
                    // Visual feedback
                    sectionBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // Immediately filter and progress
                    const filteredWords = filterWordsByDictionaryAlpha(currentFilteredWords, section);
                    callback(filteredWords);
                    document.getElementById('dictionaryAlphaFeature').classList.add('completed');
                    document.getElementById('dictionaryAlphaFeature').dispatchEvent(new Event('completed'));
                };
                
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    btn.onclick();
                }, { passive: false });
            });
            
            // Skip button
            if (dictionaryAlphaSkipButton) {
                dictionaryAlphaSkipButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('dictionaryAlphaFeature').classList.add('completed');
                    document.getElementById('dictionaryAlphaFeature').dispatchEvent(new Event('completed'));
                };
                
                dictionaryAlphaSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    dictionaryAlphaSkipButton.onclick();
                }, { passive: false });
            }
            break;
        }
        
        case 'smlLength': {
            const categoryBtns = document.querySelectorAll('#smlLengthFeature .section-btn');
            const smlLengthSkipButton = document.getElementById('smlLengthSkipButton');
            
            // Category button handlers - auto-submit on click
            categoryBtns.forEach(btn => {
                btn.onclick = () => {
                    const category = btn.dataset.section;
                    // Visual feedback
                    categoryBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // Immediately filter and progress
                    const filteredWords = filterWordsBySmlLength(currentFilteredWords, category);
                    callback(filteredWords);
                    document.getElementById('smlLengthFeature').classList.add('completed');
                    document.getElementById('smlLengthFeature').dispatchEvent(new Event('completed'));
                };
                
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    btn.onclick();
                }, { passive: false });
            });
            
            // Skip button
            if (smlLengthSkipButton) {
                smlLengthSkipButton.onclick = () => {
                    callback(currentFilteredWords);
                    document.getElementById('smlLengthFeature').classList.add('completed');
                    document.getElementById('smlLengthFeature').dispatchEvent(new Event('completed'));
                };
                
                smlLengthSkipButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    smlLengthSkipButton.onclick();
                }, { passive: false });
            }
            break;
        }
        case 'findEee': {
            const letterBtns = Array.from(document.querySelectorAll('.find-eee-btn'));
            const positionBtns = Array.from(document.querySelectorAll('.find-eee-position-btn'));
            const skipBtn = document.getElementById('findEeeSkipButton');
            let selectedLetter = null;
            let selectedPosition = null;

            // Reset all buttons
            letterBtns.forEach(btn => {
                btn.classList.remove('active');
                btn.onclick = () => {
                    const letter = btn.dataset.letter;
                    
                    // Select the letter
                    letterBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    selectedLetter = letter;
                    
                    console.log('Letter selected:', letter, 'Button classes:', btn.className);
                    
                    // Filter immediately by letter only
                    const filteredWords = filterWordsByFindEee(currentFilteredWords, letter, null);
                    callback(filteredWords);
                };
                // Touch event for mobile
                btn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    btn.onclick();
                }, { passive: false });
            });

            positionBtns.forEach(btn => {
                btn.classList.remove('active');
                btn.onclick = () => {
                    const position = parseInt(btn.dataset.position);
                    
                    // Select the position
                    positionBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    selectedPosition = position;
                    
                    console.log('Position selected:', position, 'Button classes:', btn.className);
                    
                    // If both letter and position are selected, apply filter and move to next feature
                    if (selectedLetter && selectedPosition) {
                        const filteredWords = filterWordsByFindEee(currentFilteredWords, selectedLetter, selectedPosition);
                        callback(filteredWords);
                        
                        // Move to next feature automatically
                        const featureDiv = document.getElementById('findEeeFeature');
                        featureDiv.classList.add('completed');
                        featureDiv.dispatchEvent(new Event('completed'));
                    }
                };
                // Touch event for mobile
                btn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    btn.onclick();
                }, { passive: false });
            });

            if (skipBtn) {
                skipBtn.onclick = () => {
                    // If letter is selected but no position, keep the letter filter
                    if (selectedLetter && !selectedPosition) {
                        // Keep current filtered words (letter filter already applied)
                        callback(currentFilteredWords);
                    } else if (!selectedLetter && !selectedPosition) {
                        // Nothing selected, no changes to wordlist
                        callback(currentFilteredWords);
                    }
                    
                    const featureDiv = document.getElementById('findEeeFeature');
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                };
                skipBtn.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    skipBtn.onclick();
                }, { passive: false });
            }
            break;
        }
        
        case 'positionCons': {
            const positionInput = document.getElementById('positionConsPosition');
            const countInput = document.getElementById('positionConsCount');
            const lettersInput = document.getElementById('positionConsLetters');
            const submitBtn = document.getElementById('positionConsSubmit');
            const useCurrentBtn = document.getElementById('positionConsUseCurrent');
            const generateBtn = document.getElementById('positionConsGenerate');
            const messageDiv = document.getElementById('positionConsMessage');
            
            // Real-time letter sanitization
            if (lettersInput) {
                lettersInput.addEventListener('input', (e) => {
                    const sanitized = sanitizeLetterString(e.target.value);
                    if (sanitized !== e.target.value) {
                        e.target.value = sanitized;
                    }
                });
                
                // Ensure input is easily focusable on touch
                lettersInput.addEventListener('touchstart', (e) => {
                    e.stopPropagation();
                    lettersInput.focus();
                }, { passive: true });
                
                lettersInput.addEventListener('touchend', (e) => {
                    e.stopPropagation();
                    lettersInput.focus();
                }, { passive: true });
            }
            
            // Make position and count inputs easily focusable
            if (positionInput) {
                positionInput.addEventListener('touchstart', (e) => {
                    e.stopPropagation();
                    positionInput.focus();
                }, { passive: true });
                
                positionInput.addEventListener('touchend', (e) => {
                    e.stopPropagation();
                    positionInput.focus();
                }, { passive: true });
            }
            
            if (countInput) {
                countInput.addEventListener('touchstart', (e) => {
                    e.stopPropagation();
                    countInput.focus();
                }, { passive: true });
                
                countInput.addEventListener('touchend', (e) => {
                    e.stopPropagation();
                    countInput.focus();
                }, { passive: true });
            }
            
            // Use Last Letters button
            if (useCurrentBtn) {
                useCurrentBtn.onclick = () => {
                    if (lastPositionConsLetters) {
                        if (lettersInput) {
                            lettersInput.value = lastPositionConsLetters;
                        }
                        if (messageDiv) {
                            messageDiv.textContent = 'Loaded last used letters';
                            messageDiv.style.color = '#4CAF50';
                            setTimeout(() => {
                                messageDiv.textContent = '';
                            }, 2000);
                        }
                    } else {
                        if (messageDiv) {
                            messageDiv.textContent = 'No last letters available';
                            messageDiv.style.color = '#f44336';
                            setTimeout(() => {
                                messageDiv.textContent = '';
                            }, 2000);
                        }
                    }
                };
                useCurrentBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    useCurrentBtn.onclick();
                }, { passive: false });
            }
            
            // Random Letters button
            if (generateBtn) {
                generateBtn.onclick = () => {
                    const requestedPosition = parseInt(positionInput?.value);
                    const positionIsValid = !isNaN(requestedPosition) && requestedPosition >= 1 && requestedPosition <= 6;
                    const effectivePosition = positionIsValid ? requestedPosition : Math.floor(Math.random() * 6) + 1;
                    const generated = generateStructuredLetterString(effectivePosition);
                    if (lettersInput) {
                        lettersInput.value = generated;
                    }
                    lastPositionConsGeneratedLetters = generated;
                    if (messageDiv) {
                        messageDiv.textContent = `Generated letters for position ${effectivePosition}`;
                        messageDiv.style.color = '#4CAF50';
                        setTimeout(() => {
                            messageDiv.textContent = '';
                        }, 2000);
                    }
                };
                generateBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    generateBtn.onclick();
                }, { passive: false });
            }
            
            // FILTER button
            if (submitBtn) {
                submitBtn.onclick = () => {
                    const positionRaw = positionInput?.value?.trim() || '';
                    const hasPositionValue = positionRaw.length > 0;
                    const parsedPosition = parseInt(positionRaw);
                    const positionIsValid = !isNaN(parsedPosition) && parsedPosition >= 1 && parsedPosition <= 6;
                    const resolvedPosition = hasPositionValue ? (positionIsValid ? parsedPosition : null) : null;
                    const letterCount = parseInt(countInput?.value);
                    const letters = lettersInput?.value || '';
                    
                    // Validation
                    if (hasPositionValue && !positionIsValid) {
                        if (messageDiv) {
                            messageDiv.textContent = 'Please enter a valid position (1-6)';
                            messageDiv.style.color = '#f44336';
                            setTimeout(() => {
                                messageDiv.textContent = '';
                            }, 2000);
                        }
                        return;
                    }
                    
                    if (letterCount === null || letterCount < 0 || isNaN(letterCount)) {
                        if (messageDiv) {
                            messageDiv.textContent = 'Please enter a valid letter count (0 or more)';
                            messageDiv.style.color = '#f44336';
                            setTimeout(() => {
                                messageDiv.textContent = '';
                            }, 2000);
                        }
                        return;
                    }
                    
                    const sanitizedLetters = sanitizeLetterString(letters);
                    if (!sanitizedLetters) {
                        if (messageDiv) {
                            messageDiv.textContent = 'Please enter at least one letter';
                            messageDiv.style.color = '#f44336';
                            setTimeout(() => {
                                messageDiv.textContent = '';
                            }, 2000);
                        }
                        return;
                    }
                    
                    // Store for "Use Last Letters" button
                    lastPositionConsLetters = sanitizedLetters;
                    
                    // Filter words
                    const filteredWords = filterWordsByPositionCons(currentFilteredWords, {
                        position: resolvedPosition,
                        letters: sanitizedLetters,
                        letterCount
                    });
                    
                    callback(filteredWords);
                    
                    // Show result message
                    if (messageDiv) {
                        const scopeText = resolvedPosition ? `position ${resolvedPosition}` : 'all positions';
                        messageDiv.textContent = `Filtered to ${filteredWords.length} words (${scopeText})`;
                        messageDiv.style.color = '#4CAF50';
                    }
                    
                    // Complete feature
                    const featureDiv = document.getElementById('positionConsFeature');
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                };
                
                submitBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    submitBtn.onclick();
                }, { passive: false });
                
                // Enter key support
                if (lettersInput) {
                    lettersInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            submitBtn.onclick();
                        }
                    });
                }
                if (positionInput) {
                    positionInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            submitBtn.onclick();
                        }
                    });
                }
                if (countInput) {
                    countInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            submitBtn.onclick();
                        }
                    });
                }
            }
            break;
        }
        
        case 'firstCurved': {
            const positionInput = document.getElementById('firstCurvedPosition');
            const submitButton = document.getElementById('firstCurvedSubmit');
            const messageElement = document.getElementById('firstCurvedMessage');

            const setMessage = (text = '', isError = false) => {
                if (messageElement) {
                    messageElement.textContent = text;
                    messageElement.style.color = isError ? '#f44336' : '#4CAF50';
                }
            };

            const handleSubmit = () => {
                setMessage('');
                const positionValue = parseInt(positionInput?.value, 10);
                if (Number.isNaN(positionValue) || positionValue < 1) {
                    setMessage('Position must be a positive number.', true);
                    return;
                }

                const filteredWords = filterWordsByFirstCurved(currentFilteredWords, positionValue);

                if (filteredWords.length === 0) {
                    setMessage('No matches found.', true);
                } else {
                    setMessage(`${filteredWords.length} matches found.`);
                }

                callback(filteredWords);
                
                // Complete feature
                const featureDiv = document.getElementById('firstCurvedFeature');
                if (featureDiv) {
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                }
            };

            if (submitButton) {
                submitButton.addEventListener('click', handleSubmit);
                submitButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    handleSubmit();
                }, { passive: false });
            }
            
            // Enter key support
            if (positionInput) {
                positionInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        handleSubmit();
                    }
                });
                
                // Make input easily focusable on touch
                positionInput.addEventListener('touchstart', (e) => {
                    e.stopPropagation();
                    positionInput.focus();
                }, { passive: true });
                
                positionInput.addEventListener('touchend', (e) => {
                    e.stopPropagation();
                    positionInput.focus();
                }, { passive: true });
            }
            break;
        }
        
        case 'pin': {
            const wordInputs = [
                document.getElementById('pinWord1'),
                document.getElementById('pinWord2'),
                document.getElementById('pinWord3'),
                document.getElementById('pinWord4'),
                document.getElementById('pinWord5'),
                document.getElementById('pinWord6')
            ];
            const codeInput = document.getElementById('pinCode');
            const submitButton = document.getElementById('pinSubmit');
            const messageElement = document.getElementById('pinMessage');

            const setMessage = (text = '', isError = false) => {
                if (messageElement) {
                    messageElement.textContent = text;
                    messageElement.style.color = isError ? '#f44336' : '#4CAF50';
                }
            };

            const handleSubmit = () => {
                setMessage('');
                
                // Get non-empty word boxes
                const wordBoxes = wordInputs
                    .map(input => (input?.value || '').trim())
                    .filter(word => word.length > 0);
                
                if (wordBoxes.length === 0) {
                    setMessage('Enter at least one word.', true);
                    return;
                }
                
                // Get and validate code
                const codeValue = (codeInput?.value || '').trim();
                if (!codeValue) {
                    setMessage('Enter a code.', true);
                    return;
                }
                
                // Extract digits only, max 6
                const digitsOnly = codeValue.replace(/[^0-9]/g, '').slice(0, 6);
                if (!digitsOnly) {
                    setMessage('Code must contain at least one digit.', true);
                    return;
                }
                
                // Validate code length matches number of non-empty boxes
                if (digitsOnly.length < wordBoxes.length) {
                    setMessage(`Code must have at least ${wordBoxes.length} digits for ${wordBoxes.length} word(s).`, true);
                    return;
                }
                
                // Filter words
                const filteredWords = filterWordsByPin(currentFilteredWords, wordInputs.map(input => input?.value || ''), digitsOnly);
                
                if (filteredWords.length === 0) {
                    setMessage('No matches found.', true);
                } else {
                    setMessage(`${filteredWords.length} matches found.`);
                }
                
                callback(filteredWords);
                
                // Complete feature
                const featureDiv = document.getElementById('pinFeature');
                if (featureDiv) {
                    featureDiv.classList.add('completed');
                    featureDiv.dispatchEvent(new Event('completed'));
                }
            };

            if (submitButton) {
                submitButton.addEventListener('click', handleSubmit);
                submitButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    handleSubmit();
                }, { passive: false });
            }
            
            // Auto-uppercase word inputs (not case-sensitive)
            wordInputs.forEach(input => {
                if (input) {
                    input.addEventListener('input', () => {
                        const value = input.value;
                        const upperValue = value.toUpperCase();
                        if (value !== upperValue) {
                            input.value = upperValue;
                        }
                    });
                    
                    // Make inputs easily focusable on touch
                    input.addEventListener('touchstart', (e) => {
                        e.stopPropagation();
                        input.focus();
                    }, { passive: true });
                    
                    input.addEventListener('touchend', (e) => {
                        e.stopPropagation();
                        input.focus();
                    }, { passive: true });
                    
                    // Enter key support
                    input.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            handleSubmit();
                        }
                    });
                }
            });
            
            // Restrict code input to digits only
            if (codeInput) {
                codeInput.addEventListener('input', () => {
                    const value = codeInput.value;
                    const digitsOnly = value.replace(/[^0-9]/g, '').slice(0, 6);
                    if (value !== digitsOnly) {
                        codeInput.value = digitsOnly;
                    }
                });
                
                // Make input easily focusable on touch
                codeInput.addEventListener('touchstart', (e) => {
                    e.stopPropagation();
                    codeInput.focus();
                }, { passive: true });
                
                codeInput.addEventListener('touchend', (e) => {
                    e.stopPropagation();
                    codeInput.focus();
                }, { passive: true });
                
                // Enter key support
                codeInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        handleSubmit();
                    }
                });
            }
            break;
        }
    }
}

// Function to display results
function displayResults(words) {
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) {
        console.error('Results container not found');
        return;
    }
    
    console.log('Displaying results in container:', resultsContainer);
    
    // Clear the results container
    resultsContainer.innerHTML = '';
    
    if (words.length === 0) {
        resultsContainer.innerHTML = '<p>No words match the current criteria.</p>';
        updateWordCount(0);
        return;
    }
    
    // Update word count first
    updateWordCount(words.length);
    updateExportButtonState(words);
    
    // Calculate T9 strings if needed (for click functionality when 20 or fewer words)
    const shouldEnableClicks = words.length <= 20;
    if (shouldEnableClicks) {
        calculateT9Strings(words);
    }
    
    // For large lists, use virtual scrolling approach
    if (words.length > 1000) {
        // Show first 1000 words with a "show more" option
        const initialWords = words.slice(0, 1000);
        const remainingCount = words.length - 1000;
        
        // Create HTML string for initial words (much faster than individual DOM elements)
        const wordListHTML = initialWords.map(word => `<li>${word}</li>`).join('');
        
        resultsContainer.innerHTML = `
            <ul class="word-list">
                ${wordListHTML}
            </ul>
            <div class="load-more-container" style="text-align: center; margin: 20px 0;">
                <button id="loadMoreBtn" class="load-more-btn" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Show ${remainingCount.toLocaleString()} more words
                </button>
            </div>
        `;
        
        // Add event listener for load more button
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                // Show all words
                const allWordsHTML = words.map(word => `<li>${word}</li>`).join('');
                resultsContainer.innerHTML = `
                    <ul class="word-list">
                        ${allWordsHTML}
                    </ul>
                `;
            });
        }
    } else {
        // For smaller lists, show all words at once using innerHTML
        const wordListHTML = words.map(word => {
            if (shouldEnableClicks) {
                // Make clickable with data attribute to store original word
                return `<li class="word-clickable" data-word="${word}" style="cursor: pointer;">${word}</li>`;
            } else {
                return `<li>${word}</li>`;
            }
        }).join('');
        
        resultsContainer.innerHTML = `
            <ul class="word-list">
                ${wordListHTML}
            </ul>
        `;
        
        // Add click handlers for words if 20 or fewer
        if (shouldEnableClicks) {
            const wordElements = resultsContainer.querySelectorAll('.word-clickable');
            wordElements.forEach(li => {
                li.addEventListener('click', (e) => {
                    const word = li.dataset.word;
                    const t9String = t9StringsMap.get(word) || wordToT9(word);
                    
                    // Highlight first 4 digits in red
                    const firstFour = t9String.substring(0, 4);
                    const rest = t9String.substring(4);
                    
                    // Replace text with T9 string, highlighting first 4 in red
                    li.innerHTML = `<span style="color: red; font-weight: bold;">${firstFour}</span>${rest}`;
                    
                    // Copy to clipboard
                    navigator.clipboard.writeText(t9String).then(() => {
                        // Optional: Show brief feedback
                        li.style.backgroundColor = '#d4edda'; // Light green to indicate copied
                        setTimeout(() => {
                            li.style.backgroundColor = '';
                        }, 300);
                    }).catch(err => {
                        console.error('Failed to copy to clipboard:', err);
                    });
                });
            });
        }
    }
    
    // Ensure the feature area is empty and visible
    const featureArea = document.getElementById('featureArea');
    if (featureArea) {
        featureArea.style.display = 'block';
        // Clear any wordlist that might have been accidentally added to the feature area
        if (featureArea.querySelector('.word-list')) {
            featureArea.innerHTML = '';
        }
    }
}

// Function to update word count
function updateWordCount(count) {
    let wordCountDisplay = document.getElementById('wordCountDisplay');
    
    // Create the display if it doesn't exist
    if (!wordCountDisplay) {
        wordCountDisplay = document.createElement('div');
        wordCountDisplay.id = 'wordCountDisplay';
        wordCountDisplay.className = 'word-count-display';
        document.body.appendChild(wordCountDisplay);
    }
    
    wordCountDisplay.textContent = count;
}

// Add CSS for word count display
const style = document.createElement('style');
style.textContent = `
    .word-count-display {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.75);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 16px;
        font-weight: bold;
        z-index: 1000;
        min-width: 40px;
        text-align: center;
    }
`;
document.head.appendChild(style);

// Function to handle vowel selection
function handleVowelSelection(includeVowel) {
    const currentVowel = uniqueVowels[currentVowelIndex];
    console.log('Handling vowel selection:', currentVowel, 'Include:', includeVowel);
    
    if (includeVowel) {
        currentFilteredWordsForVowels = currentFilteredWordsForVowels.filter(word => 
            word.toLowerCase().includes(currentVowel)
        );
        } else {
        currentFilteredWordsForVowels = currentFilteredWordsForVowels.filter(word => 
            !word.toLowerCase().includes(currentVowel)
        );
    }
    
    // Move to next vowel
    currentVowelIndex++;
    
    // Update the display with the filtered words
    displayResults(currentFilteredWordsForVowels);
    
    // If we still have vowels to process, show the next one
    if (currentVowelIndex < uniqueVowels.length) {
        const vowelFeature = document.getElementById('vowelFeature');
        const vowelLetter = vowelFeature.querySelector('.vowel-letter');
        vowelLetter.textContent = uniqueVowels[currentVowelIndex].toUpperCase();
        vowelLetter.style.display = 'inline-block';
    } else {
        // No more vowels to process, mark as completed
        const vowelFeature = document.getElementById('vowelFeature');
        vowelFeature.classList.add('completed');
        // Update currentFilteredWords with the vowel-filtered results
        currentFilteredWords = [...currentFilteredWordsForVowels];
        
        // Hide vowel feature
        vowelFeature.style.display = 'none';
        
        // Reset both lexicon states
        lexiconCompleted = false;
        originalLexCompleted = false;
        
        // Dispatch the completed event
        console.log('Dispatching vowel feature completed event');
        const completedEvent = new Event('completed');
        vowelFeature.dispatchEvent(completedEvent);
        
        // Show next feature
        showNextFeature();
    }
}

// Function to filter words by O? feature
function filterWordsByO(words, includeO) {
    console.log('Filtering words by O? mode:', includeO ? 'YES' : 'NO');
    
    const filteredWords = words.filter(word => {
        const hasO = word.toLowerCase().includes('o');
        return includeO ? hasO : !hasO;
    });
    
    return filteredWords;
}

// Function to filter words by COLOUR3
function filterWordsByColour3(words) {
    const colour3Letters = new Set(['A', 'B', 'C', 'E', 'G', 'I', 'L', 'N', 'M', 'O', 'P', 'R', 'S', 'T', 'V', 'W', 'Y']);
    
    const filteredWords = words.filter(word => {
        // Check only position 5 (0-based index 4)
        const pos5 = word.length > 4 ? word[4].toUpperCase() : null;
        return pos5 && colour3Letters.has(pos5);
    });
    
    return filteredWords;
}

// Function to show next feature
function showNextFeature() {
    const features = [
        'position1Feature',
        'vowelFeature',
        'oFeature',
        'lexiconFeature',
        'eeeFeature',
        'eeeFirstFeature',
        'lengthFeature',
        'mostFrequentFeature',
        'leastFrequentFeature',
        'notInFeature',
        'abcdeFeature',
        'abcFeature',
    ];
    
    // Hide all features first
    features.forEach(feature => {
        const element = document.getElementById(feature);
        if (element) {
            element.style.display = 'none';
        }
    });
    
    // Show the first non-completed feature
    if (!document.getElementById('position1Feature').classList.contains('completed')) {
        document.getElementById('position1Feature').style.display = 'block';
    }
    else if (!document.getElementById('vowelFeature').classList.contains('completed')) {
        document.getElementById('vowelFeature').style.display = 'block';
    }
    else if (!document.getElementById('oFeature').classList.contains('completed')) {
        document.getElementById('oFeature').style.display = 'block';
    }
    else if (!document.getElementById('lexiconFeature').classList.contains('completed')) {
        document.getElementById('lexiconFeature').style.display = 'block';
    }
    else if (!document.getElementById('eeeFeature').classList.contains('completed')) {
        document.getElementById('eeeFeature').style.display = 'block';
    }
    else if (!document.getElementById('eeeFirstFeature').classList.contains('completed')) {
        document.getElementById('eeeFirstFeature').style.display = 'block';
    }
    else if (!document.getElementById('lengthFeature').classList.contains('completed')) {
        document.getElementById('lengthFeature').style.display = 'block';
    }
    else if (!document.getElementById('mostFrequentFeature').classList.contains('completed')) {
        document.getElementById('mostFrequentFeature').style.display = 'block';
    }
    else if (!document.getElementById('leastFrequentFeature').classList.contains('completed')) {
        document.getElementById('leastFrequentFeature').style.display = 'block';
    }
    else if (!document.getElementById('notInFeature').classList.contains('completed')) {
        document.getElementById('notInFeature').style.display = 'block';
    }
    else if (!document.getElementById('abcdeFeature').classList.contains('completed')) {
        document.getElementById('abcdeFeature').style.display = 'block';
    }
    else if (!document.getElementById('abcFeature').classList.contains('completed')) {
        document.getElementById('abcFeature').style.display = 'block';
    }
    else {
        expandWordList();
    }
}

// Function to expand word list
function expandWordList() {
    const wordListContainer = document.getElementById('wordListContainer');
    wordListContainer.classList.add('expanded');
}

// Function to reset the app
function resetApp() {
    // Reset all variables
    currentFilteredWords = [...originalFilteredWords];
    currentVowelIndex = 0;
    uniqueVowels = [];
    hasAdjacentConsonants = null;
    selectedCurvedLetter = null;
    hasO = null;
    currentFilteredWordsForVowels = [];
    currentPosition1Word = '';
    originalLexCompleted = false;
    lexiconCompleted = false;
    eeeCompleted = false;
    
    // Clear all results and show full wordlist
    displayResults(originalFilteredWords);
    
    // Reset all features
    const features = [
        'consonantQuestion',
        'position1Feature',
        'vowelFeature',
        'colour3Feature',
        'shapeFeature',
        'oFeature',
        'curvedFeature',
        'lexiconFeature',
        'originalLexFeature',
        'eeeFeature',
        'eeeFirstFeature',
        'lengthFeature',
        'mostFrequentFeature',
        'leastFrequentFeature',
        'notInFeature',
        'abcdeFeature',
        'abcFeature',
    ];
    
    features.forEach(featureId => {
        const feature = document.getElementById(featureId);
        if (feature) {
            feature.classList.remove('completed');
            feature.style.display = 'none';
        }
    });
    
    // Reset all input fields
    document.getElementById('position1Input').value = '';
    document.getElementById('originalLexInput').value = '';
    document.getElementById('lexiconInput').value = '';
    document.getElementById('notInInput').value = '';
    
    // Show the first feature (consonant question)
    document.getElementById('consonantQuestion').style.display = 'block';
    
    // Remove export button if it exists
    const exportButton = document.getElementById('exportButton');
    if (exportButton) {
        exportButton.remove();
    }
}

// Function to check if a word has any adjacent consonants
function hasWordAdjacentConsonants(word) {
    const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
    const wordLower = word.toLowerCase();
    
    for (let i = 0; i < wordLower.length - 1; i++) {
        const currentChar = wordLower[i];
        const nextChar = wordLower[i + 1];
        
        // Check if both current and next characters are consonants
        if (!vowels.has(currentChar) && !vowels.has(nextChar)) {
            return true;
        }
    }
    return false;
}

// Letter shape categories with exact categorization
const letterShapes = {
    straight: new Set(['A', 'E', 'F', 'H', 'I', 'K', 'L', 'M', 'N', 'T', 'V', 'W', 'X', 'Y', 'Z']),
    curved: new Set(['B', 'C', 'D', 'G', 'J', 'O', 'P', 'Q', 'R', 'S', 'U'])
};

// Function to get letter shape
function getLetterShape(letter) {
    letter = letter.toUpperCase();
    if (letterShapes.straight.has(letter)) return 'straight';
    if (letterShapes.curved.has(letter)) return 'curved';
    return null;
}

// Function to filter words by shape category
function filterWordsByShape(words, position, category) {
    return words.filter(word => {
        if (word.length <= position) return false;
        const letter = word[position];
        return getLetterShape(letter) === category;
    });
}

// Function to update shape display
function updateShapeDisplay(words) {
    const shapeFeature = document.getElementById('shapeFeature');
    const shapeDisplay = shapeFeature.querySelector('.shape-display');
    
    if (!isShapeMode || words.length === 0) {
        shapeFeature.style.display = 'none';
        return;
    }
    
    // Get the length of the shortest word to avoid out-of-bounds
    const shortestLength = Math.min(...words.map(word => word.length));
    
    // Analyze all positions in the words
    const startPos = 0;
    const endPos = shortestLength;
    
    const position = findLeastVariancePosition(words, startPos, endPos);
    
    if (position === -1) {
        shapeFeature.style.display = 'none';
        return;
    }
    
    currentPosition = position;
    const analysis = analyzePositionShapes(words, position);
    const shapes = analysis.shapes;
    
    const positionDisplay = shapeDisplay.querySelector('.position-display');
    positionDisplay.textContent = `Position ${position + 1}`;
    
    const categoryButtons = shapeDisplay.querySelector('.category-buttons');
    categoryButtons.innerHTML = '';
    
    Object.entries(shapes).forEach(([category, letters]) => {
        if (letters.size > 0) {
            const button = document.createElement('button');
            button.className = 'category-button';
            const percentage = Math.round(analysis.distribution[category] * 100);
            button.textContent = `${category.toUpperCase()} (${percentage}%)`;
            button.addEventListener('click', () => {
                const filteredWords = filterWordsByShape(words, position, category);
                displayResults(filteredWords);
                expandWordList();
            });
            categoryButtons.appendChild(button);
        }
    });
    
    shapeFeature.style.display = 'block';
}

// Function to analyze position shapes
function analyzePositionShapes(words, position) {
    const shapes = {
        straight: new Set(),
        curved: new Set()
    };
    
    let totalLetters = 0;
    
    words.forEach(word => {
        if (word.length > position) {
            const letter = word[position];
            const shape = getLetterShape(letter);
            if (shape) {
                shapes[shape].add(letter);
                totalLetters++;
            }
        }
    });
    
    const distribution = {
        straight: shapes.straight.size / totalLetters,
        curved: shapes.curved.size / totalLetters
    };
    
    return {
        shapes,
        distribution,
        totalLetters
    };
}

// Function to find position with least variance
function findLeastVariancePosition(words, startPos, endPos) {
    let maxVariance = -1;
    let result = -1;
    
    for (let pos = startPos; pos < endPos; pos++) {
        const analysis = analyzePositionShapes(words, pos);
        
        // Skip if we don't have at least one letter of each shape
        if (analysis.shapes.straight.size === 0 || analysis.shapes.curved.size === 0) {
            continue;
        }
        
        // Calculate variance between the two distributions
        const variance = Math.abs(analysis.distribution.straight - analysis.distribution.curved);
        
        if (variance > maxVariance) {
            maxVariance = variance;
            result = pos;
        }
    }
    
    return result;
}

// Function to find position with most variance
function findPositionWithMostVariance(words) {
    // Initialize array to store unique letters for each position
    const positionLetters = Array(5).fill().map(() => new Set());
    
    // Collect unique letters for each position
    words.forEach(word => {
        for (let i = 0; i < Math.min(5, word.length); i++) {
            positionLetters[i].add(word[i].toUpperCase());
        }
    });
    
    // Find position with most unique letters
    let maxVariance = -1;
    let result = -1;
    let resultLetters = [];
    
    positionLetters.forEach((letters, index) => {
        if (letters.size > maxVariance) {
            maxVariance = letters.size;
            result = index;
            resultLetters = Array.from(letters).sort();
        }
    });
    
    return {
        position: result,
        letters: resultLetters
    };
}

// Function to filter words by original lex
function filterWordsByOriginalLex(words, position, letter) {
    return words.filter(word => {
        if (word.length <= position) return false;
        return word[position].toUpperCase() === letter.toUpperCase();
    });
}

// Function to filter words by EEE? feature
function filterWordsByEee(words, mode) {
    return words.filter(word => {
        if (word.length < 2) return false;
        
        const secondChar = word[1].toUpperCase();
        
        switch(mode) {
            case 'E':
                return secondChar === 'E';
                
            case 'YES':
                const yesLetters = new Set(['B', 'C', 'D', 'G', 'P', 'T', 'V', 'Z']);
                return yesLetters.has(secondChar);
                
            case 'NO':
                const noLetters = new Set(['B', 'C', 'D', 'G', 'P', 'T', 'V', 'Z']);
                return !noLetters.has(secondChar);
        }
    });
}

// Function to filter words by EEEFIRST feature
function filterWordsByEeeFirst(words, mode) {
    return words.filter(word => {
        if (word.length < 1) return false;
        
        const firstChar = word[0].toUpperCase();
        
        switch(mode) {
            case 'E':
                return firstChar === 'E';
                
            case 'YES':
                const yesLetters = new Set(['B', 'C', 'D', 'G', 'P', 'T', 'V', 'Z']);
                return yesLetters.has(firstChar);
                
            case 'NO':
                const noLetters = new Set(['B', 'C', 'D', 'G', 'P', 'T', 'V', 'Z']);
                return !noLetters.has(firstChar);
        }
    });
}

// Function to filter words by LEXICON feature
function filterWordsByLexicon(words, positions) {
    const curvedLetters = new Set(['B', 'C', 'D', 'G', 'J', 'O', 'P', 'Q', 'R', 'S', 'U']);
    
    // Special case: if input is "0", filter for words with all straight letters in first 5 positions
    if (positions === "0") {
        return words.filter(word => {
            // Check first 5 positions (or word length if shorter)
            for (let i = 0; i < Math.min(5, word.length); i++) {
                if (curvedLetters.has(word[i].toUpperCase())) {
                    return false;
                }
            }
            return true;
        });
    }
    
    // Convert positions string to array of numbers
    const positionArray = positions.split('').map(Number);
    
    return words.filter(word => {
        // Skip words shorter than 5 characters
        if (word.length < 5) return false;
        
        // Check each position from 1 to 5
        for (let i = 0; i < 5; i++) {
            const pos = i + 1; // Convert to 1-based position
            const letter = word[i].toUpperCase();
            const isCurved = curvedLetters.has(letter);
            
            if (positionArray.includes(pos)) {
                // This position should have a curved letter
                if (!isCurved) return false;
    } else {
                // This position should have a straight letter
                if (isCurved) return false;
            }
        }
        
        return true;
    });
}

// Function to get consonants in order
function getConsonantsInOrder(str) {
    const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
    const consonants = [];
    const word = str.toLowerCase();
    
    for (let i = 0; i < word.length; i++) {
        if (!vowels.has(word[i])) {
            consonants.push(word[i]);
        }
    }
    
    return consonants;
}

// Function to get unique vowels
function getUniqueVowels(str) {
    const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
    const uniqueVowels = new Set();
    str.toLowerCase().split('').forEach(char => {
        if (vowels.has(char)) {
            uniqueVowels.add(char);
        }
    });
    return Array.from(uniqueVowels);
}

// Function to find least common vowel
function findLeastCommonVowel(words, vowels) {
    const vowelCounts = {};
    vowels.forEach(vowel => {
        vowelCounts[vowel] = 0;
    });

    words.forEach(word => {
        const wordLower = word.toLowerCase();
        vowels.forEach(vowel => {
            if (wordLower.includes(vowel)) {
                vowelCounts[vowel]++;
            }
        });
    });

    let leastCommonVowel = vowels[0];
    let lowestCount = vowelCounts[vowels[0]];

    vowels.forEach(vowel => {
        if (vowelCounts[vowel] < lowestCount) {
            lowestCount = vowelCounts[vowel];
            leastCommonVowel = vowel;
        }
    });

    return leastCommonVowel;
}

// Function to toggle mode
function toggleMode() {
    isNewMode = true; // Default to new mode
    resetApp();
}

// Function to toggle feature
function toggleFeature(featureId) {
    // Default all features to enabled
    isColour3Mode = true;
    isVowelMode = true;
    isShapeMode = true;
    
    // Update the display
        showNextFeature();
}

function filterWordsByPosition1(words, consonants) {
    if (!consonants || consonants.length < 2) return words;
    
    return words.filter(word => {
                        const wordLower = word.toLowerCase();
                        
        if (hasAdjacentConsonants) {
            // YES to Consonants Together: look for the specific consonant pairs together
                        // Create all possible pairs of consonants from the input word
                        const consonantPairs = [];
                        for (let i = 0; i < consonants.length; i++) {
                            for (let j = i + 1; j < consonants.length; j++) {
                                consonantPairs.push([consonants[i], consonants[j]]);
                            }
                        }
                        
                        // Check if any of the consonant pairs appear together in the word
                        for (const [con1, con2] of consonantPairs) {
                            const pair1 = con1 + con2;
                            const pair2 = con2 + con1;
                            if (wordLower.includes(pair1) || wordLower.includes(pair2)) {
                                return true;
                            }
                        }
                        return false;
                } else {
                    // NO to Consonants Together: look for ANY pair of consonants in middle 5/6 characters
                        const wordLength = wordLower.length;
                        
                        // Determine middle section length (5 for odd, 6 for even)
                        const middleLength = wordLength % 2 === 0 ? 6 : 5;
                        const startPos = Math.floor((wordLength - middleLength) / 2);
                        const middleSection = wordLower.slice(startPos, startPos + middleLength);
                        
                        // Create all possible pairs of consonants from the input word
                        const consonantPairs = [];
                        for (let i = 0; i < consonants.length; i++) {
                            for (let j = i + 1; j < consonants.length; j++) {
                                consonantPairs.push([consonants[i], consonants[j]]);
                            }
                        }
                        
                        // Check if ANY pair of consonants appears in the middle section
                        for (const [con1, con2] of consonantPairs) {
                            if (middleSection.includes(con1) && middleSection.includes(con2)) {
                                return true;
                            }
                        }
                        return false;
        }
    });
}

function filterWordsByConsMid(words, letters) {
    if (!letters || letters.length < 2) return words;
    
    return words.filter(word => {
        const wordLower = word.toLowerCase();
        
        // Check if the word contains ALL of the letters from the input
        for (const letter of letters) {
            if (!wordLower.includes(letter)) {
                return false;
            }
        }
        return true;
    });
}

function filterWordsByConsMid2(words, consonants) {
    if (!consonants || consonants.length < 2) return words;
    
    return words.filter(word => {
        const wordLower = word.toLowerCase();
        
        // Skip words that are too short (need at least 3 characters for middle positions)
        if (wordLower.length < 3) return false;
        
        // Get middle positions (exclude first and last character)
        const middlePositions = wordLower.slice(1, -1);
        
        // Create a copy of consonants to track which ones we've found
        const consonantsToFind = [...consonants];
        
        // Check each middle position for consonants
        for (const char of middlePositions) {
            const consonantIndex = consonantsToFind.indexOf(char);
            if (consonantIndex !== -1) {
                // Remove the found consonant from our search list
                consonantsToFind.splice(consonantIndex, 1);
            }
        }
        
        // Return true if we found all consonants
        return consonantsToFind.length === 0;
    });
}

// Function to display saved workflows in the workflow builder
function displaySavedWorkflows() {
    const savedWorkflowsContainer = document.getElementById('savedWorkflows');
    if (!savedWorkflowsContainer) {
        console.error('Saved workflows container not found');
        return;
    }
    
    // Clear existing content
    savedWorkflowsContainer.innerHTML = '';
    
    // Create list container
    const workflowList = document.createElement('div');
    workflowList.className = 'saved-workflow-list';
    
    // Add each workflow
    workflows.forEach(workflow => {
        const workflowItem = document.createElement('div');
        workflowItem.className = 'saved-workflow-item';
        
        // Workflow name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = workflow.name;
        nameSpan.className = 'workflow-name';
        nameSpan.onclick = () => editWorkflow(workflow);
        workflowItem.appendChild(nameSpan);
        
        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '×';
        deleteButton.className = 'delete-workflow';
        deleteButton.onclick = (e) => {
            e.stopPropagation();
            deleteWorkflow(workflow);
        };
        workflowItem.appendChild(deleteButton);
        
        workflowList.appendChild(workflowItem);
    });
    
    savedWorkflowsContainer.appendChild(workflowList);
}

// Function to toggle saved workflows visibility
function toggleSavedWorkflows() {
    let modal = document.getElementById('savedWorkflowsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'savedWorkflowsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Saved Workflows</h2>
                    <button class="close-button" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="savedWorkflowsList"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add close button functionality with both click and touch events
        const closeButton = modal.querySelector('.close-button');
        const closeModal = (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };
        closeButton.addEventListener('click', closeModal);
        closeButton.addEventListener('touchstart', closeModal, { passive: false });

        // Close modal when clicking/touching outside
        const closeOnOutside = (e) => {
            if (e.target === modal) {
                e.preventDefault();
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }
        };
        modal.addEventListener('click', closeOnOutside);
        modal.addEventListener('touchstart', closeOnOutside, { passive: false });

        // Prevent body scrolling when modal is open
        modal.addEventListener('touchmove', (e) => {
            if (e.target === modal) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    // Display the modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Update the workflows list
    const workflowsList = document.getElementById('savedWorkflowsList');
    workflowsList.innerHTML = '';

    if (workflows.length === 0) {
        workflowsList.innerHTML = '<p class="no-workflows">No saved workflows yet.</p>';
        return;
    }

    // Create list of workflows
    workflows.forEach(workflow => {
        const workflowItem = document.createElement('div');
        workflowItem.className = 'workflow-item';
        workflowItem.setAttribute('role', 'button');
        workflowItem.setAttribute('tabindex', '0');
        
        const workflowInfo = document.createElement('div');
        workflowInfo.className = 'workflow-info';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'workflow-name';
        nameSpan.textContent = workflow.name;
        
        const stepsSpan = document.createElement('span');
        stepsSpan.className = 'workflow-steps';
        stepsSpan.textContent = workflow.steps.map(step => step.feature).join(' → ');
        
        workflowInfo.appendChild(nameSpan);
        workflowInfo.appendChild(stepsSpan);
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-workflow';
        deleteButton.textContent = '×';
        deleteButton.setAttribute('aria-label', `Delete workflow ${workflow.name}`);
        
        // Handle delete with both click and touch events
        const handleDelete = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${workflow.name}"?`)) {
                const index = workflows.findIndex(w => w.name === workflow.name);
                if (index !== -1) {
                    workflows.splice(index, 1);
                    localStorage.setItem('workflows', JSON.stringify(workflows));
                    
                    const workflowSelect = document.getElementById('workflowSelect');
                    if (workflowSelect) {
                        const option = workflowSelect.querySelector(`option[value="${workflow.name}"]`);
                        if (option) option.remove();
                    }
                    
                    workflowItem.remove();
                    
                    if (workflows.length === 0) {
                        workflowsList.innerHTML = '<p class="no-workflows">No saved workflows yet.</p>';
                    }
                }
            }
        };
        
        deleteButton.addEventListener('click', handleDelete);
        deleteButton.addEventListener('touchstart', handleDelete, { passive: false });
        
        workflowItem.appendChild(workflowInfo);
        workflowItem.appendChild(deleteButton);
        workflowsList.appendChild(workflowItem);
    });
}

// Function to edit a workflow
function editWorkflow(workflow) {
    // Set workflow name
    const workflowNameInput = document.getElementById('workflowName');
    if (workflowNameInput) {
        workflowNameInput.value = workflow.name;
    }
    
    // Clear existing selected features
    const selectedFeaturesList = document.getElementById('selectedFeaturesList');
    if (selectedFeaturesList) {
        selectedFeaturesList.innerHTML = '';
    }
    
    // Add workflow steps to selected features
    workflow.steps.forEach(step => {
        const featureItem = document.createElement('div');
        featureItem.className = 'selected-feature-item';
        // Add T9 class if it's a T9 feature
        if (step.feature.startsWith('t9')) {
            featureItem.classList.add('t9-selected-feature');
        }
        // Add Alpha-Numeric class if it's an Alpha-Numeric feature
        if (step.feature === 'alphaNumeric' || step.feature === 'lettersAbove') {
            featureItem.classList.add('alphanumeric-selected-feature');
        }
        featureItem.setAttribute('data-feature', step.feature);
        featureItem.draggable = true;
        
        const featureName = document.createElement('span');
        featureName.textContent = step.feature.toUpperCase();
        featureItem.appendChild(featureName);
        

        
        // Add drag and drop for reordering
        featureItem.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', step.feature);
            e.dataTransfer.effectAllowed = 'move';
            featureItem.classList.add('dragging');
        });
        
        featureItem.addEventListener('dragend', () => {
            featureItem.classList.remove('dragging');
        });
        
        selectedFeaturesList.appendChild(featureItem);
    });
    
    // Show workflow creation page
    showWorkflowCreation();
}

// Function to delete a workflow
function deleteWorkflow(workflow) {
    if (confirm(`Are you sure you want to delete the workflow "${workflow.name}"?`)) {
        // Remove from workflows array
        const index = workflows.findIndex(w => w.id === workflow.id);
        if (index !== -1) {
            workflows.splice(index, 1);
            
            // Update localStorage
            localStorage.setItem('workflows', JSON.stringify(workflows));
            
            // Update workflow select dropdown
            const workflowSelect = document.getElementById('workflowSelect');
            if (workflowSelect) {
                const option = workflowSelect.querySelector(`option[value="${workflow.name}"]`);
                if (option) {
                    option.remove();
                }
            }
            
            // Update saved workflows display
            displaySavedWorkflows();
        }
    }
}

// Initialize drag and drop functionality
function initializeDragAndDrop() {
    const availableFeatures = document.getElementById('availableFeatures');
    const selectedFeatures = document.getElementById('selectedFeaturesList');
    
    // Add drag events to available features
    const featureButtons = availableFeatures.querySelectorAll('.feature-button');
    featureButtons.forEach(button => {
        button.addEventListener('dragstart', handleDragStart);
        button.addEventListener('dragend', handleDragEnd);
    });

    // Add drop events to selected features container
    selectedFeatures.addEventListener('dragover', handleDragOver);
    selectedFeatures.addEventListener('dragenter', handleDragEnter);
    selectedFeatures.addEventListener('dragleave', handleDragLeave);
    selectedFeatures.addEventListener('drop', handleDrop);
}

function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.feature);
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    const selectedFeatures = document.getElementById('selectedFeaturesList');
    selectedFeatures.classList.add('drag-over');
}

function handleDragLeave(e) {
    const selectedFeatures = document.getElementById('selectedFeaturesList');
    selectedFeatures.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    const selectedFeatures = document.getElementById('selectedFeaturesList');
    selectedFeatures.classList.remove('drag-over');
    
    const featureType = e.dataTransfer.getData('text/plain');
    const featureButton = document.querySelector(`.feature-button[data-feature="${featureType}"]`);
    
    if (featureButton && !isFeatureAlreadySelected(featureType)) {
        addFeatureToSelected(featureType);
    }
}

function isFeatureAlreadySelected(featureType) {
    const selectedFeatures = document.getElementById('selectedFeaturesList');
    // Allow multiple instances of MOST FREQUENT, LEAST FREQUENT, and POSITION-CONS
    if (featureType === 'mostFrequent' || 
        featureType === 'leastFrequent' || 
        featureType === 'positionCons') {
        return false;
    }
    // For all other features, maintain the single instance rule
    return selectedFeatures.querySelector(`[data-feature="${featureType}"]`) !== null;
}

function addFeatureToSelected(featureType) {
    const selectedFeatures = document.getElementById('selectedFeaturesList');
    const featureButton = document.querySelector(`.feature-button[data-feature="${featureType}"]`);
    
    const selectedFeature = document.createElement('div');
    selectedFeature.className = 'selected-feature-item';
    // Add T9 class if it's a T9 feature
    if (featureType.startsWith('t9')) {
        selectedFeature.classList.add('t9-selected-feature');
    }
    // Add Alpha-Numeric class if it's an Alpha-Numeric feature
    if (featureType === 'alphaNumeric' || featureType === 'lettersAbove') {
        selectedFeature.classList.add('alphanumeric-selected-feature');
    }
    selectedFeature.dataset.feature = featureType;
    
    const featureName = document.createElement('span');
    featureName.textContent = featureButton.textContent;
    selectedFeature.appendChild(featureName);
    
    // Add click event to remove feature
    selectedFeature.addEventListener('click', () => {
        selectedFeature.remove();
        adjustSelectedFeaturesHeight();
    });
    
    // Add touch event for mobile
    selectedFeature.addEventListener('touchstart', (e) => {
        e.preventDefault();
        selectedFeature.remove();
        adjustSelectedFeaturesHeight();
    }, { passive: false });
    
    selectedFeatures.appendChild(selectedFeature);
    adjustSelectedFeaturesHeight();
}

function adjustSelectedFeaturesHeight() {
    const selectedFeatures = document.getElementById('selectedFeaturesList');
    const featureItems = selectedFeatures.querySelectorAll('.selected-feature-item');
    const totalFeatures = featureItems.length;
    
    // Base height is 48px, minimum height is 24px (50% reduction)
    const baseHeight = 48;
    const minHeight = 24;
    
    if (totalFeatures <= 3) {
        // Normal height for 3 or fewer features
        featureItems.forEach(item => {
            item.style.minHeight = '48px';
            item.style.padding = '12px 16px';
        });
    } else if (totalFeatures <= 6) {
        // Slight reduction for 4-6 features
        featureItems.forEach(item => {
            item.style.minHeight = '40px';
            item.style.padding = '10px 14px';
        });
    } else if (totalFeatures <= 10) {
        // Medium reduction for 7-10 features
        featureItems.forEach(item => {
            item.style.minHeight = '32px';
            item.style.padding = '8px 12px';
        });
    } else {
        // Maximum reduction (50%) for 10+ features
        featureItems.forEach(item => {
            item.style.minHeight = '24px';
            item.style.padding = '6px 10px';
        });
    }
}

function removeFeature(featureType) {
    const selectedFeature = document.querySelector(`.selected-feature-item[data-feature="${featureType}"]`);
    if (selectedFeature) {
        selectedFeature.remove();
    }
}

// Initialize drag and drop when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeDragAndDrop();
    
    // Initialize scroll indicator
    const scrollIndicator = document.getElementById('scrollIndicator');
    const availableFeatures = document.getElementById('availableFeatures');
    
    if (scrollIndicator && availableFeatures) {
        // Check if scrolling is needed
        const checkScrollNeeded = () => {
            const isScrollable = availableFeatures.scrollHeight > availableFeatures.clientHeight;
            scrollIndicator.classList.toggle('hidden', !isScrollable);
        };
        
        // Check on load
        checkScrollNeeded();
        
        // Check on resize
        window.addEventListener('resize', checkScrollNeeded);
        
        // Handle scroll indicator click
        scrollIndicator.addEventListener('click', () => {
            console.log('Scroll indicator clicked');
            console.log('availableFeatures:', availableFeatures);
            console.log('scrollHeight:', availableFeatures.scrollHeight, 'clientHeight:', availableFeatures.clientHeight);
            availableFeatures.scrollTo({
                top: availableFeatures.scrollHeight,
                behavior: 'smooth'
            });
        });
        
        // Hide indicator when scrolled to bottom
        availableFeatures.addEventListener('scroll', () => {
            const isAtBottom = availableFeatures.scrollTop + availableFeatures.clientHeight >= availableFeatures.scrollHeight - 10;
            scrollIndicator.classList.toggle('hidden', isAtBottom);
        });
    } else {
        if (!scrollIndicator) console.log('Scroll indicator button not found');
        if (!availableFeatures) console.log('Available features container not found');
    }
    
    // Improve LENGTH input touch sensitivity
    const lengthInput = document.getElementById('lengthInput');
    if (lengthInput) {
        lengthInput.setAttribute('tabindex', '0');
        lengthInput.addEventListener('touchstart', function(e) {
            e.stopPropagation();
            this.focus();
        }, { passive: false });
        lengthInput.addEventListener('click', function() {
            this.focus();
        });
    }
    // ... existing code ...
});

// Re-initialize drag and drop when new content is added
function reinitializeDragAndDrop() {
    initializeDragAndDrop();
}

// Initialize feature selection functionality
function initializeFeatureSelection() {
    const availableFeatures = document.getElementById('availableFeatures');
    const selectedFeaturesList = document.getElementById('selectedFeaturesList');
    
    if (availableFeatures) {
        const featureButtons = availableFeatures.querySelectorAll('.feature-button');
        
        featureButtons.forEach(button => {
            // Remove existing event listeners
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            // Track touch state for scroll detection
            let touchStartX = 0;
            let touchStartY = 0;
            let touchStartTime = 0;
            let hasMoved = false;
            
            // Add click event (desktop)
            newButton.addEventListener('click', () => {
                const featureType = newButton.dataset.feature;
                if (!isFeatureAlreadySelected(featureType)) {
                    addFeatureToSelected(featureType);
                }
            });
            
            // Track touch start
            newButton.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
                hasMoved = false;
            }, { passive: true });
            
            // Track touch move to detect scrolling
            newButton.addEventListener('touchmove', (e) => {
                if (!hasMoved) {
                    const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
                    const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
                    // If moved more than 10px, consider it a scroll
                    if (deltaX > 10 || deltaY > 10) {
                        hasMoved = true;
                    }
                }
            }, { passive: true });
            
            // Handle touch end - only trigger if it was a tap, not a scroll
            newButton.addEventListener('touchend', (e) => {
                const touchEndTime = Date.now();
                const touchDuration = touchEndTime - touchStartTime;
                
                // Only trigger if:
                // 1. Touch didn't move significantly (not a scroll)
                // 2. Touch duration was short (less than 300ms - indicates a tap)
                if (!hasMoved && touchDuration < 300) {
                    e.preventDefault();
                    const featureType = newButton.dataset.feature;
                if (!isFeatureAlreadySelected(featureType)) {
                    addFeatureToSelected(featureType);
                }
                }
                
                // Reset state
                hasMoved = false;
            }, { passive: false });
        });
    }
}

function isFeatureAlreadySelected(featureType) {
    const selectedFeatures = document.getElementById('selectedFeaturesList');
    // Allow multiple instances of MOST FREQUENT and LEAST FREQUENT features
    if (featureType === 'mostFrequent' || featureType === 'leastFrequent') {
        // Check if the feature was just added (within the last 500ms)
        const lastAdded = selectedFeatures.getAttribute('lastAdded');
        const lastAddedTime = selectedFeatures.getAttribute('lastAddedTime');
        const now = Date.now();
        
        if (lastAdded === featureType && lastAddedTime && (now - parseInt(lastAddedTime)) < 500) {
            return true;
        }
        
        selectedFeatures.setAttribute('lastAdded', featureType);
        selectedFeatures.setAttribute('lastAddedTime', now.toString());
        return false;
    }
    // For all other features, maintain the single instance rule
    return selectedFeatures.querySelector(`[data-feature="${featureType}"]`) !== null;
}

function addFeatureToSelected(featureType) {
    const selectedFeatures = document.getElementById('selectedFeaturesList');
    const featureButton = document.querySelector(`.feature-button[data-feature="${featureType}"]`);
    
    if (!featureButton) return;
    
    const selectedFeature = document.createElement('div');
    selectedFeature.className = 'selected-feature-item';
    // Add T9 class if it's a T9 feature
    if (featureType.startsWith('t9')) {
        selectedFeature.classList.add('t9-selected-feature');
    }
    // Add Alpha-Numeric class if it's an Alpha-Numeric feature
    if (featureType === 'alphaNumeric' || featureType === 'lettersAbove') {
        selectedFeature.classList.add('alphanumeric-selected-feature');
    }
    selectedFeature.dataset.feature = featureType;
    
    const featureName = document.createElement('span');
    featureName.textContent = featureButton.textContent;
    selectedFeature.appendChild(featureName);
    
    // Add click event to remove feature
    selectedFeature.addEventListener('click', () => {
        selectedFeature.remove();
        adjustSelectedFeaturesHeight();
    });
    
    // Add touch event for mobile
    selectedFeature.addEventListener('touchstart', (e) => {
        e.preventDefault();
        selectedFeature.remove();
        adjustSelectedFeaturesHeight();
    }, { passive: false });
    
    selectedFeatures.appendChild(selectedFeature);
    adjustSelectedFeaturesHeight();
}

// Remove the duplicate addFeatureToList function since we're using addFeatureToSelected
// ... existing code ...

// Track T9 mode state
let isT9Mode = false;

// Track Alpha-Numeric mode state
let isAlphaNumericMode = false;

function showT9Features() {
    isT9Mode = true;
    const availableFeatures = document.getElementById('availableFeatures');
    const normalFeatures = availableFeatures.innerHTML;
    
    // Store normal features (if not already stored)
    if (!availableFeatures.dataset.normalFeatures) {
        availableFeatures.dataset.normalFeatures = normalFeatures;
    }
    
    // Show T9 features
    availableFeatures.innerHTML = `
        <div class="feature-group">
            <button class="feature-button t9-feature-button" data-feature="t9Length" draggable="true">LENGTH</button>
            <button class="info-button" data-feature="t9Length"><i class="fas fa-info-circle"></i></button>
        </div>
        <div class="feature-group">
            <button class="feature-button t9-feature-button" data-feature="t9LastTwo" draggable="true">LAST TWO</button>
            <button class="info-button" data-feature="t9LastTwo"><i class="fas fa-info-circle"></i></button>
        </div>
        <div class="feature-group">
            <button class="feature-button t9-feature-button" data-feature="t9OneLie" draggable="true">1 LIE (L4)</button>
            <button class="info-button" data-feature="t9OneLie"><i class="fas fa-info-circle"></i></button>
        </div>
        <div class="feature-group">
            <button class="feature-button t9-feature-button" data-feature="t9Repeat" draggable="true">Repeat?</button>
            <button class="info-button" data-feature="t9Repeat"><i class="fas fa-info-circle"></i></button>
        </div>
        <div class="feature-group">
            <button class="feature-button t9-feature-button" data-feature="t9Higher" draggable="true">Higher?</button>
            <button class="info-button" data-feature="t9Higher"><i class="fas fa-info-circle"></i></button>
        </div>
        <div class="feature-group">
            <button class="feature-button t9-feature-button" data-feature="t9OneTruth" draggable="true">1 TRUTH (F4)</button>
            <button class="info-button" data-feature="t9OneTruth"><i class="fas fa-info-circle"></i></button>
        </div>
        <div class="feature-group">
            <button class="feature-button t9-feature-button" data-feature="t9B" draggable="true">B-IDENTITY</button>
            <button class="info-button" data-feature="t9B"><i class="fas fa-info-circle"></i></button>
        </div>
    `;
    
    // Show BACK button
    const backButton = document.querySelector('.available-features .back-button');
    if (!backButton) {
        const h3 = document.querySelector('.available-features h3');
        if (h3 && h3.parentElement) {
            const backBtn = document.createElement('button');
            backBtn.className = 'back-button';
            backBtn.textContent = 'BACK';
            backBtn.onclick = showNormalFeatures;
            h3.parentElement.style.position = 'relative';
            h3.parentElement.insertBefore(backBtn, h3);
        }
    }
    
    // Reinitialize feature selection
    initializeFeatureSelection();
}

function showNormalFeatures() {
    isT9Mode = false;
    isAlphaNumericMode = false;
    const availableFeatures = document.getElementById('availableFeatures');
    
    // Restore normal features
    if (availableFeatures.dataset.normalFeatures) {
        availableFeatures.innerHTML = availableFeatures.dataset.normalFeatures;
    }
    
    // Remove BACK button
    const backButton = document.querySelector('.available-features .back-button');
    if (backButton) {
        backButton.remove();
    }
    
    // Reinitialize feature selection
    initializeFeatureSelection();
}

function showAlphaNumericFeatures() {
    isAlphaNumericMode = true;
    const availableFeatures = document.getElementById('availableFeatures');
    const normalFeatures = availableFeatures.innerHTML;
    
    // Store normal features (if not already stored)
    if (!availableFeatures.dataset.normalFeatures) {
        availableFeatures.dataset.normalFeatures = normalFeatures;
    }
    
    // Show Alpha-Numeric features
    availableFeatures.innerHTML = `
        <div class="feature-group">
            <button class="feature-button alphanumeric-feature-button" data-feature="alphaNumeric" draggable="true">AlphaNumeric</button>
            <button class="info-button" data-feature="alphaNumeric"><i class="fas fa-info-circle"></i></button>
        </div>
        <div class="feature-group">
            <button class="feature-button alphanumeric-feature-button" data-feature="lettersAbove" draggable="true">Letters Above</button>
            <button class="info-button" data-feature="lettersAbove"><i class="fas fa-info-circle"></i></button>
        </div>
    `;
    
    // Show BACK button
    const backButton = document.querySelector('.available-features .back-button');
    if (!backButton) {
        const h3 = document.querySelector('.available-features h3');
        if (h3 && h3.parentElement) {
            const backBtn = document.createElement('button');
            backBtn.className = 'back-button';
            backBtn.textContent = 'BACK';
            backBtn.onclick = showNormalFeatures;
            h3.parentElement.style.position = 'relative';
            h3.parentElement.insertBefore(backBtn, h3);
        }
    }
    
    // Reinitialize feature selection
    initializeFeatureSelection();
}

// Initialize feature selection when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeFeatureSelection();
    
    // Initialize T9 mode button
    const t9Button = document.getElementById('t9ModeButton');
    if (t9Button) {
        t9Button.addEventListener('click', showT9Features);
        t9Button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            showT9Features();
        }, { passive: false });
    }
    
    // Initialize Alpha-Numeric mode button
    const alphanumericButton = document.getElementById('alphanumericModeButton');
    if (alphanumericButton) {
        alphanumericButton.addEventListener('click', showAlphaNumericFeatures);
        alphanumericButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            showAlphaNumericFeatures();
        }, { passive: false });
    }
});

// Re-initialize feature selection when new content is added
function reinitializeFeatureSelection() {
    initializeFeatureSelection();
}

// Add CSS for the new elements
const originalLexStyle = document.createElement('style');
originalLexStyle.textContent = `
    .position-info {
        margin: 10px 0;
        padding: 10px;
        background-color: #f5f5f5;
        border-radius: 5px;
    }
    
    .position-display {
        font-weight: bold;
        margin-bottom: 5px;
    }
    
    .possible-letters {
        font-size: 0.9em;
        color: #666;
    }
    
    .letters-list {
        font-family: monospace;
    }
`;
document.head.appendChild(originalLexStyle);

// Add CSS for reset button
const resetButtonStyle = document.createElement('style');
resetButtonStyle.textContent = `
    .reset-workflow-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: rgba(0, 0, 0, 0.75);
        color: white;
        border: none;
        font-size: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        transition: background-color 0.2s;
    }
    
    .reset-workflow-button:hover {
        background-color: rgba(0, 0, 0, 0.9);
    }
    
    .reset-workflow-button:active {
        transform: scale(0.95);
    }
`;
document.head.appendChild(resetButtonStyle);

// Add CSS for home button
const homeButtonStyle = document.createElement('style');
homeButtonStyle.textContent = `
    .home-button {
        background: none;
        border: none;
        color: #333;
        font-size: 24px;
        cursor: pointer;
        padding: 0 10px;
        margin-right: 10px;
        transition: color 0.2s;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    
    .home-button:hover {
        color: #666;
    }
    
    .home-button:active {
        transform: scale(0.95);
    }
`;
document.head.appendChild(homeButtonStyle);

// Update CSS for buttons to improve touch targets
const buttonStyles = document.createElement('style');
buttonStyles.textContent = `
    .reset-workflow-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background-color: rgba(0, 0, 0, 0.75);
        color: white;
        border: none;
        font-size: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        transition: background-color 0.2s;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
    }
    
    .reset-workflow-button:hover {
        background-color: rgba(0, 0, 0, 0.9);
    }
    
    .reset-workflow-button:active {
        transform: scale(0.95);
    }
    
    .home-button {
        background: none;
        border: none;
        color: #333;
        font-size: 24px;
        cursor: pointer;
        padding: 10px;
        margin-right: 10px;
        transition: color 0.2s;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 48px;
        min-height: 48px;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
    }
    
    .home-button:hover {
        color: #666;
    }
    
    .home-button:active {
        transform: scale(0.95);
    }
`;
document.head.appendChild(buttonStyles);

// Add CSS for button consistency
const buttonConsistencyStyle = document.createElement('style');
buttonConsistencyStyle.textContent = `
    #createWorkflowButton {
        width: 200px;
        height: 40px;
        font-size: 16px;
        font-weight: bold;
        padding: 8px 16px;
        margin: 10px;
        border-radius: 4px;
        background-color: #4CAF50;
        color: white;
        border: none;
        cursor: pointer;
        transition: background-color 0.2s;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        box-sizing: border-box;
        line-height: 1;
        white-space: nowrap;
    }
    
    #createWorkflowButton:hover {
        background-color: #45a049;
    }
    
    #performButton {
        width: 200px;
        height: 40px;
        font-size: 16px;
        font-weight: bold;
        padding: 8px 16px;
        margin: 10px;
        border-radius: 4px;
        background-color: #4169E1; /* Royal Blue */
        color: white;
        border: none;
        cursor: pointer;
        transition: background-color 0.2s;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        box-sizing: border-box;
        line-height: 1;
        white-space: nowrap;
    }
    
    #performButton:hover {
        background-color: #1E40AF; /* Darker Royal Blue for hover */
    }
    
    #createWorkflowButton:active, #performButton:active {
        transform: scale(0.98);
    }

    /* Ensure the button container doesn't affect button size */
    .button-container {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
    }

    /* Make dropdown options scrollable */
    .options-list {
        max-height: 200px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #888 #f1f1f1;
    }

    /* Style scrollbar for Webkit browsers */
    .options-list::-webkit-scrollbar {
        width: 8px;
    }

    .options-list::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
    }

    .options-list::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 4px;
    }

    .options-list::-webkit-scrollbar-thumb:hover {
        background: #555;
    }
`;
document.head.appendChild(buttonConsistencyStyle);

// Feature Info Modal Functions
function showFeatureInfo(featureId) {
    console.log('Showing info for feature:', featureId);
    const modal = document.getElementById(`${featureId}Info`);
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        // Prevent background scrolling
        document.body.addEventListener('touchmove', preventScroll, { passive: false });
    } else {
        console.error('Modal not found for feature:', featureId);
    }
}

function hideFeatureInfo(featureId) {
    console.log('Hiding info for feature:', featureId);
    const modal = document.getElementById(`${featureId}Info`);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        document.body.style.overflow = '';
        // Re-enable background scrolling
        document.body.removeEventListener('touchmove', preventScroll);
    }
}

function preventScroll(e) {
    e.preventDefault();
}

// Add event listeners for info buttons
function initializeInfoButtons() {
    console.log('Initializing info buttons');
    // Info button click handlers
    document.querySelectorAll('.info-button').forEach(button => {
        console.log('Adding listeners to button:', button);
        // Remove any existing listeners
        button.removeEventListener('click', handleInfoClick);
        button.removeEventListener('touchend', handleInfoClick);
        
        // Add both click and touch events
        button.addEventListener('click', handleInfoClick);
        button.addEventListener('touchend', handleInfoClick);
    });

    // Close button click handlers
    document.querySelectorAll('.close-info-button').forEach(button => {
        // Remove any existing listeners
        button.removeEventListener('click', handleCloseClick);
        button.removeEventListener('touchend', handleCloseClick);
        
        // Add both click and touch events
        button.addEventListener('click', handleCloseClick);
        button.addEventListener('touchend', handleCloseClick);
    });

    // Close modal when clicking outside
    document.querySelectorAll('.feature-info-modal').forEach(modal => {
        // Remove any existing listeners
        modal.removeEventListener('click', handleOutsideClick);
        modal.removeEventListener('touchend', handleOutsideClick);
        
        // Add both click and touch events
        modal.addEventListener('click', handleOutsideClick);
        modal.addEventListener('touchend', handleOutsideClick);
    });
}

function handleInfoClick(e) {
    console.log('Info button clicked');
    e.preventDefault();
    e.stopPropagation(); // Prevent drag start
    const featureId = this.getAttribute('data-feature');
    console.log('Feature ID:', featureId);
    showFeatureInfo(featureId);
}

function handleCloseClick(e) {
    console.log('Close button clicked');
    e.preventDefault();
    e.stopPropagation();
    const modal = this.closest('.feature-info-modal');
    const featureId = modal.id.replace('Info', '');
    hideFeatureInfo(featureId);
}

function handleOutsideClick(e) {
    console.log('Outside clicked');
    e.preventDefault();
    if (e.target === this) {
        const featureId = this.id.replace('Info', '');
        hideFeatureInfo(featureId);
    }
}

// Initialize info buttons when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing info buttons');
    initializeInfoButtons();
});

// Also initialize info buttons when the workflow creation page is shown
function showWorkflowCreation() {
    document.getElementById('homepage').style.display = 'none';
    document.getElementById('workflowExecution').style.display = 'none';
    document.getElementById('workflowCreation').style.display = 'block';
    
    // Hide saved workflows initially
    const savedWorkflows = document.getElementById('savedWorkflows');
    if (savedWorkflows) {
        savedWorkflows.style.display = 'none';
    }
    
    // Initialize info buttons
    initializeInfoButtons();
}

// Hide workflow creation page
function hideWorkflowCreation() {
    document.getElementById('homepage').style.display = 'block';
    document.getElementById('workflowCreation').style.display = 'none';
    document.getElementById('workflowExecution').style.display = 'none';
}

// Hide native select elements to prevent overlap with custom dropdowns (aggressive)
const hideNativeSelectStyle = document.createElement('style');
hideNativeSelectStyle.textContent = `
select#workflowSelect,
select#wordlistSelect {
    display: none !important;
    position: absolute !important;
    left: -9999px !important;
    width: 1px !important;
    height: 1px !important;
    opacity: 0 !important;
    pointer-events: none !important;
    z-index: -1 !important;
}
`;
document.head.appendChild(hideNativeSelectStyle);

// Inject CSS to ensure workflow dropdown is always on top of everything
const workflowDropdownCSS = document.createElement('style');
workflowDropdownCSS.textContent = `
#workflowCustomSelect {
    z-index: 99999 !important;
    position: relative !important;
}
#workflowCustomSelect .options-list,
#workflowCustomSelect .options-list.show {
    z-index: 99999 !important;
    position: absolute !important;
}
body.workflow-dropdown-open #workflowCustomSelect,
body.workflow-dropdown-open #workflowCustomSelect .options-list {
    z-index: 99999 !important;
}
/* Ensure wordlist dropdown stays below workflow dropdown */
#wordlistCustomSelect {
    z-index: 100 !important;
    position: relative;
}
#wordlistCustomSelect .options-list {
    z-index: 101 !important;
}
`;
document.head.appendChild(workflowDropdownCSS);

// Add filtering function
function filterWordsByLength(words, length) {
    return words.filter(word => word.length === length);
}

// Add helper function to find most frequent letter
function findMostFrequentLetter(words, rank = 1) {
    // Count frequencies of all letters
    const frequencyMap = new Map();
    words.forEach(word => {
        [...word].forEach(letter => {
            // Only count letters A-Z, convert to uppercase first
            const upperLetter = letter.toUpperCase();
            if (/^[A-Z]$/.test(upperLetter)) {
                frequencyMap.set(upperLetter, (frequencyMap.get(upperLetter) || 0) + 1);
            }
        });
    });
    
    // Sort letters by frequency
    const sortedLetters = [...frequencyMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);
    
    // Find the nth most frequent letter that hasn't been answered in this workflow
    let count = 0;
    for (const letter of sortedLetters) {
        // Skip letters that have already been confirmed or excluded in this workflow
        if (!workflowState.confirmedLetters.has(letter) && !workflowState.excludedLetters.has(letter)) {
            count++;
            if (count === rank) {
                return letter;
            }
        }
    }
    return null;  // No more unique frequent letters that haven't been answered
}

// Add filtering function
function filterWordsByMostFrequent(words, letter, include) {
    return words.filter(word => {
        const hasLetter = word.toUpperCase().includes(letter);
        return include ? hasLetter : !hasLetter;
    });
}

// Function to find the least frequent letter
function findLeastFrequentLetter(words) {
    // Count frequencies of all letters
    const frequencyMap = new Map();
    words.forEach(word => {
        [...word].forEach(letter => {
            // Only count letters A-Z, convert to uppercase first
            const upperLetter = letter.toUpperCase();
            if (/^[A-Z]$/.test(upperLetter)) {
                frequencyMap.set(upperLetter, (frequencyMap.get(upperLetter) || 0) + 1);
            }
        });
    });
    
    // Sort letters by frequency (ascending)
    const sortedLetters = [...frequencyMap.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(entry => entry[0]);
    
    // Return the least frequent letter that hasn't been answered in this workflow
    for (const letter of sortedLetters) {
        // Skip letters that have already been confirmed or excluded in this workflow
        if (!workflowState.confirmedLetters.has(letter) && !workflowState.excludedLetters.has(letter)) {
            return letter;
        }
    }
    return null;  // No more unique letters that haven't been answered
}

// Function to filter words based on least frequent letter
function filterWordsByLeastFrequent(words, letter, include) {
    if (!letter) return words;
    return words.filter(word => {
        const hasLetter = word.toUpperCase().includes(letter);
        return include ? hasLetter : !hasLetter;
    });
}

// Add a cooldown map to track when features were last added
const featureCooldown = new Map();

function initializeFeatureSelection() {
    const availableFeatures = document.getElementById('availableFeatures');
    const selectedFeaturesList = document.getElementById('selectedFeaturesList');
    
    if (availableFeatures) {
        const featureButtons = availableFeatures.querySelectorAll('.feature-button');
        
        featureButtons.forEach(button => {
            // Remove existing event listeners
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            // Track touch state for scroll detection
            let touchStartX = 0;
            let touchStartY = 0;
            let touchStartTime = 0;
            let hasMoved = false;
            
            // Handle click (desktop)
            newButton.addEventListener('click', (e) => {
                const featureType = newButton.dataset.feature;
                
                // Check cooldown
                const lastAdded = featureCooldown.get(featureType);
                const now = Date.now();
                if (lastAdded && (now - lastAdded) < 1000) {
                    return;
                }
                
                if (!isFeatureAlreadySelected(featureType)) {
                    addFeatureToSelected(featureType);
                    featureCooldown.set(featureType, now);
                }
            });
            
            // Track touch start
            newButton.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
                hasMoved = false;
            }, { passive: true });
            
            // Track touch move to detect scrolling
            newButton.addEventListener('touchmove', (e) => {
                if (!hasMoved) {
                    const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
                    const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
                    // If moved more than 10px, consider it a scroll
                    if (deltaX > 10 || deltaY > 10) {
                        hasMoved = true;
                    }
                }
            }, { passive: true });
            
            // Handle touch end - only trigger if it was a tap, not a scroll
            newButton.addEventListener('touchend', (e) => {
                const touchEndTime = Date.now();
                const touchDuration = touchEndTime - touchStartTime;
                
                // Only trigger if:
                // 1. Touch didn't move significantly (not a scroll)
                // 2. Touch duration was short (less than 300ms - indicates a tap)
                // 3. Not within cooldown period
                if (!hasMoved && touchDuration < 300) {
                e.preventDefault();
                const featureType = newButton.dataset.feature;
                
                // Check cooldown
                const lastAdded = featureCooldown.get(featureType);
                const now = Date.now();
                if (lastAdded && (now - lastAdded) < 1000) {
                        return;
                }
                
                if (!isFeatureAlreadySelected(featureType)) {
                    addFeatureToSelected(featureType);
                    featureCooldown.set(featureType, now);
                }
                }
                
                // Reset state
                hasMoved = false;
            }, { passive: false });
        });
    }
}

function isFeatureAlreadySelected(featureType) {
    const selectedFeatures = document.getElementById('selectedFeaturesList');
    // Allow multiple instances of MOST FREQUENT, LEAST FREQUENT, and POSITION-CONS
    if (featureType === 'mostFrequent' || 
        featureType === 'leastFrequent' || 
        featureType === 'positionCons') {
        return false;
    }
    // For all other features, maintain the single instance rule
    return selectedFeatures.querySelector(`[data-feature="${featureType}"]`) !== null;
}

function addFeatureToSelected(featureType) {
    const selectedFeatures = document.getElementById('selectedFeaturesList');
    const featureButton = document.querySelector(`.feature-button[data-feature="${featureType}"]`);
    
    if (!featureButton) return;
    
    const selectedFeature = document.createElement('div');
    selectedFeature.className = 'selected-feature-item';
    // Add T9 class if it's a T9 feature
    if (featureType.startsWith('t9')) {
        selectedFeature.classList.add('t9-selected-feature');
    }
    // Add Alpha-Numeric class if it's an Alpha-Numeric feature
    if (featureType === 'alphaNumeric' || featureType === 'lettersAbove') {
        selectedFeature.classList.add('alphanumeric-selected-feature');
    }
    selectedFeature.dataset.feature = featureType;
    
    const featureName = document.createElement('span');
    featureName.textContent = featureButton.textContent;
    selectedFeature.appendChild(featureName);
    
    // Add click event to remove feature
    selectedFeature.addEventListener('click', () => {
        selectedFeature.remove();
        adjustSelectedFeaturesHeight();
    });
    
    // Add touch event for mobile
    selectedFeature.addEventListener('touchstart', (e) => {
        e.preventDefault();
        selectedFeature.remove();
        adjustSelectedFeaturesHeight();
    }, { passive: false });
    
    selectedFeatures.appendChild(selectedFeature);
    adjustSelectedFeaturesHeight();
}

// Add NOT IN feature to the featureElements object
const featureElements = {
    // ... existing features ...
    notIn: createNotInFeature(),
};

// Add NOT IN feature handlers
function initializeNotInFeature() {
    const notInButton = document.getElementById('notInButton');
    const notInInput = document.getElementById('notInInput');
    const notInSkipButton = document.getElementById('notInSkipButton');

    if (notInButton && notInInput && notInSkipButton) {
        // Remove any existing event listeners
        const newNotInButton = notInButton.cloneNode(true);
        const newNotInSkipButton = notInSkipButton.cloneNode(true);
        const newNotInInput = notInInput.cloneNode(true);
        
        notInButton.parentNode.replaceChild(newNotInButton, notInButton);
        notInSkipButton.parentNode.replaceChild(newNotInSkipButton, notInSkipButton);
        notInInput.parentNode.replaceChild(newNotInInput, notInInput);

        newNotInButton.addEventListener('click', () => {
            const letters = newNotInInput.value.toLowerCase();
            if (letters) {
                filterWordsByNotIn(letters);
                callback(currentFilteredWords);
                document.getElementById('notInFeature').classList.add('completed');
                document.getElementById('notInFeature').dispatchEvent(new Event('completed'));
            }
        });

        newNotInSkipButton.addEventListener('click', () => {
            callback(currentFilteredWords);
            document.getElementById('notInFeature').classList.add('completed');
            document.getElementById('notInFeature').dispatchEvent(new Event('completed'));
        });

        // Add enter key support
        newNotInInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                newNotInButton.click();
            }
        });

        // Add touch events for mobile
        newNotInButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            newNotInButton.click();
        }, { passive: false });

        newNotInSkipButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            newNotInSkipButton.click();
        }, { passive: false });
    }
}

function filterWordsByNotIn(letters) {
    const letterSet = new Set(letters.toLowerCase());
    currentFilteredWords = currentFilteredWords.filter(word => {
        // Check if ANY of the letters are in the word
        return !Array.from(letterSet).some(letter => word.toLowerCase().includes(letter));
    });
    displayResults(currentFilteredWords);
}

// ========== POSITION-CONS Helper Functions ==========

// Letter String Sanitization
function sanitizeLetterString(value = '') {
    return (value || '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
}

// Source Word Selection
function getSourceWordsForPosition(position = 1) {
    const source = (currentFilteredWords && currentFilteredWords.length 
                   ? currentFilteredWords 
                   : wordList) || [];
    return source.filter(word => typeof word === 'string' && word.length >= position);
}

// Position Letter Statistics
function buildPositionLetterStats(words, position) {
    const freq = new Map();
    const index = Math.max(0, position - 1);
    words.forEach(word => {
        const letter = (word[index] || '').toUpperCase();
        if (!letter || letter < 'A' || letter > 'Z') return;
        freq.set(letter, (freq.get(letter) || 0) + 1);
    });
    return freq;
}

// Letter Group Generation
function getPositionLetterGroups(position) {
    const sourceWords = getSourceWordsForPosition(position);
    const freq = buildPositionLetterStats(sourceWords, position);
    const orderedLetters = [...freq.entries()]
        .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
        .map(([letter]) => letter);
    const consonants = orderedLetters.filter(letter => !VOWEL_SET.has(letter));
    const vowels = orderedLetters.filter(letter => VOWEL_SET.has(letter));
    const allGroups = [];
    if (orderedLetters.length) {
        for (let i = 0; i < orderedLetters.length; i += 6) {
            const chunk = orderedLetters.slice(i, i + 6);
            while (chunk.length < 6 && consonants.length) {
                const filler = consonants.find(letter => !chunk.includes(letter)) ||
                              CONSONANT_LETTERS.find(letter => !chunk.includes(letter));
                if (!filler) break;
                chunk.push(filler);
            }
            allGroups.push(chunk.slice(0, 6));
        }
    } else {
        allGroups.push(CONSONANT_LETTERS.slice(0, 6));
    }
    return {
        signature: orderedLetters.join(''),
        allGroups,
        consonants,
        vowels,
    };
}

// Structured String Generation
function generateStructuredLetterString(position = 1) {
    const { signature, allGroups, consonants, vowels } = getPositionLetterGroups(position);
    // Initialize or reset state if wordlist changed
    if (!positionConsSequenceState[position] || 
        positionConsSequenceState[position].signature !== signature) {
        positionConsSequenceState[position] = {
            signature,
            index: -1,
            useVowels: false,
        };
    }
    const state = positionConsSequenceState[position];
    const groups = allGroups.length ? allGroups : [CONSONANT_LETTERS.slice(0, 6)];
    
    // Cycle through groups
    state.index = (state.index + 1) % groups.length;
    
    // Alternate vowel inclusion
    state.useVowels = !state.useVowels;
    const baseChunk = groups[state.index];
    
    if (state.useVowels && vowels.length) {
        // Vowel turn: show group as-is (includes vowels)
        return baseChunk.join('');
    } else {
        // Consonant turn: filter out vowels, pad with consonants
        const consonantOnly = baseChunk.filter(letter => !VOWEL_SET.has(letter));
        const used = new Set(consonantOnly);
        while (consonantOnly.length < 6) {
            const filler = consonants.find(letter => !used.has(letter)) ||
                          CONSONANT_LETTERS.find(letter => !used.has(letter));
            if (!filler) break;
            consonantOnly.push(filler);
            used.add(filler);
        }
        return consonantOnly.slice(0, 6).join('');
    }
}

// Filtering Logic
function filterWordsByPositionCons(words, options) {
    if (!Array.isArray(words) || !options) return [];
    const { position, letters, letterCount } = options;
    const sanitizedLetters = sanitizeLetterString(letters);
    if (!sanitizedLetters) return [];
    
    const uniqueLetters = [...new Set(sanitizedLetters.split(''))];
    const letterSet = new Set(uniqueLetters);
    const normalizedLetterCount = typeof letterCount === 'number' && letterCount >= 0
        ? letterCount
        : uniqueLetters.length;
    const hasSpecificPosition = typeof position === 'number' && position >= 1 && position <= 6;
    const targetIndex = hasSpecificPosition ? Math.max(0, position - 1) : null;
    
    const countMatches = (upperWord) => {
        let total = 0;
        letterSet.forEach(letter => {
            if (upperWord.includes(letter)) {
                total += 1;
            }
        });
        return total;
    };
    
    const seen = new Set();
    const results = [];
    
    for (const word of words) {
        const upperWord = word.toUpperCase();
        if (!upperWord) continue;
        
        if (hasSpecificPosition) {
            if (upperWord.length <= targetIndex) continue;
            const targetLetter = upperWord[targetIndex];
            if (!letterSet.has(targetLetter)) continue;
            
            const totalMatches = countMatches(upperWord);
            if (totalMatches !== normalizedLetterCount) continue;
            
            const key = upperWord;
            if (!seen.has(key)) {
                seen.add(key);
                results.push(word);
            }
            continue;
        }
        
        const totalMatches = countMatches(upperWord);
        if (totalMatches !== normalizedLetterCount) continue;
        
        let hasLetterMatch = normalizedLetterCount === 0;
        if (!hasLetterMatch) {
            for (let i = 0; i < upperWord.length; i++) {
                if (letterSet.has(upperWord[i])) {
                    hasLetterMatch = true;
                    break;
                }
            }
        }
        
        if (!hasLetterMatch) continue;
        
        const key = upperWord;
        if (!seen.has(key)) {
            seen.add(key);
            results.push(word);
        }
    }
    
    return results.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}