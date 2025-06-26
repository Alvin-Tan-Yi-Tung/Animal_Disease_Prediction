// Malaysian states coordinates
const stateCoords = {
    'Johor': [1.4854, 103.7618],
    'Kedah': [6.1184, 100.3685],
    'Kelantan': [6.1254, 102.2381],
    'Melaka': [2.1896, 102.2501],
    'Negeri Sembilan': [2.7258, 101.9421],
    'Pahang': [3.8126, 103.3256],
    'Perak': [4.5921, 101.0901],
    'Perlis': [6.4447, 100.2048],
    'Penang': [5.4164, 100.3327],
    'Sabah': [5.9804, 116.0735],
    'Sarawak': [1.5533, 110.3592],
    'Selangor': [3.0738, 101.5183],
    'Terengganu': [5.3117, 103.1194],
    'Kuala Lumpur': [3.1390, 101.6869]
};

// Disease data (dummy data for demonstration)
const diseaseData = [
    { id: 1, name: "Foot and Mouth Disease", animal: "Cattle, Goats", states: ["Perak", "Kelantan"], cases: 24, severity: "High", lastReported: "2023-06-20", status: "Active" },
    { id: 2, name: "Avian Influenza", animal: "Poultry", states: ["Selangor", "Johor"], cases: 18, severity: "Medium", lastReported: "2023-06-18", status: "Active" },
    { id: 3, name: "Swine Fever", animal: "Swine", states: ["Pahang"], cases: 12, severity: "Medium", lastReported: "2023-06-15", status: "Contained" },
    { id: 4, name: "Lumpy Skin Disease", animal: "Cattle", states: ["Perlis", "Kedah"], cases: 32, severity: "High", lastReported: "2023-06-22", status: "Active" },
    { id: 5, name: "Rabies", animal: "Dogs, Cats", states: ["Sarawak"], cases: 8, severity: "Medium", lastReported: "2023-06-12", status: "Monitoring" },
    { id: 6, name: "Brucellosis", animal: "Cattle, Goats", states: ["Terengganu"], cases: 5, severity: "Low", lastReported: "2023-06-10", status: "Contained" },
    { id: 7, name: "Newcastle Disease", animal: "Poultry", states: ["Negeri Sembilan"], cases: 15, severity: "Medium", lastReported: "2023-06-19", status: "Active" },
    { id: 8, name: "African Swine Fever", animal: "Swine", states: ["Sabah"], cases: 21, severity: "High", lastReported: "2023-06-21", status: "Active" }
];

// Initialize map
function initMap(mapId, zoomLevel) {
    const map = L.map(mapId).setView([4.2105, 108.9758], zoomLevel);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    return map;
}

// Add markers to the map
function addMarkers(map) {
    diseaseData.forEach(disease => {
        disease.states.forEach(state => {
            const coord = stateCoords[state];
            if (coord) {
                let color;
                if (disease.severity === "High") color = "#dc3545";
                else if (disease.severity === "Medium") color = "#f5c542";
                else color = "#2c5f2d";
                
                const marker = L.circleMarker(coord, {
                    radius: disease.cases / 2,
                    fillColor: color,
                    color: "#000",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }).addTo(map);
                
                marker.bindPopup(`
                    <strong>${disease.name}</strong><br>
                    <b>Location:</b> ${state}<br>
                    <b>Animal:</b> ${disease.animal}<br>
                    <b>Cases:</b> ${disease.cases}<br>
                    <b>Status:</b> ${disease.status}
                `);
            }
        });
    });
}

// Populate disease table
function populateDiseaseTable() {
    const tableBody = document.getElementById('diseaseTable');
    diseaseData.forEach(disease => {
        const row = document.createElement('tr');
        
        // Add highlight class to active diseases
        if (disease.status === "Active") {
            row.classList.add('highlight');
        }
        
        row.innerHTML = `
            <td>${disease.name}</td>
            <td>${disease.animal}</td>
            <td>${disease.states.join(', ')}</td>
            <td>${disease.cases}</td>
            <td><span class="badge ${disease.severity === 'High' ? 'bg-danger' : disease.severity === 'Medium' ? 'bg-warning' : 'bg-success'}">${disease.severity}</span></td>
            <td>${disease.lastReported}</td>
            <td><span class="badge ${disease.status === 'Active' ? 'bg-danger' : disease.status === 'Contained' ? 'bg-success' : 'bg-info'}">${disease.status}</span></td>
        `;
        tableBody.appendChild(row);
    });
}

// Populate disease list
function populateDiseaseList(limit = 4) {
    const diseaseList = document.getElementById('diseaseList');
    diseaseList.innerHTML = ''; // Clear existing content
    
    diseaseData.slice(0, limit).forEach(disease => {
        const severityClass = disease.severity === "High" ? "severity-high" : 
                            disease.severity === "Medium" ? "severity-medium" : "severity-low";
        
        const item = document.createElement('div');
        item.className = `disease-item ${severityClass}`;
        item.innerHTML = `
            <h5>${disease.name}</h5>
            <p class="mb-1"><i class="fas fa-map-marker-alt me-2"></i> ${disease.states.join(', ')}</p>
            <p class="mb-0"><i class="fas fa-${disease.animal.includes('Poultry') ? 'crow' : disease.animal.includes('Cattle') ? 'cow' : disease.animal.includes('Swine') ? 'piggy-bank' : 'paw'} me-2"></i> ${disease.animal}</p>
        `;
        diseaseList.appendChild(item);
    });
}

// Initialize stats counters
function initStats() {
    // Update counter animation
    let count = 0;
    const counterElement = document.getElementById('updateCount');
    const updateCounter = () => {
        if (count < 8) {
            count++;
            counterElement.textContent = count;
            setTimeout(updateCounter, 300);
        }
    };
    updateCounter();
    
    // Calculate total cases
    const totalCases = diseaseData.reduce((sum, disease) => sum + disease.cases, 0);
    document.getElementById('caseCount').textContent = totalCases;
    
    // Calculate unique affected states
    const allStates = new Set();
    diseaseData.forEach(disease => {
        disease.states.forEach(state => allStates.add(state));
    });
    document.getElementById('stateCount').textContent = allStates.size;
}

// Simulate data updates
function setupDataUpdates() {
    setInterval(() => {
        // Add blinking animation to update badge
        const badge = document.querySelector('.update-badge');
        if (badge) {
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            document.getElementById('lastUpdated').textContent = timeString;
            badge.style.animation = 'none';
            setTimeout(() => {
                badge.style.animation = 'blink 1s 3';
            }, 10);
        }
        
        // Update counter
        if (document.getElementById('updateCount')) {
            const count = 8 + Math.floor(Math.random() * 4);
            document.getElementById('updateCount').textContent = count;
        }
        
        // Update map notification
        if (document.getElementById('mapUpdateCount')) {
            const mapUpdateCount = Math.floor(Math.random() * 3) + 1;
            document.getElementById('mapUpdateCount').textContent = mapUpdateCount;
        }
        
    }, 30000);
}

// Export to Excel functionality
function setupExcelExport() {
    document.getElementById('exportExcel').addEventListener('click', () => {
        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(diseaseData.map(d => ({
            "Disease": d.name,
            "Animal Type": d.animal,
            "Affected States": d.states.join(', '),
            "Cases": d.cases,
            "Severity": d.severity,
            "Last Reported": d.lastReported,
            "Status": d.status
        })));
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Disease Data");
        
        // Export file
        XLSX.writeFile(wb, "malaysia_animal_diseases.xlsx");
        
        // Show feedback
        const btn = document.getElementById('exportExcel');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check me-1"></i> Data Exported!';
        btn.classList.add('btn-success');
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('btn-success');
        }, 3000);
    });
}

// Setup notification panel
function setupNotifications() {
    const notificationPanel = document.getElementById('notificationPanel');
    notificationPanel.style.display = 'none';
    
    document.getElementById('notificationBtn').addEventListener('click', (e) => {
        e.preventDefault();
        if (notificationPanel.style.display === 'none') {
            notificationPanel.style.display = 'block';
            document.getElementById('notificationCount').textContent = '0';
        } else {
            notificationPanel.style.display = 'none';
        }
    });
}

// Setup refresh buttons
function setupRefreshButtons() {
    // Refresh map button
    if (document.getElementById('refreshMap')) {
        document.getElementById('refreshMap').addEventListener('click', () => {
            const btn = document.getElementById('refreshMap');
            btn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Refreshing...';
            setTimeout(() => {
                btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Data';
                document.getElementById('mapUpdateCount').textContent = '0';
                
                // Show notification
                const notificationPanel = document.getElementById('notificationPanel');
                const newNotification = document.createElement('div');
                newNotification.className = 'notification alert alert-light mb-3';
                newNotification.innerHTML = `
                    <h5><i class="fas fa-sync-alt text-primary me-2"></i> Map Refreshed</h5>
                    <p class="mb-0">Disease map data has been successfully refreshed</p>
                    <small>Just now</small>
                `;
                notificationPanel.insertBefore(newNotification, notificationPanel.firstChild);
                
                // Show notification panel
                notificationPanel.style.display = 'block';
                
                // Hide after 5 seconds
                setTimeout(() => {
                    notificationPanel.style.display = 'none';
                }, 5000);
            }, 1500);
        });
    }
    
    // Refresh data button
    if (document.getElementById('refreshData')) {
        document.getElementById('refreshData').addEventListener('click', () => {
            const btn = document.getElementById('refreshData');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-sync-alt fa-spin me-1"></i> Refreshing...';
            
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                
                // Show notification
                const notificationPanel = document.getElementById('notificationPanel');
                const newNotification = document.createElement('div');
                newNotification.className = 'notification alert alert-light mb-3';
                newNotification.innerHTML = `
                    <h5><i class="fas fa-database text-primary me-2"></i> Data Updated</h5>
                    <p class="mb-0">Disease registry has been refreshed with latest data</p>
                    <small>Just now</small>
                `;
                notificationPanel.insertBefore(newNotification, notificationPanel.firstChild);
                
                // Show notification panel
                notificationPanel.style.display = 'block';
                
                // Hide after 5 seconds
                setTimeout(() => {
                    notificationPanel.style.display = 'none';
                }, 5000);
            }, 1500);
        });
    }
    
    // Download button
    if (document.getElementById('downloadBtn')) {
        document.getElementById('downloadBtn').addEventListener('click', () => {
            const btn = document.getElementById('downloadBtn');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-download me-2"></i> Downloading...';
            
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                
                // Trigger export
                document.getElementById('exportExcel').click();
            }, 1000);
        });
    }
}

// Setup navigation active states
function setupNavigation() {
    const currentPage = window.location.pathname.split('/').pop();
    
    // Remove active class from all nav items
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Add active class based on current page
    if (currentPage === 'index.html' || currentPage === '') {
        document.querySelector('.nav-link[href="index.html"]').classList.add('active');
    } else if (currentPage === 'map.html') {
        document.querySelector('.nav-link[href="map.html"]').classList.add('active');
    } else if (currentPage === 'data.html') {
        document.querySelector('.nav-link[href="data.html"]').classList.add('active');
    } else if (currentPage === 'predict.html') {
        document.querySelector('.nav-link[href="predict.html"]').classList.add('active');
    }
}

// Initialize page-specific functionality
function initPage() {
    setupNavigation();
    setupNotifications();
    setupRefreshButtons();
    
    if (document.getElementById('diseaseTable')) {
        populateDiseaseTable();
        setupExcelExport();
    }
    
    if (document.getElementById('diseaseList')) {
        populateDiseaseList();
    }
    
    if (document.getElementById('dashboardMap')) {
        const map = initMap('dashboardMap', 6);
        addMarkers(map);
        initStats();
        setupDataUpdates();
    }
    
    if (document.getElementById('fullMap')) {
        const map = initMap('fullMap', 6);
        addMarkers(map);
        setupDataUpdates();
    }
    
    // Setup prediction page functionality
    if (document.getElementById('predictionForm')) {
        document.getElementById('predictionForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Simulate prediction process
            const predictionResult = document.getElementById('predictionResult');
            const diseaseName = document.getElementById('diseaseName');
            const riskBar = document.getElementById('riskBar');
            const riskLevel = document.getElementById('riskLevel');
            const recommendedActions = document.getElementById('recommendedActions');
            const preventiveMeasures = document.getElementById('preventiveMeasures');
            
            // Show loading state
            const submitButton = e.target.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Predicting...';
            submitButton.disabled = true;
            
            // Simulate API call delay
            setTimeout(() => {
                // For demo, we'll just show a fixed result
                diseaseName.textContent = 'Foot and Mouth Disease';
                riskBar.style.width = '85%';
                riskBar.textContent = '85% Risk';
                riskLevel.textContent = 'High Risk';
                
                // Reset and populate recommendations
                recommendedActions.innerHTML = `
                    <li>Isolate affected animals immediately</li>
                    <li>Contact veterinary services for diagnosis</li>
                    <li>Disinfect housing and equipment</li>
                    <li>Restrict movement of animals in and out of the farm</li>
                `;
                
                preventiveMeasures.textContent = 'Vaccinate healthy animals, maintain strict biosecurity measures, and monitor animals daily for symptoms.';
                
                // Show result
                predictionResult.style.display = 'block';
                
                // Scroll to result
                predictionResult.scrollIntoView({ behavior: 'smooth' });
                
                // Reset button
                submitButton.innerHTML = originalButtonText;
                submitButton.disabled = false;
            }, 2000);
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initPage);