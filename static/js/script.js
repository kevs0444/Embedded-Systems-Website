// Theme toggle functionality for main page
document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('themeBtn');
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    document.body.setAttribute('data-theme', savedTheme);
    themeBtn.textContent = savedTheme === 'light' ? '🌙' : '☀️';
    
    themeBtn.onclick = () => {
        const current = document.body.getAttribute('data-theme');
        const newTheme = current === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        themeBtn.textContent = newTheme === 'light' ? '🌙' : '☀️';
        localStorage.setItem('theme', newTheme);
    };
    
    console.log("Main page loaded. Ready to navigate to activities!");
});