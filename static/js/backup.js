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

const MAP_BOUNDS = L.latLngBounds(
    L.latLng(-60, -180),
    L.latLng(85, 180)
);

// Initialize timeline when the tab is shown
$('#timeline-tab').on('shown.bs.tab', function() {
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
        legend.onAdd = function() {
            const div = L.DomUtil.create('div', 'legend');
            div.innerHTML = `
                <div class="d-flex align-items-center mb-2">
                    <div class="big-red-circle big-red-circle-pulse" style="width: 40px; height: 40px; font-size: 16px; display: flex; align-items: center; justify-content: center;">
                        <span>5</span>
                    </div>
                    <span class="ms-2">Rabies Outbreak (Number = Cases)</span>
                </div>
                <div class="d-flex align-items-center mb-2">
                    <div class="timeline-marker-cluster" style="width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
                        <span>3</span>
                    </div>
                    <span class="ms-2">Cluster of Outbreaks</span>
                </div>
                <div class="mt-3"><small>Zoom in to see individual outbreaks</small></div>
            `;
            return div;
        };
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
            if (!filtersApplied) {
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
        
        // Create a custom red circle with case number
        const circleIcon = L.divIcon({
            className: 'big-red-circle-marker',
            html: `<div class="big-red-circle big-red-circle-pulse" style="width: ${size}px; height: ${size}px; font-size: ${fontSize}px;">
                      <span>${cases}</span>
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

$(document).ready(function() {
    initMap();
    fetchData();
    setupEventListeners();
    setupDateInput();
});

function setupDateInput() {
    const container = $('#dateInputContainer');
    const interval = $('#predictionInterval').val();
    
    let html = '';
    if (interval === 'weekly') {
        const nextWeek = getNextWeek();
        const minDate = formatDate(nextWeek);
        html = `<label for="predictionDate" class="form-label">Select Week Start Date</label>
                <input type="date" class="form-control" id="predictionDate" min="${minDate}">`;
        setDefaultPredictionDate();
    } 
    else if (interval === 'monthly') {
        const nextMonth = getNextMonth();
        const minMonth = formatMonth(nextMonth);
        html = `<label for="predictionMonth" class="form-label">Select Month</label>
                <input type="month" class="form-control" id="predictionMonth" min="${minMonth}">`;
        setDefaultPredictionMonth();
    }
    else if (interval === 'annually') {
        const nextYear = getNextYear();
        html = `<label for="predictionYear" class="form-label">Select Year</label>
                <input type="number" class="form-control" id="predictionYear" min="${nextYear}" value="${nextYear}">`;
    }
    
    container.html(html);
}

function setDefaultPredictionDate() {
    const nextWeek = getNextWeek();
    $('#predictionDate').val(formatDate(nextWeek));
}

function setDefaultPredictionMonth() {
    const nextMonth = getNextMonth();
    $('#predictionMonth').val(formatMonth(nextMonth));
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
    else if (interval === 'annually') {
        const selectedYear = parseInt(dateValue);
        const nextYear = getNextYear();
        
        // Allow years that are next year or later
        return selectedYear >= nextYear;
    }
    
    return false;
}

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
        
        // Cleaner base tile layers
        const lightMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            noWrap: true,
            maxZoom: 19,
            subdomains: 'abcd'
        }).addTo(map);
        
        const terrainMap = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.png', {
            attribution: 'Map tiles by <a href="https://stamen.com">Stamen Design</a>',
            noWrap: true
        });
        
        // Layer control
        const baseLayers = {
            "Light Map": lightMap,
            "Terrain": terrainMap
        };
        
        L.control.layers(baseLayers).addTo(map);
        
        // Initialize layers
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
        
        predictionLayer = L.markerClusterGroup({
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
        });
        
        const legend = L.control({position: 'bottomright'});
        legend.onAdd = function() {
            const div = L.DomUtil.create('div', 'legend');
            div.innerHTML = `
                <div class="d-flex align-items-center mb-2">
                    <i class="legend-icon" style="background: #1a9850; width: 20px; height: 20px;"></i>
                    <span class="ms-2">Actual Outbreak</span>
                </div>
                <div class="mt-3"><small>Circle Size = Case Count</small></div>
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
                populateCountryFilter();
                updateMapTimelineChart(); // Initialize the timeline chart
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
        
        allData.actual.forEach(item => {
            if (item.lat && item.lon && shouldDisplay(item, 'actual')) {
                const cases = parseInt(item.cases) || 0;
                const radius = calculateRadius(cases);
                
                const circle = L.circleMarker([item.lat, item.lon], {
                    radius: radius,
                    fillColor: "#1a9850",
                    color: "white",
                    weight: 3,
                    opacity: 0.9,
                    fillOpacity: 0.85,
                    className: 'custom-circle-marker',
                    gradient: true
                }).bindPopup(createPopupContent(item, 'actual'));
                
                // Add pulse animation for active outbreaks
                if (item.status === 'active') {
                    circle.setStyle({
                        className: 'custom-circle-marker pulse-marker',
                        fillOpacity: 0.9
                    });
                }
                
                // Always show case number (permanent tooltip)
                circle.bindTooltip(`${cases}`, {
                    permanent: true,
                    direction: 'center',
                    className: 'circle-label',
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
        
        if (map && actualCount > 0) {
            setTimeout(() => {
                map.invalidateSize(true);
                if (actualLayer.getBounds().isValid()) {
                    map.fitBounds(actualLayer.getBounds(), {
                        padding: [50, 50],
                        maxZoom: 12
                    });
                }
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
                        label: 'Outbreaks Over Time',
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
                                text: 'Number of Outbreaks'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Time (Months)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: 'Outbreak Trends Over Time'
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
    if (type === 'actual' && !$('#actualToggle').prop('checked')) return false;
    if (type === 'prediction' && !$('#predictionToggle').prop('checked')) return false;
    
    const filterValue = $('#countryFilter').val().trim();
    if (filterValue && filterValue !== 'all' && item.country !== filterValue) return false;
    
    return true;
}

function createPopupContent(item, type) {
    return `
        <div class="map-popup">
            <h5>${item.location}</h5>
            <div class="mb-1"><strong>Country:</strong> ${item.country}</div>
            <div class="mb-1"><strong>Type:</strong> ${type === 'actual' ? 'Actual' : 'Predicted'}</div>
            <div class="mb-1"><strong>Start:</strong> ${item.start_date || 'N/A'}</div>
            <div class="mb-1"><strong>End:</strong> ${item.end_date || 'N/A'}</div>
            <div class="mb-1"><strong>Cases:</strong> ${item.cases || '0'}</div>
            <div><strong>Deaths:</strong> ${item.deaths || '0'}</div>
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
        
        // Cases vs Deaths Chart (First)
        const casesDeathsCtx = document.getElementById('casesDeathsChart');
        if (casesDeathsCtx) {
            casesDeathsChart = new Chart(casesDeathsCtx, {
                type: 'pie',
                data: {
                    labels: ['Cases', 'Deaths'],
                    datasets: [{
                        data: [casesDeathsData.cases, casesDeathsData.deaths],
                        backgroundColor: ['rgba(75, 192, 192, 0.5)', 'rgba(255, 99, 132, 0.5)'],
                        borderColor: ['rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)'],
                        borderWidth: 1
                    }]
                },
                options: { 
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
        
        // Country Chart (Second)
        const countryCtx = document.getElementById('countryChart');
        if (countryCtx) {
            countryChart = new Chart(countryCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(countryCounts),
                    datasets: [{
                        label: 'Outbreaks by Country',
                        data: Object.values(countryCounts),
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        // Timeline Chart (Third)
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
                        pointRadius: 4
                    }]
                },
                options: { 
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
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
    $('#actualToggle').change(function() {
        if (this.checked) {
            actualLayer.addTo(map);
        } else {
            map.removeLayer(actualLayer);
        }
        initTable();
        updateStatistics();
        initCharts();
        updateMapTimelineChart(); // Update timeline chart on filter change
    });
    
    $('#predictionToggle').change(function() {
        if (this.checked) {
            alert('Prediction data is coming soon!');
            $(this).prop('checked', false);
        }
    });
    
    $('#countryFilter').on('input', function() {
        updateMap();
        initTable();
        updateStatistics();
        initCharts();
        updateMapTimelineChart(); // Update timeline chart on filter change
    });
    
    $('#resetFilters').click(function() {
        $('#actualToggle').prop('checked', true);
        $('#predictionToggle').prop('checked', false);
        $('#countryFilter').val('');
        updateMap();
        initTable();
        updateStatistics();
        initCharts();
        updateMapTimelineChart(); // Update timeline chart on reset
    });
    
    $('button[data-bs-toggle="tab"]').on('shown.bs.tab', function(e) {
        if (e.target.id === 'charts-tab') {
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
                    mapTimelineChart.resize(); // Resize timeline chart when map tab is shown
                }
            }, 300);
        }
        else if (e.target.id === 'timeline-tab') {
            setTimeout(() => {
                if (timelineMap) {
                    timelineMap.invalidateSize(true);
                }
            }, 300);
        }
    });
    
    $('#predictionInterval').change(setupDateInput);
    
    $('#predictButton').click(function() {
        const interval = $('#predictionInterval').val();
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
        
        $('#predictionSpinner').show();
        $('#predictionText').text('Predicting...');
        
        $.ajax({
            url: '/api/predict',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ 
                date: dateValue,
                interval: interval
            }),
            success: function(response) {
                if (response.status === 'success') {
                    let displayText = `For ${interval} `;
                    if (interval === 'weekly') {
                        displayText += `starting <strong>${response.date}</strong>:<br>`;
                    } else if (interval === 'monthly') {
                        displayText += `of <strong>${response.date.substring(0,7)}</strong>:<br>`;
                    } else if (interval === 'annually') {
                        displayText += `in <strong>${response.date.substring(0,4)}</strong>:<br>`;
                    }
                    displayText += `<span style="font-size: 2rem;">${response.predicted_outbreaks}</span> predicted outbreaks`;
                    
                    $('#predictionText').html(displayText);
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
}