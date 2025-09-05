// process.js - Loading state management for authentication processes

class AuthProcessManager {
    constructor() {
        this.init();
    }

    init() {
        // Add loader styles
        this.addLoaderStyles();
        
        // Intercept form submissions
        this.interceptAuthForms();
    }

    addLoaderStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .auth-loader {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top-color: #fff;
                animation: spin 1s ease-in-out infinite;
                margin-right: 8px;
                vertical-align: middle;
            }
            
            .auth-loader.btn-loader {
                width: 16px;
                height: 16px;
                border-width: 2px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .btn-loading {
                position: relative;
                color: transparent !important;
            }
            
            .btn-loading::after {
                content: '';
                position: absolute;
                left: 50%;
                top: 50%;
                width: 20px;
                height: 20px;
                margin: -10px 0 0 -10px;
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top-color: #fff;
                animation: spin 1s ease-in-out infinite;
            }
        `;
        document.head.appendChild(style);
    }

    interceptAuthForms() {
        // Listen for DOMContentLoaded to ensure forms exist
        document.addEventListener('DOMContentLoaded', () => {
            // Login form
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => {
                    this.handleAuthSubmit(e, 'login');
                });
            }

            // Signup form
            const signupForm = document.getElementById('signupForm');
            if (signupForm) {
                signupForm.addEventListener('submit', (e) => {
                    this.handleAuthSubmit(e, 'signup');
                });
            }
        });
    }

    handleAuthSubmit(event, formType) {
        // Prevent default form submission
        event.preventDefault();
        
        // Get the submit button
        let submitButton;
        if (formType === 'login') {
            submitButton = document.querySelector('#loginForm button[type="submit"]');
        } else if (formType === 'signup') {
            submitButton = document.querySelector('#signupForm button[type="submit"]');
        }
        
        if (!submitButton) return;
        
        // Store original text
        const originalText = submitButton.textContent;
        submitButton.setAttribute('data-original-text', originalText);
        
        // Add loading state
        submitButton.classList.add('btn-loading');
        submitButton.disabled = true;
        
        // Store reference to this for use in promises
        const self = this;
        
        // Create a promise to handle the authentication
        const authPromise = formType === 'login' ? 
            this.performLogin(event) : 
            this.performSignup(event);
        
        // Handle the authentication result
        authPromise
            .then(() => {
                // Success - form will redirect, so we don't need to reset the button
            })
            .catch((error) => {
                // Error - reset the button
                self.resetButtonState(submitButton, originalText);
                
                // Show error message (you might want to customize this)
                alert(error.message || `Error during ${formType}. Please try again.`);
            });
    }

    performLogin(event) {
        return new Promise((resolve, reject) => {
            // Get form data
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            // Import Firebase auth functions dynamically
            import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js")
                .then(({ getAuth, signInWithEmailAndPassword }) => {
                    const auth = getAuth();
                    
                    // Perform login
                    signInWithEmailAndPassword(auth, email, password)
                        .then((userCredential) => {
                            resolve(userCredential);
                        })
                        .catch((error) => {
                            reject(error);
                        });
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    performSignup(event) {
        return new Promise((resolve, reject) => {
            // Get form data
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            // Validate passwords match
            if (password !== confirmPassword) {
                reject(new Error('Passwords do not match'));
                return;
            }
            
            // Import Firebase auth functions dynamically
            import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js")
                .then(({ getAuth, createUserWithEmailAndPassword }) => {
                    const auth = getAuth();
                    
                    // Perform signup
                    createUserWithEmailAndPassword(auth, email, password)
                        .then((userCredential) => {
                            resolve(userCredential);
                        })
                        .catch((error) => {
                            reject(error);
                        });
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    resetButtonState(button, originalText) {
        button.classList.remove('btn-loading');
        button.disabled = false;
        button.textContent = originalText;
    }
}

// Initialize the auth process manager when the script loads
const authProcessManager = new AuthProcessManager();