document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const errorBanner = document.getElementById('error-banner');
  const errorMessage = document.getElementById('error-message');
  const submitBtn = document.getElementById('submit-btn');

  // Verify if token already exists, redirect if so
  const currentToken = localStorage.getItem('behavior_pulse_token');
  if (currentToken) {
    window.location.replace('/dashboard.html');
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Reset error banners
    errorBanner.classList.add('hidden');
    errorMessage.textContent = '';

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Loading State
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="animate-spin h-5 w-5 mr-2 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Verifying Credentials...
    `;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      // Success - Store Session Information
      localStorage.setItem('behavior_pulse_token', data.token);
      localStorage.setItem('behavior_pulse_user', JSON.stringify(data.user));

      // Redirect to dashboard page
      window.location.replace('/dashboard.html');

    } catch (err) {
      console.warn("Authentication failed:", err.message);
      errorMessage.textContent = err.message || "An unexpected network error occurred. Please try again.";
      errorBanner.classList.remove('hidden');

      // Reset submit button state
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In to Dashboard';
    }
  });
});
