// ui.js
import { onUserStateChanged } from './auth.js';

// Redirect if not logged in
export function protectPage(redirect = 'login.html') {
  onUserStateChanged(user => {
    if (!user) {
      alert('First, please log in');
      window.location = redirect;
    }
  });
}

// Toggle show/hide password
export function togglePassword(inputSel, btnSel) {
  const input = document.querySelector(inputSel);
  const btn = document.querySelector(btnSel);
  btn.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? 'Show' : 'Hide';
  });
}
