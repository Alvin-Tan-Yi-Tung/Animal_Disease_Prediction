// Timeline variables
let timelineMap;
let timelineLayer;
let timelineInterval;
let isTimelinePlaying = false;
let timelineData = [];
let currentTimelineIndex = 0;
let timelineSpeed = 8;
let timelineCountryFilter = 'all';
let timelineStartDate = null;
let timelineEndDate = null;
let filtersApplied = false;
let timelinepaused = false;

// Main map variables
let map;
let actualLayer;
let predictionLayer;
let table;
let countryChart;
let casesDeathsChart;
let timelineChart;
let mapTimelineChart;
let allData = {
    actual: [],
    prediction: []
};
let countryFilter = 'all';

// Toggle variables
let showActualOutbreaks = true;
let showPredictedOutbreaks = true;

const MAP_BOUNDS = L.latLngBounds(
    L.latLng(-60, -180),
    L.latLng(85, 180)
);

// Function to setup outbreak toggles
function setupOutbreakToggles() {
    const toggleActualBtn = document.getElementById('toggleActual');
    const togglePredictedBtn = document.getElementById('togglePredicted');
    
    // Set initial states
    updateToggleButtons();
    
    // Toggle Actual Outbreaks
    toggleActualBtn.addEventListener('click', function() {
        showActualOutbreaks = !showActualOutbreaks;
        updateMapLayers();
        updateToggleButtons();
    });
    
    // Toggle Predicted Outbreaks
    togglePredictedBtn.addEventListener('click', function() {
        showPredictedOutbreaks = !showPredictedOutbreaks;
        updateMapLayers();
        updateToggleButtons();
    });
}

// Update the map layers based on toggle states
function updateMapLayers() {
    if (showActualOutbreaks) {
        if (!map.hasLayer(actualLayer)) {
            map.addLayer(actualLayer);
        }
    } else {
        if (map.hasLayer(actualLayer)) {
            map.removeLayer(actualLayer);
        }
    }
    
    if (showPredictedOutbreaks) {
        if (!map.hasLayer(predictionLayer)) {
            map.addLayer(predictionLayer);
        }
    } else {
        if (map.hasLayer(predictionLayer)) {
            map.removeLayer(predictionLayer);
        }
    }
}

// Update the toggle button styles
function updateToggleButtons() {
    const toggleActualBtn = document.getElementById('toggleActual');
    const togglePredictedBtn = document.getElementById('togglePredicted');
    
    if (showActualOutbreaks) {
        toggleActualBtn.classList.remove('btn-outline-success');
        toggleActualBtn.classList.add('btn-success');
        toggleActualBtn.style.color = 'white';
    } else {
        toggleActualBtn.classList.remove('btn-success');
        toggleActualBtn.classList.add('btn-outline-success');
        toggleActualBtn.style.color = '#dc3545'; // Red color for text
    }
    
    if (showPredictedOutbreaks) {
        togglePredictedBtn.classList.remove('btn-outline-primary');
        togglePredictedBtn.classList.add('btn-primary');
        togglePredictedBtn.style.color = 'white';
    } else {
        togglePredictedBtn.classList.remove('btn-primary');
        togglePredictedBtn.classList.add('btn-outline-primary');
        togglePredictedBtn.style.color = '#dc3545'; // Red color for text
    }
}

// Function to clear all predictions from the map and server
function clearAllPredictions() {
    // Clear prediction layer from map
    if (predictionLayer) {
        predictionLayer.clearLayers();
    }
    
    // Clear prediction cache on server
    $.ajax({
        url: '/api/clear_predictions',
        type: 'POST',
        success: function(response) {
            console.log('All predictions cleared:', response);
        },
        error: function(xhr) {
            console.error('Error clearing predictions:', xhr.responseJSON?.error || 'Server error');
        }
    });
    
    // Reset prediction text
    $('#predictionText').html('Select options and click predict');
}

// Function to check if there are any predictions and clear them if needed
function checkAndClearPredictions() {
    $.get('/api/has_predictions')
        .done(function(data) {
            if (data.has_predictions) {
                // Clear predictions if they exist
                clearAllPredictions();
            }
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
            console.error('Error checking predictions:', textStatus, errorThrown);
        });
}

// Function to calculate total predicted outbreaks for all countries
function calculateTotalOutbreaksForAllCountries() {
    let totalOutbreaks = 0;
    
    // Sum up all prediction outbreaks
    allData.prediction.forEach(item => {
        totalOutbreaks += parseInt(item.cases) || 0;
    });
    
    return totalOutbreaks;
}

// Function to check if predictions exist for current selection
function hasPredictionsForCurrentSelection() {
    const selectedCountry = $('#predictionCountry').val();
    
    if (selectedCountry === 'all') {
        return allData.prediction.length > 0;
    } else {
        return allData.prediction.some(item => item.country === selectedCountry);
    }
}

// Function to update the prediction display with total outbreaks
function updatePredictionDisplay(response, country, interval) {
    let displayText = `For ${interval} `;
    
    if (interval === 'weekly') {
        displayText += `starting <strong>${response.date}</strong>:<br>`;
    } else if (interval === 'monthly') {
        displayText += `of <strong>${response.date.substring(0,7)}</strong>:<br>`;
    } 
    
    if (country !== 'all') {
        displayText += `in <strong>${country}</strong>:<br>`;
        displayText += `<span style="font-size: 2rem;">${response.predicted_outbreaks}</span> predicted outbreaks`;
    } else {
        // For "All Countries", show the total outbreaks
        const totalOutbreaks = calculateTotalOutbreaksForAllCountries();
        displayText += `across <strong>all countries</strong>:<br>`;
        displayText += `<span style="font-size: 2rem;">${totalOutbreaks}</span> total predicted outbreaks`;
    }
    
    $('#predictionText').html(displayText);
}

// Add this function to clear predictions
function clearPredictions() {
    // Clear prediction layer
    if (predictionLayer) {
        predictionLayer.clearLayers();
    }
    
    // Clear prediction cache on server
    $.ajax({
        url: '/api/clear_predictions',
        type: 'POST',
        success: function(response) {
            console.log('Predictions cleared:', response);
            
            // Also clear the prediction text
            $('#predictionText').html('Select options and click predict');
        },
        error: function(xhr) {
            console.error('Error clearing predictions:', xhr.responseJSON?.error || 'Server error');
        }
    });
}

// Initialize timeline when the tab is shown
$('#timeline-tab').on('shown.bs.tab', function() {
    initTimelineMap();
    setupTimelineFilters();
});

// Initialize the timeline map when the filter tab is shown
$('#filter-tab').on('shown.bs.tab', function() {
    initTimelineMap();
    setupTimelineFilters();
});

// Initialize timeline map
function initTimelineMap() {
    if (timelineMap) {
        timelineMap.remove();
    }
    
    try {
        timelineMap = L.map('timeline-map', {
            preferCanvas: true,
            fullscreenControl: true,
            worldCopyJump: false,
            maxBounds: MAP_BOUNDS,
            maxBoundsViscosity: 1.0
        }).setView([20, 0], 2);
        
        // Add base layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            noWrap: true,
            maxZoom: 19,
            subdomains: 'abcd'
        }).addTo(timelineMap);
        
        // Initialize timeline layer as a marker cluster group
        timelineLayer = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 40,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            iconCreateFunction: function(cluster) {
                const childCount = cluster.getChildCount();
                let sizeClass = 'small';
                if (childCount > 50) sizeClass = 'large';
                else if (childCount > 20) sizeClass = 'medium';
                
                const size = childCount > 50 ? 50 : childCount > 20 ? 40 : 30;
                
                return L.divIcon({
                    html: '<div><span>' + childCount + '</span></div>',
                    className: 'timeline-marker-cluster timeline-marker-cluster-' + sizeClass,
                    iconSize: new L.Point(size, size)
                });
            }
        }).addTo(timelineMap);
        
        // Add scale control
        L.control.scale({
            position: 'bottomleft',
            imperial: false,
            metric: true
        }).addTo(timelineMap);
        
        // Add legend for timeline map
        const legend = L.control({position: 'bottomright'});
        legend.addTo(timelineMap);
        
        $('.map-placeholder').remove();
    } catch (error) {
        console.error('Timeline map initialization error:', error);
    }
}

// Helper functions to calculate circle and font sizes based on case count
function calculateCircleSize(cases) {
    const caseCount = parseInt(cases) || 0;
    if (caseCount === 0) return 30;
    if (caseCount <= 10) return 35;
    if (caseCount <= 50) return 45;
    if (caseCount <= 100) return 55;
    return 65;
}

function calculateFontSize(cases) {
    const caseCount = parseInt(cases) || 0;
    if (caseCount === 0) return 12;
    if (caseCount <= 10) return 14;
    if (caseCount <= 50) return 16;
    if (caseCount <= 100) return 18;
    return 20;
}

// Set up timeline filters
function setupTimelineFilters() {
    // Populate country options
    const countries = new Set();
    allData.actual.forEach(item => countries.add(item.country));
    
    const timelineCountryOptions = $('#timelineCountryOptions');
    timelineCountryOptions.empty();
    countries.forEach(country => {
        timelineCountryOptions.append(`<option value="${country}">`);
    });
    
    // Clear filters button
    $('#clearTimelineFilters').click(function() {
        $('#timelineCountryFilter').val('');
        $('#timelineStartDate').val('');
        $('#timelineEndDate').val('');
        timelineCountryFilter = 'all';
        timelineStartDate = null;
        timelineEndDate = null;
        filtersApplied = false;
        
        updateFilterStatus();
        $('#timelineFilterStatus').removeClass('alert-warning').addClass('alert-info');
        $('#currentDateDisplay').text('No filters applied. Click play to start timeline.');
    });
    
    // Apply filters button
    $('#applyTimelineFilters').click(function() {
        timelineCountryFilter = $('#timelineCountryFilter').val().trim() || 'all';
        
        const startDateVal = $('#timelineStartDate').val();
        const endDateVal = $('#timelineEndDate').val();
        
        timelineStartDate = startDateVal ? new Date(startDateVal) : null;
        timelineEndDate = endDateVal ? new Date(endDateVal) : null;
        
        // Validate date range
        if (timelineStartDate && timelineEndDate && timelineStartDate > timelineEndDate) {
            alert('Start date cannot be after end date');
            return;
        }
        
        filtersApplied = timelineCountryFilter !== 'all' || timelineStartDate || timelineEndDate;
        
        if (filtersApplied) {
            $('#timelineFilterStatus').removeClass('alert-info').addClass('alert-warning');
        } else {
            $('#timelineFilterStatus').removeClass('alert-warning').addClass('alert-info');
        }
        
        updateFilterStatus();
        
        // Process data with filters
        processTimelineDataWithFilters();
    });
    
    // Setup timeline controls
    setupTimelineControls();
    
    // Initialize filter status
    updateFilterStatus();
}

// Update filter status display
function updateFilterStatus() {
    let statusText = 'Currently showing: ';
    
    if (timelineCountryFilter === 'all') {
        statusText += 'All countries';
    } else {
        statusText += `Country: ${timelineCountryFilter}`;
    }
    
    statusText += ', ';
    
    if (timelineStartDate && timelineEndDate) {
        statusText += `Dates: ${formatDateForDisplay(timelineStartDate)} to ${formatDateForDisplay(timelineEndDate)}`;
    } else if (timelineStartDate) {
        statusText += `From: ${formatDateForDisplay(timelineStartDate)}`;
    } else if (timelineEndDate) {
        statusText += `Until: ${formatDateForDisplay(timelineEndDate)}`;
    } else {
        statusText += 'All dates';
    }
    
    $('#timelineFilterStatus').html(`<i class="fas fa-info-circle"></i> ${statusText}`);
}

// NEW: Function to populate the prediction country dropdown
function populatePredictionCountryFilter() {
    const predictionCountrySelect = $('#predictionCountry');
    const countries = new Set();
    
    allData.actual.forEach(item => countries.add(item.country));
    
    // Clear existing options except the first one
    predictionCountrySelect.find('option:not(:first)').remove();
    
    // Add countries to dropdown
    countries.forEach(country => {
        predictionCountrySelect.append(`<option value="${country}">${country}</option>`);
    });
}

// Process data for timeline with filters
function processTimelineDataWithFilters() {
    timelineData = [];
    
    // Extract and sort data by date
    allData.actual.forEach(item => {
        if (item.start_date && item.lat && item.lon) {
            // Apply country filter if set
            if (timelineCountryFilter !== 'all' && item.country !== timelineCountryFilter) {
                return;
            }
            
            // Parse date - handle different formats
            let dateParts;
            if (item.start_date.includes('/')) {
                dateParts = item.start_date.split('/');
            } else if (item.start_date.includes('-')) {
                dateParts = item.start_date.split('-');
            } else {
                return; // Skip if date format is unknown
            }
            
            // Create date object (assuming YYYY/MM/DD or YYYY-MM-DD format)
            const date = new Date(
                parseInt(dateParts[0]),
                parseInt(dateParts[1]) - 1, // Months are 0-indexed
                parseInt(dateParts[2]) || 1 // Default to 1st if day is missing
            );
            
            // Apply date range filter if set
            if (timelineStartDate && date < timelineStartDate) {
                return;
            }
            if (timelineEndDate && date > timelineEndDate) {
                return;
            }
            
            if (!isNaN(date.getTime())) {
                timelineData.push({
                    date: date,
                    formattedDate: formatDateForDisplay(date),
                    data: item,
                    timestamp: date.getTime()
                });
            }
        }
    });
    
    // Sort by date
    timelineData.sort((a, b) => a.timestamp - b.timestamp);
    
    // Setup timeline controls
    if (timelineData.length > 0) {
        $('#currentDateDisplay').text(`Date: ${timelineData[0].formattedDate}`);
        $('#outbreakCount').text('0 outbreaks');
        
        // Reset to beginning
        currentTimelineIndex = 0;
        updateTimelineDisplay();
    } else {
        $('#currentDateDisplay').text('No data available for selected filters');
        $('#outbreakCount').text('0 outbreaks');
        timelineLayer.clearLayers();
    }
}

// Format date for display
function formatDateForDisplay(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Setup timeline controls
function setupTimelineControls() {
    // Play button
    $('#playTimeline').off('click').on('click', function() {
        if (!isTimelinePlaying) {
            // If no filters are explicitly applied, process all data
            if (!filtersApplied && timelineData.length === 0) {
                timelineCountryFilter = 'all';
                timelineStartDate = null;
                timelineEndDate = null;
                processTimelineDataWithFilters();
            }
            
            playTimeline();
        }
    });
    
    // Pause button
    $('#pauseTimeline').off('click').on('click', function() {
        pauseTimeline();
    });
    
    // Reset button
    $('#resetTimeline').off('click').on('click', function() {
        resetTimeline();
    });
    
    // Speed control
    $('#timelineSpeed').off('input').on('input', function() {
        timelineSpeed = parseInt($(this).val());
        updateSpeedDisplay();
        
        // If currently playing, restart with new speed
        if (isTimelinePlaying) {
            pauseTimeline();
            playTimeline();
        }
    });
    
    updateSpeedDisplay();
}

// Update speed display text
function updateSpeedDisplay() {
    let speedText;
    if (timelineSpeed <= 3) {
        speedText = 'Slow speed';
    } else if (timelineSpeed <= 7) {
        speedText = 'Medium speed';
    } else {
        speedText = 'Fast speed';
    }
    $('#speedValue').text(speedText);
}

// Play the timeline animation
function playTimeline() {
    isTimelinePlaying = true;
    timelinePaused = false;
    $('#playTimeline').prop('disabled', true);
    $('#pauseTimeline').prop('disabled', false);
    
    // Calculate interval based on speed (faster speed = shorter interval)
    const interval = 550 - (timelineSpeed * 50);
    
    timelineInterval = setInterval(() => {
        if (currentTimelineIndex < timelineData.length - 1) {
            currentTimelineIndex++;
            updateTimelineDisplay();
        } else {
            pauseTimeline();
        }
    }, interval);
}

// Pause the timeline animation
function pauseTimeline() {
    isTimelinePlaying = false;
    timelinePaused = true;
    clearInterval(timelineInterval);
    $('#playTimeline').prop('disabled', false);
    $('#pauseTimeline').prop('disabled', true);
}

// Reset the timeline to beginning
function resetTimeline() {
    pauseTimeline();
    currentTimelineIndex = 0;
    updateTimelineDisplay();
}

// Update the timeline display
function updateTimelineDisplay() {
    // Clear previous markers
    timelineLayer.clearLayers();
    
    // Add all outbreaks up to current date
    const currentDateData = timelineData[currentTimelineIndex];
    const currentDate = currentDateData.date;
    
    // Find all outbreaks that occurred on or before current date
    const outbreaksToShow = timelineData.filter(item => 
        item.timestamp <= currentDate.getTime()
    );
    
    // Add markers for these outbreaks as big red circles with case numbers
    outbreaksToShow.forEach(item => {
        const cases = item.data.cases || '0';
        const size = calculateCircleSize(cases);
        const fontSize = calculateFontSize(cases);
        
        // Create a custom red circle with case number - PERFECTLY CENTERED
        const circleIcon = L.divIcon({
            className: 'big-red-circle-marker',
            html: `<div class="big-red-circle big-red-circle-pulse" style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: ${fontSize}px; line-height: 1; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${cases}</span>
                </div>`,
            iconSize: [size, size],
            iconAnchor: [size/2, size/2]
        });
        
        const marker = L.marker([item.data.lat, item.data.lon], {
            icon: circleIcon,
            title: `${item.data.location}: ${cases} cases`
        }).bindPopup(createPopupContent(item.data, 'actual'));
        
        timelineLayer.addLayer(marker);
    });
    
    // Update display information
    $('#currentDateDisplay').text(`Date: ${currentDateData.formattedDate}`);
    $('#outbreakCount').text(`${outbreaksToShow.length} outbreaks`);
    
    // Update progress bar
    const progress = ((currentTimelineIndex + 1) / timelineData.length) * 100;
    $('#timelineProgress').css('width', `${progress}%`);
    
    // Auto-fit map to show all markers if not too zoomed out
    if (outbreaksToShow.length > 0) {
        const bounds = timelineLayer.getBounds();
        if (bounds.isValid()) {
            timelineMap.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 8
            });
        }
    }
}

// Add this function to prevent map clicks when interacting with controls
function setupMapControls() {
    const mapControls = document.querySelector('.map-overlay-controls');
    
    // Function to update control styling on resize
    function updateControlsStyle() {
        if (window.innerWidth <= 768) {
            // Mobile view - full width at bottom
            mapControls.style.left = '10px';
            mapControls.style.right = '10px';
            mapControls.style.bottom = '10px';
            mapControls.style.maxWidth = 'none';
        } else {
            // Desktop view - fixed top right (changed from bottom right)
            mapControls.style.left = 'auto';
            mapControls.style.right = '20px';
            mapControls.style.top = '20px'; // Changed from bottom to top
            mapControls.style.bottom = 'auto';
            mapControls.style.maxWidth = '280px';
        }
    }
    
    // Prevent map clicks when interacting with controls
    const controlElements = mapControls.querySelectorAll('*');
    controlElements.forEach(element => {
        element.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        element.addEventListener('mousedown', function(e) {
            e.stopPropagation();
        });
        element.addEventListener('mouseup', function(e) {
            e.stopPropagation();
        });
    });
    
    // Make the control container draggable but prevent map interaction
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    mapControls.addEventListener('mousedown', function(e) {
        // Only make draggable if clicking on the header or empty areas
        if (e.target === mapControls || e.target.classList.contains('card-title')) {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(window.getComputedStyle(mapControls).left);
            startTop = parseInt(window.getComputedStyle(mapControls).top);
            mapControls.style.cursor = 'grabbing';
            e.stopPropagation();
        }
    });
    
    document.addEventListener('mousemove', function(e) {
        if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            mapControls.style.left = (startLeft + dx) + 'px';
            mapControls.style.top = (startTop + dy) + 'px';
            e.preventDefault();
            e.stopPropagation();
        }
    });
    
    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            mapControls.style.cursor = 'default';
        }
    });
    
    // Initial style setup
    updateControlsStyle();
    
    // Update on window resize
    window.addEventListener('resize', updateControlsStyle);
}

// Handle tab change to destroy timeline map when not visible
$('button[data-bs-toggle="tab"]').on('show.bs.tab', function(e) {
    if (e.target.id !== 'timeline-tab' && timelineMap) {
        pauseTimeline();
    }
});

// Helper functions for date calculations
function getNextWeek() {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    return nextWeek;
}

function getNextMonth() {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return nextMonth;
}

function getNextYear() {
    const today = new Date();
    return today.getFullYear() + 1;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatMonth(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

// Setup date input with default values
function setupDateInput() {
    const container = $('#dateInputContainer');
    const interval = $('#predictionInterval').val();
    
    let html = '';
    if (interval === 'weekly') {
        const nextWeek = getNextWeek();
        const minDate = formatDate(nextWeek);
        // Set default to next week
        const defaultDate = formatDate(nextWeek);
        html = `<label for="predictionDate" class="form-label">Select Week Start Date</label>
                <input type="date" class="form-control" id="predictionDate" min="${minDate}" value="${defaultDate}">`;
    } 
    else if (interval === 'monthly') {
        const nextMonth = getNextMonth();
        const minMonth = formatMonth(nextMonth);
        // Set default to next month
        const defaultMonth = formatMonth(nextMonth);
        html = `<label for="predictionMonth" class="form-label">Select Month</label>
                <input type="month" class="form-control" id="predictionMonth" min="${minMonth}" value="${defaultMonth}">`;
    }
    container.html(html);
}

function validateDate(interval, dateValue) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time part for accurate comparison
    
    if (interval === 'weekly') {
        const selectedDate = new Date(dateValue);
        selectedDate.setHours(0, 0, 0, 0);
        const nextWeek = getNextWeek();
        nextWeek.setHours(0, 0, 0, 0);
        
        // Allow dates that are exactly 7 days from today
        return selectedDate.getTime() >= nextWeek.getTime();
    } 
    else if (interval === 'monthly') {
        const selectedDate = new Date(dateValue + '-01');
        selectedDate.setHours(0, 0, 0, 0);
        const nextMonth = getNextMonth();
        nextMonth.setHours(0, 0, 0, 0);
        
        // Allow dates that are in the next month
        return selectedDate.getTime() >= nextMonth.getTime();
    }
    return false;
}

$(document).ready(function() {
    // Check and clear any existing predictions
    checkAndClearPredictions();
    
    // Initialize the rest of the app
    initMap();
    fetchData();
    setupEventListeners();
    setupDateInput(); // Set up date input with default values
    
    // Setup outbreak toggles
    setupOutbreakToggles();

    // Setup map controls - ADD THIS LINE
    setupMapControls();
});

function initMap() {
    try {
        map = L.map('map', {
            preferCanvas: true,
            fullscreenControl: true,
            worldCopyJump: false,
            maxBounds: MAP_BOUNDS,
            maxBoundsViscosity: 1.0
        }).setView([20, 0], 2);
        
        // Add scale control
        L.control.scale({
            position: 'bottomleft',
            imperial: false,
            metric: true
        }).addTo(map);
        
        // The default base layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            noWrap: true,
            maxZoom: 19
        }).addTo(map);
        
        // Initialize layers with separate cluster groups
        actualLayer = L.markerClusterGroup({
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: 14,
            spiderLegPolylineOptions: {weight: 1.5, color: '#222', opacity: 0.5},
            iconCreateFunction: function (cluster) {
                const childCount = cluster.getChildCount();
                let sizeClass = 'small';
                if (childCount > 50) sizeClass = 'large';
                else if (childCount > 20) sizeClass = 'medium';
                
                const size = childCount > 50 ? 50 : childCount > 20 ? 40 : 30;
                
                return L.divIcon({
                    html: '<div><span>' + childCount + '</span></div>',
                    className: 'marker-cluster marker-cluster-' + sizeClass,
                    iconSize: new L.Point(size, size)
                });
            }
        }).addTo(map);
        
        // Create a separate cluster group for predictions with blue styling
        predictionLayer = L.markerClusterGroup({
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: 14,
            maxClusterRadius: 40, // Adjust cluster radius for predictions
            spiderLegPolylineOptions: {weight: 1.5, color: '#222', opacity: 0.5},
            iconCreateFunction: function (cluster) {
                // Calculate the total number of outbreaks in this cluster
                let totalOutbreaks = 0;
                cluster.getAllChildMarkers().forEach(function(marker) {
                    // Get the outbreak count from the marker's data
                    const outbreakCount = parseInt(marker.options.outbreakCount) || 0;
                    totalOutbreaks += outbreakCount;
                });
                
                let sizeClass = 'small';
                if (totalOutbreaks > 50) sizeClass = 'large';
                else if (totalOutbreaks > 20) sizeClass = 'medium';
                
                const size = totalOutbreaks > 50 ? 50 : totalOutbreaks > 20 ? 40 : 30;
                
                // Create blue cluster icons for predictions with centered total count
                return L.divIcon({
                    html: '<div class="prediction-cluster" style="width: ' + size + 'px; height: ' + size + 'px; background-color: #4575b4; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid rgba(255, 255, 255, 0.8);">' +
                          '<span style="color: white; font-weight: bold; font-size: ' + (size / 2.5) + 'px;">' + totalOutbreaks + '</span>' +
                          '</div>',
                    className: 'prediction-cluster-icon',
                    iconSize: new L.Point(size, size),
                    iconAnchor: [size/2, size/2]
                });
            }
        }).addTo(map);
        
        const legend = L.control({position: 'bottomright'});
        legend.onAdd = function() {
            const div = L.DomUtil.create('div', 'legend');
            div.innerHTML = `
                <div class="d-flex align-items-center mb-2">
                    <i class="legend-icon" style="background: #1a9850; width: 20px; height: 20px;"></i>
                    <span class="ms-2">Actual Outbreak (Green)</span>
                </div>
                <div class="d-flex align-items-center mb-2">
                    <i class="legend-icon" style="background: #4575b4; width: 20px; height: 20px;"></i>
                    <span class="ms-2">Predicted Outbreak (Blue)</span>
                </div>
            `;
            return div;
        };
        legend.addTo(map);
        
        $('.map-placeholder').remove();
    } catch (error) {
    console.error('Map initialization error:', error);
    }
}

function calculateRadius(cases) {
    if (cases === 0) return 25;
    if (cases <= 10) return 30;
    if (cases <= 50) return 40;
    if (cases <= 100) return 50;
    return 60;
}

function fetchData() {
    $.get('/api/data')
        .done(function(data) {
            if (data && (data.actual.length > 0 || data.prediction.length > 0)) {
                allData = data;
                updateMap();
                initTable();
                initCharts();
                updateStatistics();
                updateDateRange();
                populateCountryFilter();
                populatePredictionCountryFilter();
                updateMapTimelineChart();
                
                // Ensure prediction layer is always visible
                if (predictionLayer) {
                    predictionLayer.bringToFront();
                }
            }
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
            console.error('Error fetching data:', textStatus, errorThrown);
        });
}

function refreshData() {
    // Store the currently selected country before refreshing
    const selectedCountry = $('#predictionCountry').val();
    
    $.get('/api/data')
        .done(function(data) {
            if (data && (data.actual.length > 0 || data.prediction.length > 0)) {
                allData = data;
                updateMap();
                initTable();
                initCharts();
                updateStatistics();
                updateDateRange();
                populateCountryFilter();
                populatePredictionCountryFilter();
                updateMapTimelineChart();
                
                // Restore the selected country after refresh
                $('#predictionCountry').val(selectedCountry);
                
                // Always add prediction layer to map and bring to front
                if (predictionLayer) {
                    predictionLayer.addTo(map);
                    predictionLayer.bringToFront();
                    map.invalidateSize(true);
                }
                
                // Update map layers based on toggle states
                updateMapLayers();
                
                // Only show prediction text if we have predictions for the current country
                if (selectedCountry === 'all' && allData.prediction.length > 0) {
                    const totalOutbreaks = calculateTotalOutbreaksForAllCountries();
                    $('#predictionText').html(`
                        For ${$('#predictionInterval').val()} across <strong>all countries</strong>:<br>
                        <span style="font-size: 2rem;">${totalOutbreaks}</span> total predicted outbreaks
                    `);
                } else if (selectedCountry !== 'all') {
                    // Find predictions for the selected country
                    let countryOutbreaks = 0;
                    allData.prediction.forEach(item => {
                        if (item.country === selectedCountry) {
                            countryOutbreaks += parseInt(item.cases) || 0;
                        }
                    });
                    
                    if (countryOutbreaks > 0) {
                        $('#predictionText').html(`
                            For ${$('#predictionInterval').val()} in <strong>${selectedCountry}</strong>:<br>
                            <span style="font-size: 2rem;">${countryOutbreaks}</span> predicted outbreaks
                        `);
                    } else {
                        $('#predictionText').html('Select options and click predict');
                    }
                } else {
                    $('#predictionText').html('Select options and click predict');
                }
            }
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
            console.error('Error fetching data:', textStatus, errorThrown);
        });
}

function updateMap() {
    try {
        actualLayer.clearLayers();
        predictionLayer.clearLayers();
        
        let actualCount = 0;
        let predictionCount = 0;
        
        // Always add actual outbreaks - ALL IN GREEN
        allData.actual.forEach(item => {
            if (item.lat && item.lon && shouldDisplay(item, 'actual')) {
                const cases = parseInt(item.cases) || 0;
                const radius = calculateRadius(cases);
                
                // Always use green for actual outbreaks
                const circle = L.circleMarker([item.lat, item.lon], {
                    radius: radius,
                    fillColor: "#1a9850", // Green color
                    color: "white",
                    weight: 3,
                    opacity: 0.9,
                    fillOpacity: 0.85,
                    className: 'custom-circle-marker actual-marker',
                    gradient: true
                }).bindPopup(createPopupContent(item, 'actual'));
                
                // Add pulse animation for active outbreaks
                if (item.status === 'active') {
                    circle.setStyle({
                        className: 'custom-circle-marker actual-marker pulse-marker',
                        fillOpacity: 0.9
                    });
                }
                
                // Always show case number (permanent tooltip)
                circle.bindTooltip(`${cases}`, {
                    permanent: true,
                    direction: 'center',
                    className: 'circle-label actual-label',
                    offset: [0, 0]
                });
                
                circle.on('mouseover', function() {
                    this.setStyle({
                        weight: 4,
                        fillOpacity: 0.9
                    });
                });
                
                circle.on('mouseout', function() {
                    this.setStyle({
                        weight: 3,
                        fillOpacity: 0.85
                    });
                });
                
                actualLayer.addLayer(circle);
                actualCount++;
            }
        });
        
        // Always add prediction outbreaks
        allData.prediction.forEach(item => {
            if (item.lat && item.lon && shouldDisplay(item, 'prediction')) {
                const cases = parseInt(item.cases) || 0;
                const radius = calculateRadius(cases);
                
                // Use blue for predictions with distinct styling
                const circle = L.circleMarker([item.lat, item.lon], {
                    radius: radius,
                    fillColor: "#4575b4", // Blue color for predictions
                    color: "white",
                    weight: 4, // Thicker border for predictions
                    opacity: 0.9,
                    fillOpacity: 0.8,
                    className: 'custom-circle-marker prediction-marker prediction-circle-marker prediction-pulse-marker',
                    gradient: true,
                    outbreakCount: cases // Store the outbreak count for clustering
                }).bindPopup(createPopupContent(item, 'prediction'));
                
                // Always show case number (permanent tooltip)
                circle.bindTooltip(`${cases}`, {
                    permanent: true,
                    direction: 'center',
                    className: 'circle-label prediction-label',
                    offset: [0, 0]
                });
                
                circle.on('mouseover', function() {
                    this.setStyle({
                        weight: 5,
                        fillOpacity: 0.9
                    });
                });
                
                circle.on('mouseout', function() {
                    this.setStyle({
                        weight: 4,
                        fillOpacity: 0.8
                    });
                });
                
                predictionLayer.addLayer(circle);
                predictionCount++;
            }
        });
        
        // Always add both layers to map
        actualLayer.addTo(map);
        predictionLayer.addTo(map);
        
        // Bring prediction layer to front to ensure it's always visible
        predictionLayer.bringToFront();
        
        // Update map layers based on toggle states
        updateMapLayers();
        
        if (map && (actualCount > 0 || predictionCount > 0)) {
            setTimeout(() => {
                map.invalidateSize(true);
                
                // Create a combined bounds of both layers
                let combinedBounds = L.latLngBounds();
                
                if (actualLayer.getBounds().isValid()) {
                    combinedBounds.extend(actualLayer.getBounds());
                }
                
                if (predictionLayer.getBounds().isValid()) {
                    combinedBounds.extend(predictionLayer.getBounds());
                }
                
                if (combinedBounds.isValid()) {
                    map.fitBounds(combinedBounds, {
                        padding: [50, 50],
                        maxZoom: 12
                    });
                }
                
                // Force a refresh of the map layers
                map._onResize();
                
            }, 300);
        }
        
        // Update the timeline chart
        updateMapTimelineChart();
    } catch (error) {
        console.error('Error updating map:', error);
    }
}

function updateMapTimelineChart() {
    try {
        if (mapTimelineChart) {
            mapTimelineChart.destroy();
        }
        
        const timelineData = {};
        
        // Filter data based on current filters
        allData.actual.forEach(item => {
            if (shouldDisplay(item, 'actual') && item.start_date) {
                const month = item.start_date.substring(0, 7); // YYYY-MM format
                timelineData[month] = (timelineData[month] || 0) + 1;
            }
        });
        
        // Sort months chronologically
        const sortedMonths = Object.keys(timelineData).sort();
        
        const ctx = document.getElementById('mapTimelineChart');
        if (ctx) {
            mapTimelineChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: sortedMonths,
                    datasets: [{
                        label: 'Outbreaks',
                        data: sortedMonths.map(month => timelineData[month]),
                        fill: true,
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1,
                        pointBackgroundColor: 'rgb(75, 192, 192)',
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: { 
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of Outbreaks',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                stepSize: 10,
                                font: {
                                    size: 10
                                },
                                callback: function(value, index, ticks) {
                                    // Only show multiples of 10
                                    if (value % 10 === 0) {
                                        return value;
                                    }
                                    return '';
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Months',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                font: {
                                    size: 10
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false,
                        },
                        title: {
                            display: false,
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error updating map timeline chart:', error);
    }
}

function shouldDisplay(item, type) {
    // Get the active tab
    const activeTab = $('#dashboardTabs .nav-link.active').attr('id');
    
    // If we're on the map tab, apply the country filter
    if (activeTab === 'map-tab') {
        const filterValue = $('#countryFilter').val().trim();
        if (filterValue && filterValue !== 'all' && item.country !== filterValue) return false;
    }
    
    return true;
}

function createPopupContent(item, type) {
    const isPrediction = type === 'prediction';
    return `
        <div class="map-popup">
            <h5>${item.location}</h5>
            <div class="mb-1"><strong>Country:</strong> ${item.country}</div>
            <div class="mb-1"><strong>Type:</strong> ${isPrediction ? 'Predicted' : 'Actual'}</div>
            <div class="mb-1"><strong>Start:</strong> ${item.start_date || 'N/A'}</div>
            ${isPrediction ? '' : `<div class="mb-1"><strong>End:</strong> ${item.end_date || 'N/A'}</div>`}
            <div class="mb-1"><strong>Outbreaks:</strong> ${item.cases || '0'}</div>
            ${isPrediction ? '' : `<div><strong>Deaths:</strong> ${item.deaths || '0'}</div>`}
            ${isPrediction ? '<div class="text-info mt-2"><i class="fas fa-robot"></i> AI Prediction</div>' : ''}
        </div>
    `;
}

function initTable() {
    try {
        if ($.fn.DataTable.isDataTable('#outbreakTable')) {
            table.destroy();
        }
        
        const tableData = [];
        
        allData.actual.forEach(item => {
            if (shouldDisplay(item, 'actual')) {
                tableData.push({
                    type: 'Actual',
                    country: item.country,
                    location: item.location,
                    start_date: item.start_date || 'N/A',
                    end_date: item.end_date || 'N/A',
                    cases: item.cases || '0',
                    deaths: item.deaths || '0'
                });
            }
        });
        
        // Initialize DataTable with proper column widths and default sorting
        table = $('#outbreakTable').DataTable({
            data: tableData,
            columns: [
                { 
                    data: 'type',
                    width: '10%'
                },
                { 
                    data: 'country',
                    width: '15%'
                },
                { 
                    data: 'location',
                    width: '20%'
                },
                { 
                    data: 'start_date',
                    width: '15%'
                },
                { 
                    data: 'end_date',
                    width: '15%'
                },
                { 
                    data: 'cases',
                    width: '12%'
                },
                { 
                    data: 'deaths',
                    width: '13%'
                }
            ],
            pageLength: 10,
            order: [[3, 'desc']], // Sort by start_date (4th column) in descending order
            scrollY: '50vh',
            scrollCollapse: true,
            autoWidth: false,
            responsive: false, // Changed from true to false to prevent column squeezing
            dom: '<"d-flex justify-content-between align-items-center mb-3"<"d-flex align-items-center"l><"d-flex align-items-center"<"me-2"f><"date-sort">>>rtip',
            initComplete: function() {
                // Add date sorting dropdown
                const dateSortHtml = `
                    <div class="date-sort-container">
                        <select class="form-select form-select-sm" id="dateSortSelect">
                            <option value="desc">Newest First</option>
                            <option value="asc">Oldest First</option>
                        </select>
                    </div>
                `;
                $('.date-sort').html(dateSortHtml);
                
                // Set initial value based on current sort
                $('#dateSortSelect').val('desc');
                
                // Add event listener for date sorting
                $('#dateSortSelect').change(function() {
                    const order = $(this).val() === 'asc' ? 'asc' : 'desc';
                    table.order([3, order]).draw();
                });
                
                // Adjust column widths after initialization
                this.api().columns.adjust();
            }
        });
        
        // Adjust column widths when the table tab is shown
        $('a[data-bs-toggle="tab"]').on('shown.bs.tab', function(e) {
            if (e.target.id === 'table-tab' && table) {
                setTimeout(function() {
                    table.columns.adjust();
                }, 100);
            }
        });
    } catch (error) {
        console.error('Error initializing table:', error);
    }
}

function initCharts() {
    try {
        if (countryChart) countryChart.destroy();
        if (casesDeathsChart) casesDeathsChart.destroy();
        if (timelineChart) timelineChart.destroy();
        
        const countryCounts = {};
        const casesDeathsData = { cases: 0, deaths: 0 };
        const timelineData = {};
        
        allData.actual.forEach(item => {
            countryCounts[item.country] = (countryCounts[item.country] || 0) + 1;
            casesDeathsData.cases += parseInt(item.cases) || 0;
            casesDeathsData.deaths += parseInt(item.deaths) || 0;
            
            if (item.start_date) {
                const month = item.start_date.substring(0, 7);
                timelineData[month] = (timelineData[month] || 0) + 1;
            }
        });
        
        // Calculate non-fatalities (cases that didn't result in death)
        const fatalities = casesDeathsData.deaths;
        const nonFatalities = casesDeathsData.cases - casesDeathsData.deaths;
        
        // Cases vs Deaths Chart (First) - Modified to show Fatalities vs Non-fatalities
        const casesDeathsCtx = document.getElementById('casesDeathsChart');
        if (casesDeathsCtx) {
            casesDeathsChart = new Chart(casesDeathsCtx, {
                type: 'pie',
                data: {
                    labels: ['Non-fatalities', 'Fatalities'],
                    datasets: [{
                        data: [nonFatalities, fatalities],
                        backgroundColor: ['rgba(75, 192, 192, 0.7)', 'rgba(255, 99, 132, 0.7)'],
                        borderColor: ['rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)'],
                        borderWidth: 2
                    }]
                },
                options: { 
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed;
                                    const total = casesDeathsData.cases;
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
        
        // Country Chart (Second) - Always vertical with all countries displayed
        // Country Chart - Vertical bar chart with all country names visible
        const countryCtx = document.getElementById('countryChart');
        if (countryCtx) {
            const countryLabels = Object.keys(countryCounts);
            const countryData = Object.values(countryCounts);
            
            countryChart = new Chart(countryCtx, {
                type: 'bar',
                data: {
                    labels: countryLabels,
                    datasets: [{
                        label: 'Outbreaks by Country',
                        data: countryData,
                        backgroundColor: function(context) {
                            // Color gradient based on value
                            const value = context.raw;
                            const maxValue = Math.max(...countryData);
                            const alpha = 0.6 + (value / maxValue) * 0.4;
                            return `rgba(54, 162, 235, ${alpha})`;
                        },
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                        barThickness: 15, // Fixed thickness for consistent bars
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y', // Vertical chart (horizontal bars)
                    plugins: { 
                        legend: { 
                            display: false 
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${context.label}: ${context.parsed.x} outbreaks`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            title: {
                                display: true,
                                text: 'Countries',
                                font: {
                                    size: 14,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                font: {
                                    size: 10, // Smaller font to fit more labels
                                    weight: 'bold'
                                },
                                autoSkip: false, // Show ALL labels
                                maxRotation: 0, // No rotation
                                minRotation: 0, // No rotation
                                padding: 5,
                                color: '#333',
                                mirror: false
                            },
                            grid: {
                                display: false,
                                drawBorder: false
                            }
                        },
                        x: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of Outbreaks',
                                font: {
                                    size: 14,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                stepSize: 20,
                                font: {
                                    size: 11
                                },
                                precision: 0
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)',
                                drawBorder: false
                            }
                        }
                    },
                    layout: {
                        padding: {
                            left: 10,
                            right: 10,
                            top: 20,
                            bottom: 10
                        }
                    }
                }
            });
            
            // Add scrolling functionality for charts with many countries
            function makeChartScrollable() {
                const chartContainer = document.querySelector('.country-chart-container');
                const chart = document.getElementById('countryChart');
                
                if (chart && chartContainer) {
                    // Add scrollable class if there are many countries
                    if (Object.keys(countryCounts).length > 15) {
                        chartContainer.classList.add('scrollable');
                        
                        // Adjust chart height based on number of countries
                        const barHeight = 30;
                        const totalHeight = Object.keys(countryCounts).length * barHeight + 100;
                        chart.style.height = totalHeight + 'px';
                        chartContainer.style.height = '600px'; // Fixed container height
                        
                        console.log(`Chart made scrollable with ${Object.keys(countryCounts).length} countries`);
                    }
                }
            }
            
            // Call this function after chart initialization
            setTimeout(makeChartScrollable, 500);
        }

        // ============================================================
        // Timeline Chart (Third) - Fixed y-axis configuration
        // ============================================================
        const timelineCtx = document.getElementById('timelineChart');
        if (timelineCtx) {
            const sortedMonths = Object.keys(timelineData).sort();
            timelineChart = new Chart(timelineCtx, {
                type: 'line',
                data: {
                    labels: sortedMonths,
                    datasets: [{
                        label: 'Outbreaks Over Time',
                        data: sortedMonths.map(month => timelineData[month]),
                        fill: false,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1,
                        pointBackgroundColor: 'rgb(75, 192, 192)',
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: { 
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Months',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                font: {
                                    size: 10
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of Outbreaks',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                stepSize: 10,
                                font: {
                                    size: 10
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
}

function updateStatistics() {
    let totalOutbreaks = 0;
    let totalCases = 0;
    let totalDeaths = 0;
    
    allData.actual.forEach(item => {
        totalOutbreaks++;
        totalCases += parseInt(item.cases) || 0;
        totalDeaths += parseInt(item.deaths) || 0;
    });
    
    $('#totalOutbreaks').text(totalOutbreaks);
    $('#totalCases').text(totalCases);
    $('#totalDeaths').text(totalDeaths);
}

function updateDateRange() {
    if (!allData.actual || allData.actual.length === 0) {
        $('#dateRange').text('Date range: No data available');
        return;
    }
    
    // Extract all dates from the data
    const dates = allData.actual
        .filter(item => item.start_date)
        .map(item => {
            // Handle different date formats
            const dateStr = item.start_date;
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                return new Date(parts[0], parts[1] - 1, parts[2]);
            } else if (dateStr.includes('-')) {
                return new Date(dateStr);
            }
            return null;
        })
        .filter(date => date instanceof Date && !isNaN(date));
    
    if (dates.length === 0) {
        $('#dateRange').text('Date range: No valid dates');
        return;
    }
    
    // Find oldest and latest dates
    const oldestDate = new Date(Math.min.apply(null, dates));
    const latestDate = new Date(Math.max.apply(null, dates));
    
    // Format dates for display
    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };
    
    $('#dateRange').text(`Date range: ${formatDate(oldestDate)} to ${formatDate(latestDate)}`);
}

function populateCountryFilter() {
    const countryOptions = $('#countryOptions');
    const countries = new Set();
    
    allData.actual.forEach(item => countries.add(item.country));
    allData.prediction.forEach(item => countries.add(item.country));
    
    countryOptions.empty();
    countries.forEach(country => {
        countryOptions.append(`<option value="${country}">`);
    });
}

function setupEventListeners() {
    // Removed prediction toggle event listener
    
    $('#countryFilter').on('input', function() {
        updateMap();
        initTable();
        updateStatistics();
        initCharts();
        updateMapTimelineChart();
    });
    
    $('#resetFilters').click(function() {
        $('#countryFilter').val('');
        updateMap();
        initTable();
        updateStatistics();
        initCharts();
        updateMapTimelineChart();
    });
    
    // Add this to your setupEventListeners function
    $('#predictionCountry').change(function() {
        const country = $(this).val();
        const interval = $('#predictionInterval').val();
        
        // Clear the prediction display when country changes
        $('#predictionText').html('Select options and click predict');
        
        // Clear any existing predictions from the map
        clearPredictions();
        
        // Clear prediction cache on server
        $.ajax({
            url: '/api/clear_predictions',
            type: 'POST',
            success: function(response) {
                console.log('Predictions cleared:', response);
            },
            error: function(xhr) {
                console.error('Error clearing predictions:', xhr.responseJSON?.error || 'Server error');
            }
        });
        
        // Refresh data to remove any prediction markers
        refreshData();
    });
    
    // Update the tab event listeners with new tab IDs
    $('button[data-bs-toggle="tab"]').on('shown.bs.tab', function(e) {
        if (e.target.id === 'data-tab') {
            setTimeout(() => {
                if (table) {
                    table.columns.adjust();
                }
            }, 100);
        }
        else if (e.target.id === 'chart-tab') {
            setTimeout(() => {
                if (countryChart) countryChart.resize();
                if (casesDeathsChart) casesDeathsChart.resize();
                if (timelineChart) timelineChart.resize();
            }, 300);
        }
        else if (e.target.id === 'map-tab') {
            setTimeout(() => {
                if (map) {
                    map.invalidateSize(true);
                }
                if (mapTimelineChart) {
                    mapTimelineChart.resize();
                }
            }, 300);
        }
        else if (e.target.id === 'filter-tab') {
            setTimeout(() => {
                if (timelineMap) {
                    timelineMap.invalidateSize(true);
                }
            }, 300);
        }
    });
    
    $('#predictionInterval').change(function() {
        setupDateInput();
        
        // Clear predictions when interval changes
        $('#predictionText').html('Select options and click predict');
        clearPredictions();
        
        // Clear prediction cache on server
        $.ajax({
            url: '/api/clear_predictions',
            type: 'POST',
            success: function(response) {
                console.log('Predictions cleared:', response);
            },
            error: function(xhr) {
                console.error('Error clearing predictions:', xhr.responseJSON?.error || 'Server error');
            }
        });
        
        refreshData();
    });
    
    $('#predictButton').click(function() {
        const interval = $('#predictionInterval').val();
        const country = $('#predictionCountry').val(); // Get the selected country
        let dateValue = '';
        
        if (interval === 'weekly') {
            dateValue = $('#predictionDate').val();
        } 
        else if (interval === 'monthly') {
            dateValue = $('#predictionMonth').val();
        }
        else if (interval === 'annually') {
            dateValue = $('#predictionYear').val();
        }
        
        if (!dateValue) {
            alert('Please select a date');
            return;
        }
        
        // Reset validation message
        $('#dateValidationMessage').hide();
        
        if (!validateDate(interval, dateValue)) {
            $('#dateValidationMessage').text('Please select a future date for prediction').show();
            return;
        }
        
        // Clear previous predictions
        clearPredictions();
        
        $('#predictionSpinner').show();
        $('#predictionText').text('Predicting...');
        
        $.ajax({
            url: '/api/predict',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ 
                date: dateValue,
                interval: interval,
                country: country  // Use the selected country, not 'all'
            }),
            success: function(response) {
                if (response.status === 'success') {
                    // Update the prediction display for the specific country
                    updatePredictionDisplay(response, country, interval);
                    
                    // Automatically refresh data to show predictions on map
                    refreshData();
                } else {
                    $('#predictionText').text('Error: ' + response.error);
                }
            },
            error: function(xhr) {
                $('#predictionText').text('Error: ' + (xhr.responseJSON?.error || 'Server error'));
            },
            complete: function() {
                $('#predictionSpinner').hide();
            }
        });
    });
    
    // Add window resize listener for the timeline chart
    $(window).resize(function() {
        if (mapTimelineChart) {
            setTimeout(function() {
                mapTimelineChart.resize();
            }, 300);
        }
    });

    // ADD THIS CODE - Map tab event listener to ensure proper resizing
    $('#map-tab').on('shown.bs.tab', function() {
        setTimeout(function() {
            if (map) {
                map.invalidateSize(true);
            }
            if (mapTimelineChart) {
                mapTimelineChart.resize();
            }
        }, 300);
    });
}

// Also clear predictions when the page is about to be unloaded
$(window).on('beforeunload', function() {
    clearAllPredictions();
});