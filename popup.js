// Load saved data when popup opens
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['fullName', 'email', 'github', 'linkedin'], (data) => {
    if (data.fullName) document.getElementById('fullName').value = data.fullName;
    if (data.email) document.getElementById('email').value = data.email;
    if (data.github) document.getElementById('github').value = data.github;
    if (data.linkedin) document.getElementById('linkedin').value = data.linkedin;
  });
});

// Save data to local storage
document.getElementById('saveBtn').addEventListener('click', () => {
  const profile = {
    fullName: document.getElementById('fullName').value,
    email: document.getElementById('email').value,
    github: document.getElementById('github').value,
    linkedin: document.getElementById('linkedin').value
  };

  chrome.storage.local.set(profile, () => {
    alert('Data saved! Ready to autofill.');
  });
});

// Trigger the autofill action in the active tab
document.getElementById('fillBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
});