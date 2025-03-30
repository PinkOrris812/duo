// Initialize and handle all page functionality
document.addEventListener('DOMContentLoaded', function() {
    
    // Set placeholder text in submission field based on default option
    if (document.getElementById('phrase-input')) {
        const categoryDropdown = document.getElementById('category-dropdown');
        const languageDropdown = document.getElementById('language-dropdown');
        
        if (categoryDropdown && languageDropdown) {
            const category = categoryDropdown.options[categoryDropdown.selectedIndex].text;
            const language = languageDropdown.options[languageDropdown.selectedIndex].text.split(' ')[1];
            
            document.getElementById('phrase-input').placeholder = 
                `Expression of love for your ${category} in ${language} (max 10 words)`;
        }
    }

    const submissionForm = document.getElementById('submission-form');
    if (submissionForm) {
        submissionForm.addEventListener('submit', function(e) {
            e.preventDefault(); // Prevent form submission
            
            // Get form data
            const phrase = document.getElementById('phrase-input').value;
            
            // Check if input is empty
            if (!phrase.trim()) {
                alert('Please enter a phrase to submit');
                return;
            }
            
            // Get category and language data from dropdowns
            const categoryDropdown = document.getElementById('category-dropdown');
            const selectedCategory = categoryDropdown.options[categoryDropdown.selectedIndex].text;
            
            const languageDropdown = document.getElementById('language-dropdown');
            const selectedOption = languageDropdown.options[languageDropdown.selectedIndex];
            const selectedLanguageCode = selectedOption.value; // ISO language code 
            const selectedLanguageText = selectedOption.text;
            const flagEmoji = selectedLanguageText.split(' ')[0]; // Extract flag emoji
            
            // Create submission object
            const submission = {
                phrase: phrase,
                category: selectedCategory,
                languageCode: selectedLanguageCode,
                language: flagEmoji
            };
            
            // Send submission to the backend API
            submitPhrase(submission)
                .then(response => {
                    if (response.success) {
                        // For demo purposes, also save to sessionStorage to display on the confirmation page
                        // In a real app, you'd fetch this from the API
                        const submissions = JSON.parse(sessionStorage.getItem('duoSubmissions') || '[]');
                        submission.author = 'You'; // Add author for display
                        submissions.push(submission);
                        sessionStorage.setItem('duoSubmissions', JSON.stringify(submissions));
                        
                        // Redirect to confirmation page
                        window.location.href = 'confirmation.html';
                    } else {
                        alert('Error submitting phrase: ' + response.error);
                    }
                })
                .catch(error => {
                    console.error('Error submitting phrase:', error);
                    alert('Error submitting phrase. Please try again.');
                });
        });
    }
    
    // Add event listeners for dropdowns to make them more interactive
    const dropdowns = document.querySelectorAll('.dropdown-select');
    dropdowns.forEach(dropdown => {
        dropdown.addEventListener('change', function() {
            // Add visual feedback when changed
            this.style.backgroundColor = '#f0f9eb';
            setTimeout(() => {
                this.style.backgroundColor = 'white';
            }, 1000);
            
            // Update placeholder text for input based on selection
            if (this.id === 'category-dropdown') {
                const category = this.options[this.selectedIndex].text;
                document.getElementById('phrase-input').placeholder = 
                    `Expression of love for your ${category} (max 10 words)`;
            }
            
            if (this.id === 'language-dropdown') {
                const language = this.options[this.selectedIndex].text.split(' ')[1];
                document.getElementById('phrase-input').placeholder = 
                    `Expression of love in ${language} (max 10 words)`;
            }
        });
    });

    // Add event listeners for filter tabs
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            if (this.classList.contains('selected')) {
                return;
            }
            
            const parent = this.parentNode;
            parent.querySelector('.selected').classList.remove('selected');
            this.classList.add('selected');
            
            // If on gallery page, fetch filtered submissions
            const submissionsContainer = document.querySelector('.submissions-container');
            if (submissionsContainer) {
                // Get filter value from the tab's data attribute
                const filter = this.dataset.filter;
                loadSubmissions(filter);
            }
        });
    });
    
    // Add event listeners for voting buttons
    function addVoteListeners() {
        const voteButtons = document.querySelectorAll('.vote-button');
        voteButtons.forEach(button => {
            button.addEventListener('click', function() {
                const phraseId = this.closest('.submission-item').dataset.phraseId;
                let voteValue = 0;
                
                if (this.classList.contains('upvote')) {
                    if (this.classList.contains('active')) {
                        // Cancel upvote
                        this.classList.remove('active');
                        voteValue = 0;
                    } else {
                        // Apply upvote
                        this.classList.add('active');
                        this.parentNode.querySelector('.downvote').classList.remove('active');
                        voteValue = 1;
                    }
                } else { // downvote
                    if (this.classList.contains('active')) {
                        // Cancel downvote
                        this.classList.remove('active');
                        voteValue = 0;
                    } else {
                        // Apply downvote
                        this.classList.add('active');
                        this.parentNode.querySelector('.upvote').classList.remove('active');
                        voteValue = -1;
                    }
                }
                
                // Send vote to the API
                submitVote(phraseId, voteValue)
                    .catch(error => {
                        console.error('Error submitting vote:', error);
                        // Revert UI if the vote fails
                        if (this.classList.contains('upvote')) {
                            this.classList.toggle('active');
                        } else {
                            this.classList.toggle('active');
                        }
                    });
            });
        });
    }
    
    // Load and display submissions on gallery page
    const submissionsContainer = document.querySelector('.submissions-container');
    if (submissionsContainer) {
        // Load submissions from API
        loadSubmissions();
        
        // Also check if there's a recent submission in sessionStorage for instant feedback
        const submissions = JSON.parse(sessionStorage.getItem('duoSubmissions') || '[]');
        if (submissions.length > 0) {
            const latestSubmission = submissions[submissions.length - 1];
            displayUserSubmission(latestSubmission);
        }
    }
    
    // Function to load submissions from the API
    function loadSubmissions(filter = null) {
        let url = '/api/phrases';
        
        // Add query parameters for filtering
        if (filter) {
            url += `?category=${filter}`;
        }
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(phrases => {
                displaySubmissions(phrases);
            })
            .catch(error => {
                console.error('Error loading submissions:', error);
                // Fallback to sessionStorage for demo purposes
                fallbackToLocalSubmissions();
            });
    }
    
    // Function to display a user's own submission at the top
    function displayUserSubmission(submission) {
        const submissionsContainer = document.querySelector('.submissions-container');
        
        const submissionElement = document.createElement('div');
        submissionElement.className = 'submission-item user-submission';
        submissionElement.innerHTML = `
            <div class="submission-content">
                <p class="submission-text">${submission.phrase}</p>
                <div class="submission-meta">
                    <span class="country-flag">${submission.language}</span>
                    <span class="submission-category">${submission.category}</span>
                    <span class="submission-author">${submission.author}</span>
                </div>
            </div>
            <div class="voting-buttons">
                <button class="vote-button upvote">▲</button>
                <button class="vote-button downvote">▼</button>
            </div>
            <div class="additional-buttons">
                <button class="action-button share-button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 8C19.6569 8 21 6.65685 21 5C21 3.34315 19.6569 2 18 2C16.3431 2 15 3.34315 15 5C15 5.12548 15.0077 5.24917 15.0227 5.37061L8.08264 9.12866C7.54092 8.43356 6.81462 8 6 8C4.34315 8 3 9.34315 3 11C3 12.6569 4.34315 14 6 14C6.81462 14 7.54092 13.5664 8.08264 12.8713L15.0227 16.6294C15.0077 16.7508 15 16.8745 15 17C15 18.6569 16.3431 20 18 20C19.6569 20 21 18.6569 21 17C21 15.3431 19.6569 14 18 14C17.1854 14 16.4591 14.4336 15.9174 15.1287L8.97733 11.3706C8.99229 11.2492 9 11.1255 9 11C9 10.8745 8.99229 10.7508 8.97733 10.6294L15.9174 6.87134C16.4591 7.56644 17.1854 8 18 8Z" fill="currentColor"/>
                    </svg>
                </button>
                <button class="action-button flag-button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 21V3M4 15H20L15 7L20 3H4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        `;
        
        // Prepend to container (add at the beginning)
        if (submissionsContainer.firstChild) {
            submissionsContainer.insertBefore(submissionElement, submissionsContainer.firstChild);
        } else {
            submissionsContainer.appendChild(submissionElement);
        }
        
        // Add event listeners to the new voting buttons
        addVoteListeners();
    }
    
    // Function to display submissions from the API
    function displaySubmissions(phrases) {
        const submissionsContainer = document.querySelector('.submissions-container');
        
        // Clear existing submissions except for the user's own submission
        const userSubmission = submissionsContainer.querySelector('.user-submission');
        submissionsContainer.innerHTML = '';
        
        // Add back the user's submission if it exists
        if (userSubmission) {
            submissionsContainer.appendChild(userSubmission);
        }
        
        // Add each phrase from the API
        phrases.forEach(phrase => {
            const submissionElement = document.createElement('div');
            submissionElement.className = 'submission-item';
            submissionElement.dataset.phraseId = phrase.phrase_id;
            
            submissionElement.innerHTML = `
                <div class="submission-content">
                    <p class="submission-text">${phrase.content}</p>
                    <div class="submission-meta">
                        <span class="country-flag">${getLanguageFlag(phrase.language_code)}</span>
                        <span class="submission-category">${phrase.category_name}</span>
                        <span class="submission-author">${phrase.submitted_by}</span>
                    </div>
                </div>
                <div class="voting-buttons">
                    <button class="vote-button upvote">▲</button>
                    <button class="vote-button downvote">▼</button>
                </div>
                <div class="additional-buttons">
                    <button class="action-button share-button">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 8C19.6569 8 21 6.65685 21 5C21 3.34315 19.6569 2 18 2C16.3431 2 15 3.34315 15 5C15 5.12548 15.0077 5.24917 15.0227 5.37061L8.08264 9.12866C7.54092 8.43356 6.81462 8 6 8C4.34315 8 3 9.34315 3 11C3 12.6569 4.34315 14 6 14C6.81462 14 7.54092 13.5664 8.08264 12.8713L15.0227 16.6294C15.0077 16.7508 15 16.8745 15 17C15 18.6569 16.3431 20 18 20C19.6569 20 21 18.6569 21 17C21 15.3431 19.6569 14 18 14C17.1854 14 16.4591 14.4336 15.9174 15.1287L8.97733 11.3706C8.99229 11.2492 9 11.1255 9 11C9 10.8745 8.99229 10.7508 8.97733 10.6294L15.9174 6.87134C16.4591 7.56644 17.1854 8 18 8Z" fill="currentColor"/>
                        </svg>
                    </button>
                    <button class="action-button flag-button">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 21V3M4 15H20L15 7L20 3H4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            `;
            
            submissionsContainer.appendChild(submissionElement);
        });
        
        // Add event listeners for the new buttons
        addVoteListeners();
    }
    
    // Fallback function if API is not available (for demo purposes)
    function fallbackToLocalSubmissions() {
        const submissions = JSON.parse(sessionStorage.getItem('duoSubmissions') || '[]');
        
        if (submissions.length === 0) {
            // Add some sample submissions if none exist
            const sampleSubmissions = [
                {
                    phrase: "Te quiero mucho mamá",
                    category: "family",
                    language: "🇪🇸",
                    author: "SpanishLearner22"
                },
                {
                    phrase: "Ich liebe dich für immer",
                    category: "partner",
                    language: "🇩🇪",
                    author: "GermanFan123"
                },
                {
                    phrase: "You're the best friend ever",
                    category: "friends",
                    language: "🇺🇸",
                    author: "EnglishSpeaker"
                }
            ];
            
            // Display sample submissions
            const submissionsContainer = document.querySelector('.submissions-container');
            submissionsContainer.innerHTML = '';
            
            sampleSubmissions.forEach(submission => {
                const submissionElement = document.createElement('div');
                submissionElement.className = 'submission-item';
                submissionElement.innerHTML = `
                    <div class="submission-content">
                        <p class="submission-text">${submission.phrase}</p>
                        <div class="submission-meta">
                            <span class="country-flag">${submission.language}</span>
                            <span class="submission-category">${submission.category}</span>
                            <span class="submission-author">${submission.author}</span>
                        </div>
                    </div>
                    <div class="voting-buttons">
                        <button class="vote-button upvote">▲</button>
                        <button class="vote-button downvote">▼</button>
                    </div>
                    <div class="additional-buttons">
                        <button class="action-button share-button">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18 8C19.6569 8 21 6.65685 21 5C21 3.34315 19.6569 2 18 2C16.3431 2 15 3.34315 15 5C15 5.12548 15.0077 5.24917 15.0227 5.37061L8.08264 9.12866C7.54092 8.43356 6.81462 8 6 8C4.34315 8 3 9.34315 3 11C3 12.6569 4.34315 14 6 14C6.81462 14 7.54092 13.5664 8.08264 12.8713L15.0227 16.6294C15.0077 16.7508 15 16.8745 15 17C15 18.6569 16.3431 20 18 20C19.6569 20 21 18.6569 21 17C21 15.3431 19.6569 14 18 14C17.1854 14 16.4591 14.4336 15.9174 15.1287L8.97733 11.3706C8.99229 11.2492 9 11.1255 9 11C9 10.8745 8.99229 10.7508 8.97733 10.6294L15.9174 6.87134C16.4591 7.56644 17.1854 8 18 8Z" fill="currentColor"/>
                            </svg>
                        </button>
                        <button class="action-button flag-button">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 21V3M4 15H20L15 7L20 3H4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                `;
                
                submissionsContainer.appendChild(submissionElement);
            });
            
            // Add event listeners for the new buttons
            addVoteListeners();
        }
    }
    
    // Helper function to get language flag emoji from language code
    function getLanguageFlag(languageCode) {
        const flagMap = {
            'en': '🇺🇸',
            'es': '🇪🇸',
            'fr': '🇫🇷',
            'de': '🇩🇪',
            'it': '🇮🇹',
            'ja': '🇯🇵',
            'ko': '🇰🇷',
            'zh': '🇨🇳',
            'pt': '🇵🇹',
            'ru': '🇷🇺',
            'ar': '🇸🇦',
            'hi': '🇮🇳',
            'tr': '🇹🇷'
        };
        
        return flagMap[languageCode] || '🌍';
    }
    
    // API functions
    async function submitPhrase(submission) {
        try {
            const response = await fetch('/api/phrases', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(submission)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to submit phrase');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error submitting phrase:', error);
            // For demo purposes, return success anyway
            return { success: true };
        }
    }
    
    async function submitVote(phraseId, voteValue) {
        try {
            const response = await fetch('/api/votes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phrase_id: phraseId,
                    vote_value: voteValue
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to submit vote');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error submitting vote:', error);
            throw error;
        }
    }
});