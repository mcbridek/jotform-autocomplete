// Function to fetch data from a public Google Sheet (CSV format)
// (No changes needed here)

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Initialize the widget when ready
JFCustomWidget.subscribe('ready', async function () {
  const input = document.getElementById('autocomplete-input');
  const suggestionsList = document.getElementById('suggestions-list');

  // Get widget settings
  const sheetId = JFCustomWidget.getWidgetSetting('googleSheetId');
  const columnIndexSetting = JFCustomWidget.getWidgetSetting('columnIndex');
  const columnIndex = columnIndexSetting !== undefined ? parseInt(columnIndexSetting, 10) : 0;
  const inputWidthSetting = JFCustomWidget.getWidgetSetting('inputWidth') || '100%';
  const autocompleteWidthSetting = JFCustomWidget.getWidgetSetting('autocompleteWidth') || '100%';
  const dynamicResize = JFCustomWidget.getWidgetSetting('dynamicResize') !== false; // Defaults to true

  // Corrected settings retrieval
  const thresholdSetting = JFCustomWidget.getWidgetSetting('threshold');
  const threshold = thresholdSetting !== undefined ? parseFloat(thresholdSetting) : 0.2;

  const distanceSetting = JFCustomWidget.getWidgetSetting('distance');
  const distance = distanceSetting !== undefined ? parseInt(distanceSetting, 10) : 100;

  const maxResultsSetting = JFCustomWidget.getWidgetSetting('maxResults');
  const maxResults = maxResultsSetting !== undefined ? parseInt(maxResultsSetting, 10) : 5;

  const minCharRequiredSetting = JFCustomWidget.getWidgetSetting('minCharRequired');
  const minCharRequired = minCharRequiredSetting !== undefined ? parseInt(minCharRequiredSetting, 10) : 3;

  const debounceTimeSetting = JFCustomWidget.getWidgetSetting('debounceTime');
  const debounceTime = debounceTimeSetting !== undefined ? parseInt(debounceTimeSetting, 10) : 300;

  // Apply width settings
  input.style.width = inputWidthSetting;
  suggestionsList.style.width = autocompleteWidthSetting;

  // Add ARIA attributes
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-haspopup', 'listbox');
  suggestionsList.setAttribute('role', 'listbox');

  // Fetch data from Google Sheets
  const data = await fetchGoogleSheetData(sheetId);

  if (data.length > 0) {
    // Transform data into objects with 'name' property
    const columnData = data.slice(1).map(row => ({ name: row[columnIndex] }));

    // Set up Fuse.js for fuzzy searching
    const options = {
      shouldSort: true,
      threshold: threshold,
      distance: distance,
      minMatchCharLength: minCharRequired,
      keys: ['name'],
      includeScore: true,
      includeMatches: true
    };
    const fuse = new Fuse(columnData, options);

    let selectedIndex = -1;
    const searchCache = {};

    // Adjust iframe height on window resize (optional)
    window.addEventListener('resize', adjustIframeHeight);

    // Add event listener to the input with debounce
    input.addEventListener('input', debounce(onInputChange, debounceTime));

    function onInputChange(e) {
      const searchTerm = e.target.value;

      if (searchTerm.length >= minCharRequired) {
        if (searchCache[searchTerm]) {
          displaySuggestions(searchCache[searchTerm]);
        } else {
          const results = fuse.search(searchTerm);
          searchCache[searchTerm] = results;
          displaySuggestions(results);
        }
      } else {
        suggestionsList.style.display = 'none';
        suggestionsList.innerHTML = '';
        adjustIframeHeight();
      }
    }

    function displaySuggestions(results) {
      const suggestions = results
        .sort((a, b) => a.score - b.score)
        .slice(0, maxResults);

      // Clear previous suggestions
      suggestionsList.innerHTML = '';
      selectedIndex = -1;

      // Populate suggestions
      suggestions.forEach((suggestion, index) => {
        const li = document.createElement('li');
        li.innerHTML = highlightMatch(suggestion);
        li.setAttribute('role', 'option');
        li.setAttribute('id', `suggestion-${index}`);
        li.addEventListener('click', () => {
          input.value = suggestion.item.name;
          suggestionsList.innerHTML = ''; // Clear suggestions
          suggestionsList.style.display = 'none';
          JFCustomWidget.sendSubmit({ value: suggestion.item.name, valid: true });
          adjustIframeHeight(); // Adjust iframe height
        });
        suggestionsList.appendChild(li);
      });

      suggestionsList.style.display = 'block';
      adjustIframeHeight();
    }

    function highlightMatch(result) {
      const { item, matches } = result;
      let highlighted = item.name;
      if (matches && matches.length > 0) {
        matches.forEach(match => {
          const indices = match.indices;
          let offset = 0;
          indices.forEach(([start, end]) => {
            const before = highlighted.slice(0, start + offset);
            const matchText = highlighted.slice(start + offset, end + offset + 1);
            const after = highlighted.slice(end + offset + 1);
            highlighted = `${before}<mark>${matchText}</mark>${after}`;
            offset += '<mark></mark>'.length;
          });
        });
      }
      return highlighted;
    }

    input.addEventListener('keydown', (e) => {
      const items = suggestionsList.getElementsByTagName('li');
      if (e.key === 'Enter') {
        e.preventDefault();
        if (items.length > 0 && selectedIndex >= 0 && selectedIndex < items.length) {
          // Suggestion selected
          input.value = items[selectedIndex].textContent;
        }
        // Clear suggestions
        suggestionsList.innerHTML = '';
        suggestionsList.style.display = 'none';
        JFCustomWidget.sendSubmit({ value: input.value, valid: true });
        adjustIframeHeight(); // Adjust iframe height
      } else if (items.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (selectedIndex < items.length - 1) {
            selectedIndex++;
            updateSelection(items);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (selectedIndex > 0) {
            selectedIndex--;
            updateSelection(items);
          }
        }
      }
    });

    function updateSelection(items) {
      Array.from(items).forEach((item, index) => {
        item.classList.toggle('selected', index === selectedIndex);
        if (index === selectedIndex) {
          item.setAttribute('aria-selected', 'true');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.removeAttribute('aria-selected');
        }
      });
    }

    // Adjust height when the suggestions list is shown or hidden
    input.addEventListener('focus', adjustIframeHeight);
    input.addEventListener('blur', () => {
      // Delay to allow click events on suggestions to process
      setTimeout(() => {
        suggestionsList.style.display = 'none';
        suggestionsList.innerHTML = '';
        JFCustomWidget.sendSubmit({ value: input.value, valid: true });
        adjustIframeHeight();
      }, 100);
    });

    function adjustIframeHeight() {
      if (dynamicResize) {
        const inputHeight = input.offsetHeight;
        let totalHeight = inputHeight;

        if (suggestionsList.style.display === 'block' && suggestionsList.childElementCount > 0) {
          const suggestionsHeight = suggestionsList.scrollHeight;
          totalHeight += suggestionsHeight;
        }

        totalHeight += 20; // Additional padding if needed

        // Request iframe resize with correct parameter
        JFCustomWidget.requestFrameResize({ height: totalHeight });
      } else {
        // Use fixed height
        JFCustomWidget.requestFrameResize({ height: 250 }); // Set to desired fixed height
      }
    }

    // Initial iframe height adjustment
    adjustIframeHeight();

  } else {
    console.error('No data retrieved from Google Sheet.');
  }
});
