// Theme toggle functionality for main page
document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('themeBtn');
    const themeIcon = document.getElementById('themeIcon');
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    document.body.setAttribute('data-theme', savedTheme);
    
    // Set initial icon based on saved theme
    if (savedTheme === 'light') {
        themeIcon.src = '/static/icons/dark-mode.png';
        themeIcon.alt = 'Switch to dark mode';
    } else {
        themeIcon.src = '/static/icons/light-mode.png';
        themeIcon.alt = 'Switch to light mode';
    }
    
    themeBtn.onclick = () => {
        const current = document.body.getAttribute('data-theme');
        const newTheme = current === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        
        // Update the icon
        if (newTheme === 'light') {
            themeIcon.src = '/static/icons/dark-mode.png';
            themeIcon.alt = 'Switch to dark mode';
        } else {
            themeIcon.src = '/static/icons/light-mode.png';
            themeIcon.alt = 'Switch to light mode';
        }
        
        localStorage.setItem('theme', newTheme);
    };
    
    console.log("Main page loaded. Ready to navigate to activities!");
});