const CAFFEINE_HALF_LIFE = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
const CAFFEINE_AMOUNTS = {
    coffee: 95,
    tea: 47,
    espresso: 63
};
const DEFAULT_WAKE_TIME = '07:00';
const DEFAULT_BED_TIME = '22:00';

let caffeineIntakes = [];
let caffeineChart = null;
let isDragging = false;
let draggedIcon = null;

function addCaffeine(beverageType) {
    const intake = {
        id: Date.now().toString(),
        type: beverageType,
        amount: CAFFEINE_AMOUNTS[beverageType],
        timestamp: Date.now()
    };
    caffeineIntakes.push(intake);
    updateDisplay();
    createDrinkIcon(intake);
}

function getBeverageIcon(type) {
    const icons = {
        coffee: '☕️',
        tea: '🫖',
        espresso: '⚡️'
    };
    return icons[type] || '☕️';
}

function formatTime(date) {
    return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function createDrinkIcon(intake) {
    const icon = document.createElement('div');
    icon.className = 'drink-icon';
    icon.dataset.id = intake.id;
    icon.innerHTML = getBeverageIcon(intake.type);
    
    // Add tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'icon-tooltip';
    tooltip.innerHTML = `
        <div>${intake.amount}mg</div>
        <div>${formatTime(new Date(intake.timestamp))}</div>
    `;
    icon.appendChild(tooltip);
    
    // Position icon on the chart
    updateIconPosition(icon, intake);
    
    // Add drag functionality
    icon.addEventListener('mousedown', startDragging);
    
    document.querySelector('.caffeine-graph').appendChild(icon);
}

function updateIconPosition(icon, intake) {
    const canvas = document.getElementById('caffeine-clock');
    const rect = canvas.getBoundingClientRect();
    const waketime = document.getElementById('waketime').value;
    const bedtime = document.getElementById('bedtime').value;
    const timeRange = calculateTimeRange(waketime, bedtime);
    
    const intakeDate = new Date(intake.timestamp);
    const intakeHour = intakeDate.getHours() + intakeDate.getMinutes() / 60;
    
    if (intakeHour >= timeRange.start && intakeHour <= timeRange.end) {
        const x = ((intakeHour - timeRange.start) / timeRange.duration) * (rect.width - 40) + 20;
        const y = rect.height - 30;
        
        icon.style.left = `${x}px`;
        icon.style.top = `${y}px`;
        icon.style.display = 'flex';
    } else {
        icon.style.display = 'none';
    }
}

function startDragging(e) {
    const icon = e.target.closest('.drink-icon');
    if (!icon) return;
    
    isDragging = true;
    draggedIcon = icon;
    icon.classList.add('dragging');
    
    const graph = document.querySelector('.caffeine-graph');
    const graphRect = graph.getBoundingClientRect();
    
    let lastUpdateTime = 0;
    const updateThrottle = 1000 / 30; // Limit to 30 fps
    
    function onDrag(e) {
        if (!isDragging) return;
        
        const now = performance.now();
        if (now - lastUpdateTime < updateThrottle) return;
        
        const x = e.clientX - graphRect.left;
        const boundedX = Math.max(20, Math.min(x, graphRect.width - 20));
        
        // Update icon position (x-axis only)
        icon.style.left = `${boundedX}px`;
        
        // Calculate new time based on x position
        const waketime = document.getElementById('waketime').value;
        const bedtime = document.getElementById('bedtime').value;
        const timeRange = calculateTimeRange(waketime, bedtime);
        
        const hourOffset = ((boundedX - 20) / (graphRect.width - 40)) * timeRange.duration;
        const newHour = timeRange.start + hourOffset;
        
        // Update intake timestamp
        const intake = caffeineIntakes.find(i => i.id === icon.dataset.id);
        if (intake) {
            const newDate = new Date(intake.timestamp);
            newDate.setHours(Math.floor(newHour));
            newDate.setMinutes(Math.round((newHour % 1) * 60));
            intake.timestamp = newDate.getTime();
            
            // Update tooltip
            const tooltip = icon.querySelector('.icon-tooltip');
            tooltip.innerHTML = `
                <div>${intake.amount}mg</div>
                <div>${formatTime(new Date(intake.timestamp))}</div>
            `;
            
            requestAnimationFrame(updateDisplay);
        }
        
        lastUpdateTime = now;
    }
    
    function stopDragging() {
        if (draggedIcon) {
            draggedIcon.classList.remove('dragging');
            updateDisplay(); // Final update with animation
        }
        isDragging = false;
        draggedIcon = null;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDragging);
    }
    
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDragging);
}

function calculateCurrentCaffeine() {
    const now = Date.now();
    return caffeineIntakes.reduce((total, intake) => {
        const timePassed = now - intake.timestamp;
        if (timePassed < 0) return total;
        
        if (timePassed < 45 * 60 * 1000) { // Rising phase
            return total + intake.amount * (1 - Math.exp(-timePassed / (15 * 60 * 1000)));
        } else {
            const peakToNow = (timePassed - 45 * 60 * 1000) / CAFFEINE_HALF_LIFE;
            return total + intake.amount * Math.pow(0.5, peakToNow);
        }
    }, 0);
}

function calculateCaffeineAtTime(targetTime) {
    return caffeineIntakes.reduce((total, intake) => {
        const timePassed = targetTime - intake.timestamp;
        if (timePassed < 0) return total;
        
        if (timePassed < 45 * 60 * 1000) { // Rising phase
            return total + intake.amount * (1 - Math.exp(-timePassed / (15 * 60 * 1000)));
        } else {
            const peakToNow = (timePassed - 45 * 60 * 1000) / CAFFEINE_HALF_LIFE;
            return total + intake.amount * Math.pow(0.5, peakToNow);
        }
    }, 0);
}

function calculateTimeRange(waketime, bedtime) {
    const [wakeHours, wakeMinutes] = waketime.split(':').map(Number);
    const [bedHours, bedMinutes] = bedtime.split(':').map(Number);
    
    let wakeTime = wakeHours + wakeMinutes / 60;
    let bedTime = bedHours + bedMinutes / 60;
    
    if (bedTime < wakeTime) {
        bedTime += 24;
    }
    
    return {
        start: wakeTime,
        end: bedTime,
        duration: bedTime - wakeTime
    };
}

function updateDisplay() {
    const waketime = document.getElementById('waketime').value;
    const bedtime = document.getElementById('bedtime').value;
    const timeRange = calculateTimeRange(waketime, bedtime);
    
    // Update icon positions
    document.querySelectorAll('.drink-icon').forEach(icon => {
        const intake = caffeineIntakes.find(i => i.id === icon.dataset.id);
        if (intake) {
            updateIconPosition(icon, intake);
        }
    });
    
    // Generate data points for the chart
    const dataPoints = [];
    const labels = [];
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    
    // Generate one data point every 15 minutes
    for (let hour = timeRange.start; hour <= timeRange.end; hour += 0.25) {
        const pointDate = new Date();
        pointDate.setHours(Math.floor(hour));
        pointDate.setMinutes((hour % 1) * 60);
        
        const caffeineLevel = calculateCaffeineAtTime(pointDate.getTime());
        dataPoints.push(caffeineLevel);
        
        // Format time label
        const formattedHour = Math.floor(hour % 24).toString().padStart(2, '0');
        const formattedMinute = Math.floor((hour % 1) * 60).toString().padStart(2, '0');
        labels.push(`${formattedHour}:${formattedMinute}`);
    }

    // Calculate current and bedtime caffeine levels for annotations
    const currentCaffeine = calculateCurrentCaffeine();
    const [bedHours, bedMinutes] = bedtime.split(':').map(Number);
    const bedDateTime = new Date();
    bedDateTime.setHours(bedHours, bedMinutes, 0, 0);
    if (bedDateTime < new Date()) {
        bedDateTime.setDate(bedDateTime.getDate() + 1);
    }
    const bedtimeCaffeine = calculateCaffeineAtTime(bedDateTime.getTime());

    // Calculate current time position (as a percentage between start and end)
    const currentPosition = (currentHour - timeRange.start) / timeRange.duration * (labels.length - 1);

    const chartConfig = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Caffeine Level',
                data: dataPoints,
                borderColor: '#007AFF',
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 15,
                hitRadius: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                intersect: true
            },
            plugins: {
                legend: {
                    display: false,
                    position: 'top'
                },
                tooltip: {
                    enabled: true,
                    mode: 'nearest',
                    intersect: true,
                    callbacks: {
                        label: function(context) {
                            return `${Math.round(context.raw)}mg of caffeine`;
                        }
                    }
                },
                annotation: currentHour >= timeRange.start && currentHour <= timeRange.end ? {
                    annotations: {
                        currentTime: {
                            type: 'line',
                            xMin: currentPosition,
                            xMax: currentPosition,
                            yMin: '0%',
                            yMax: '100%',
                            borderColor: 'rgba(239, 68, 68, 0.5)',
                            borderWidth: 2,
                            drawTime: 'beforeDatasetsDraw'
                        },
                        currentLevel: {
                            type: 'label',
                            xValue: currentPosition,
                            yValue: 200,
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            content: `${Math.round(currentCaffeine)}mg`,
                            color: '#ef4444',
                            font: {
                                size: 12,
                                weight: 'bold'
                            },
                            padding: 4,
                            yAdjust: 12,
                            position: 'start'
                        },
                        bedtimeLevel: {
                            type: 'label',
                            xValue: labels.length - 2,
                            yValue: bedtimeCaffeine,
                            backgroundColor: 'transparent',
                            content: `${Math.round(bedtimeCaffeine)}mg`,
                            color: '#666',
                            font: {
                                size: 11
                            },
                            yAdjust: -16
                        }
                    }
                } : {}
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        callback: function(val, index) {
                            const time = this.getLabelForValue(val);
                            const isCurrentTime = time === formatTime(new Date());
                            // Show full hours and current time
                            return (index % 4 === 0 || isCurrentTime) ? time : '';
                        },
                        color: (context) => {
                            const time = context.tick.label;
                            const isCurrentTime = time === formatTime(new Date());
                            return isCurrentTime ? '#ef4444' : '#666';
                        },
                        font: (context) => {
                            const time = context.tick.label;
                            const isCurrentTime = time === formatTime(new Date());
                            return {
                                weight: isCurrentTime ? 'bold' : 'normal'
                            };
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 200,
                    grid: {
                        display: false
                    },
                    ticks: {
                        stepSize: 50,
                        callback: function(value) {
                            return value + 'mg';
                        }
                    }
                }
            }
        }
    };

    // Create or update chart
    if (!caffeineChart) {
        caffeineChart = new Chart(
            document.getElementById('caffeine-clock'),
            chartConfig
        );
    } else {
        caffeineChart.data.labels = labels;
        caffeineChart.data.datasets[0].data = dataPoints;
        caffeineChart.options = chartConfig.options;
        caffeineChart.update();
    }
}

// Update display every minute
setInterval(updateDisplay, 60000);

// Initial update
window.addEventListener('load', updateDisplay);

// Add drink button functionality
document.addEventListener('DOMContentLoaded', () => {
    const addDrinkBtn = document.getElementById('addDrinkBtn');
    const drinkPopup = document.getElementById('drinkPopup');

    addDrinkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        drinkPopup.classList.toggle('show');
    });

    // Close popup when clicking outside
    document.addEventListener('click', (e) => {
        if (!drinkPopup.contains(e.target) && !addDrinkBtn.contains(e.target)) {
            drinkPopup.classList.remove('show');
        }
    });

    // Close popup after selecting a drink
    drinkPopup.querySelectorAll('.popup-drink-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            drinkPopup.classList.remove('show');
        });
    });
});
