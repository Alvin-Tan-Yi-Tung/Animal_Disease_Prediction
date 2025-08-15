// Global variables
let map;
let actualLayer;
let predictionLayer;
let table;
let countryChart;
let casesDeathsChart;
let timelineChart;
let allData = {
    actual: [],
    prediction: []
};
let countryFilter = 'all';

// Initialize the application
$(document).ready(function() {
    initMap();
    fetchData();
    setupEventListeners();
    
    // Handle window resize to update map
    $(window).on('resize', function() {
        if (map) {
            setTimeout(() => map.invalidateSize(), 300);
        }
    });
});

function initMap() {
    try {
        // Create map with worldCopyJump disabled to prevent repetition
        map = L.map('map', {
            preferCanvas: true,
            fullscreenControl: true,
            worldCopyJump: false // Prevents map from repeating
        }).setView([4.5, 114], 6);
        
        // Add tile layer with noWrap enabled to prevent tile repetition
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            noWrap: true // Prevents tile repetition
        }).addTo(map);
        
        // Create marker cluster groups
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
        }).addTo(map); // Add actual layer by default
        
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
        }); // Prediction layer not added by default
        
        // Add fullscreen control
        map.addControl(new L.Control.Fullscreen({
            position: 'topright',
            title: 'View Fullscreen',
            titleCancel: 'Exit Fullscreen',
            forceSeparateButton: true
        }));
        
        // Add legend
        const legend = L.control({position: 'bottomright'});
        legend.onAdd = function() {
            const div = L.DomUtil.create('div', 'legend');
            div.innerHTML = `
                <h4>Legend</h4>
                <div><i class="legend-icon" style="background: #1a9850"></i> Actual Outbreak</div>
                <div class="mt-2"><strong>Circle Size:</strong></div>
                <div><i class="legend-icon" style="background: #1a9850; width: 30px; height: 30px;"></i> Small (1-10 cases)</div>
                <div><i class="legend-icon" style="background: #1a9850; width: 40px; height: 40px;"></i> Medium (11-50 cases)</div>
                <div><i class="legend-icon" style="background: #1a9850; width: 50px; height: 50px;"></i> Large (51-100 cases)</div>
                <div><i class="legend-icon" style="background: #1a9850; width: 60px; height: 60px;"></i> Extra Large (100+ cases)</div>
            `;
            return div;
        };
        legend.addTo(map);
        
        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 500);
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
        
        // Only process actual data
        allData.actual.forEach(item => {
            if (item.lat && item.lon && shouldDisplay(item, 'actual')) {
                const cases = parseInt(item.cases) || 0;
                const radius = calculateRadius(cases);
                
                const circle = L.circleMarker([item.lat, item.lon], {
                    radius: radius,
                    fillColor: "#1a9850",
                    color: "white",
                    weight: 4,
                    opacity: 1,
                    fillOpacity: 0.8,
                    className: 'custom-circle-marker'
                }).bindPopup(createPopupContent(item, 'actual'));
                
                circle.bindTooltip(`${cases}`, {
                    permanent: true,
                    direction: 'center',
                    className: 'circle-label',
                    offset: [0, 0]
                });
                
                actualLayer.addLayer(circle);
                actualCount++;
            }
        });
        
        if (map) {
            setTimeout(() => map.invalidateSize(), 300);
        }
    } catch (error) {
        console.error('Error updating map:', error);
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
        if (table) table.destroy();
        
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
        
        table = $('#outbreakTable').DataTable({
            data: tableData,
            columns: [
                { data: 'type' },
                { data: 'country' },
                { data: 'location' },
                { data: 'start_date' },
                { data: 'end_date' },
                { data: 'cases' },
                { data: 'deaths' }
            ],
            pageLength: 10,
            order: [[3, 'desc']],
            scrollY: '50vh',
            scrollCollapse: true
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
                    plugins: { legend: { display: false } }
                }
            });
        }
        
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
                    maintainAspectRatio: false
                }
            });
        }
        
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
                        tension: 0.1
                    }]
                },
                options: { 
                    responsive: true,
                    maintainAspectRatio: false
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
    });
    
    $('#predictionToggle').change(function() {
        if (this.checked) {
            // Prediction is coming soon - show message
            alert('Prediction data is coming soon!');
            $(this).prop('checked', false);
        }
    });
    
    $('#countryFilter').on('input', function() {
        updateMap();
        initTable();
        initCharts();
    });
    
    $('#resetFilters').click(function() {
        $('#actualToggle').prop('checked', true);
        $('#predictionToggle').prop('checked', false);
        $('#countryFilter').val('');
        updateMap();
        initTable();
        initCharts();
    });
    
    $('button[data-bs-toggle="tab"]').on('shown.bs.tab', function(e) {
        if (e.target.id === 'charts-tab') initCharts();
        else if (e.target.id === 'map-tab') {
            setTimeout(() => map.invalidateSize(), 300);
        }
    });
}