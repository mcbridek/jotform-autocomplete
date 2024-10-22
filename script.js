const userInput = document.getElementById('userInput');
const autocomplete = document.getElementById('autocomplete');
const sendButton = document.getElementById('sendButton');

// Sample autocomplete data (you can replace this with your own data source)
const autocompleteData = [
  'Hello, how are you?',
  'What\'s the weather like today?',
  'Can you help me with my homework?',
  'What time is it?'
];

userInput.addEventListener('input', function(e) {
  // Remove any numeric characters from the input, but keep periods
  this.value = this.value.replace(/[0-9]/g, '');

  const inputValue = this.value.toLowerCase();
  let suggestion = '';

  if (inputValue.length >= 3) {
    suggestion = autocompleteData.find(item => 
      item.toLowerCase().startsWith(inputValue)
    ) || '';

    if (suggestion) {
      autocomplete.textContent = suggestion;
    } else {
      autocomplete.textContent = '';
    }
  } else {
    autocomplete.textContent = '';
  }
});

userInput.addEventListener('keydown', function(e) {
  // Prevent default behavior for numeric keys, but allow period
  if (e.key >= '0' && e.key <= '9' && e.key !== '.') {
    e.preventDefault();
    return;
  }

  if (e.key === 'Tab' && autocomplete.textContent) {
    e.preventDefault();
    this.value = autocomplete.textContent;
    autocomplete.textContent = '';
  }
});

// Clear autocomplete when input is empty
userInput.addEventListener('blur', function() {
  if (this.value.length < 3) {
    this.value = '';
    autocomplete.textContent = '';
  }
});

sendButton.addEventListener('click', function() {
  if (userInput.value.length < 3) {
    alert('Please enter at least 3 characters.');
    return;
  }
  // Your existing send logic here
});
