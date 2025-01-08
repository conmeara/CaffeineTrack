const CAFFEINE_HALF_LIFE = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
const CAFFEINE_AMOUNTS = {
    coffee: 95,
    tea: 47,
    espresso: 63
};
const DEFAULT_WAKE_TIME = '07:00';
const DEFAULT_BED_TIME = '22:00';

let caffeineIntakes = [];
let isDragging = false;
let draggedMarker = null;
let dragOffset = { x: 0, y: 0 };

function addCaffeine(beverageType) {
    const intake = {
        id: Date.now().toString(),
        type: beverageType,
        amount: CAFFEINE_AMOUNTS[beverageType],
        timestamp: Date.now()
    };
    caffeineIntakes.push(intake);
    updateDisplay();
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

function calculateClearTime() {
    const currentLevel = calculateCurrentCaffeine();
    if (currentLevel < 1) return null;
    
    // Calculate time until caffeine level drops below 1mg
    const halfLivesNeeded = Math.log2(currentLevel);
    const timeNeeded = halfLivesNeeded * CAFFEINE_HALF_LIFE;
    return new Date(Date.now() + timeNeeded);
}

function formatTime(date) {
    if (!date) return '--:--';
    return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function updateDisplay() {
    const currentCaffeine = calculateCurrentCaffeine();
    const waketime = document.getElementById('waketime').value;
    const bedtime = document.getElementById('bedtime').value;
    
    document.getElementById('caffeine-amount').textContent = 
        `${Math.round(currentCaffeine)} mg`;
        
    // Calculate caffeine at bedtime
    const [bedHours, bedMinutes] = bedtime.split(':').map(Number);
    const bedDateTime = new Date();
    bedDateTime.setHours(bedHours, bedMinutes, 0, 0);
    
    if (bedDateTime < new Date()) {
        bedDateTime.setDate(bedDateTime.getDate() + 1);
    }
    
    const bedtimeCaffeine = calculateCaffeineAtTime(bedDateTime);
    
    document.getElementById('bedtime-amount').textContent = 
        `${Math.round(bedtimeCaffeine)} mg`;
    
    drawClock(currentCaffeine, waketime, bedtime);
}

function drawClock(caffeineLevel, waketime, bedtime) {
    const canvas = document.getElementById('caffeine-clock');
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const padding = 80;
    const graphHeight = canvas.height - (padding * 2);
    const graphWidth = canvas.width - (padding * 2);
    
    // Calculate time range
    const timeRange = calculateTimeRange(waketime, bedtime);
    
    // Calculate max caffeine for y-axis scaling
    const maxCaffeine = calculateMaxCaffeineLevel(timeRange);
    
    // Draw axes
    ctx.beginPath();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    
    // Y-axis
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    
    // X-axis
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    
    // Draw Y-axis labels
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = '12px Inter';
    const yAxisSteps = 4; // 5 labels (0, 50, 100, 150, 200)
    for (let i = 0; i <= yAxisSteps; i++) {
        const value = (maxCaffeine / yAxisSteps) * i;
        const y = padding + (1 - i/yAxisSteps) * graphHeight;
        ctx.fillText(`${Math.round(value)}mg`, padding - 10, y + 4);
    }
    
    // Draw total caffeine curve
    drawTotalCaffeineCurve(ctx, padding, graphWidth, graphHeight, timeRange, maxCaffeine);
    
    // Draw icons on x-axis
    caffeineIntakes.forEach(intake => {
        const intakeDate = new Date(intake.timestamp);
        const intakeHour = intakeDate.getHours() + intakeDate.getMinutes() / 60;
        
        if (intakeHour >= timeRange.start && intakeHour <= timeRange.end) {
            const x = padding + ((intakeHour - timeRange.start) / timeRange.duration) * graphWidth;
            const y = canvas.height - padding + 30;
            createOrUpdateDraggableIcon(intake, x, y);
        }
    });

    // Add X-axis time labels
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '12px Inter';
    
    const hourWidth = graphWidth / timeRange.duration;
    for (let hour = Math.ceil(timeRange.start); hour <= timeRange.end; hour++) {
        const x = padding + (hour - timeRange.start) * hourWidth;
        const displayHour = hour % 24;
        const timeString = `${displayHour.toString().padStart(2, '0')}:00`;
        
        // Skip drawing this label if it's within 30 minutes of current time
        const currentHour = new Date().getHours() + new Date().getMinutes() / 60;
        if (Math.abs(hour - currentHour) > 0.5) {
            ctx.fillStyle = '#64748b';
            ctx.fillText(timeString, x, canvas.height - padding + 20);
        }
    }

    drawCurrentTimeLine(ctx, padding, graphWidth, graphHeight, timeRange);
}

function createOrUpdateDraggableIcon(intake, x, y) {
    let icon = document.querySelector(`.caffeine-icon[data-id="${intake.id}"]`);
    if (!icon) {
        icon = document.createElement('div');
        icon.className = 'caffeine-icon';
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
        
        document.querySelector('.caffeine-graph').appendChild(icon);
        icon.addEventListener('mousedown', startDragging);
    }
    
    icon.style.left = `${x}px`;
    icon.style.top = `${y}px`;
}

function getBeverageIcon(type) {
    const icons = {
        coffee: '☕️',
        tea: '🫖',
        espresso: '⚡️'
    };
    return icons[type] || '☕️';
}

function calculateCaffeineLevelAtTime(intake, timeHours) {
    const intakeTime = new Date(intake.timestamp);
    const intakeHours = intakeTime.getHours() + (intakeTime.getMinutes() / 60);
    const timeSinceIntake = timeHours - intakeHours;
    
    if(timeSinceIntake < 0) return 0;
    
    if(timeSinceIntake < 0.75) { // Rising phase (45 minutes)
        // Exponential rise to peak
        return intake.amount * (1 - Math.exp(-timeSinceIntake / 0.25));
    } else {
        // Decay phase
        const peakToNow = timeSinceIntake - 0.75;
        return intake.amount * Math.pow(0.5, peakToNow / 5); // 5-hour half-life
    }
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

function timeToDecimal(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + (minutes / 60);
}

function getTimeAngle(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return ((hours + minutes / 60) * 15 - 90) * (Math.PI / 180);
}

// Add drag functionality
function initDragAndDrop() {
    const canvas = document.getElementById('caffeine-clock');
    const container = canvas.parentElement;

    container.addEventListener('mousedown', startDragging);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDragging);

    function startDragging(e) {
        const icon = e.target;
        icon.classList.add('dragging');
        
        const graph = document.querySelector('.caffeine-graph');
        const graphRect = graph.getBoundingClientRect();
        const padding = 60;
        
        function onDrag(e) {
            const x = e.clientX - graphRect.left;
            const boundedX = Math.max(padding, Math.min(x, graphRect.width - padding));
            
            // Update icon position (x-axis only)
            icon.style.left = `${boundedX}px`;
            
            // Calculate new time based on x position
            const timeRange = calculateTimeRange(
                document.getElementById('waketime').value,
                document.getElementById('bedtime').value
            );
            
            const graphWidth = graphRect.width - (padding * 2);
            const hourOffset = ((boundedX - padding) / graphWidth) * timeRange.duration;
            const newHour = timeRange.start + hourOffset;
            
            // Update intake timestamp
            const intake = caffeineIntakes.find(i => i.id === icon.dataset.id);
            if (intake) {
                const newDate = new Date();
                newDate.setHours(Math.floor(newHour));
                newDate.setMinutes((newHour % 1) * 60);
                intake.timestamp = newDate.getTime();
                updateDisplay();
            }
        }
        
        function stopDragging() {
            icon.classList.remove('dragging');
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', stopDragging);
        }
        
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDragging);
    }

    function drag(e) {
        if (!isDragging) return;

        const rect = canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const x = e.clientX - rect.left - dragOffset.x;
        const y = e.clientY - rect.top - dragOffset.y;
        
        // Calculate angle from center
        const angle = Math.atan2(y - centerY, x - centerX);
        const radius = Math.min(centerX, centerY) - 60;
        
        // Update marker position
        const newX = centerX + Math.cos(angle) * radius;
        const newY = centerY + Math.sin(angle) * radius;
        
        draggedMarker.style.left = `${newX}px`;
        draggedMarker.style.top = `${newY}px`;
        
        // Update intake time
        const hours = ((angle + Math.PI / 2) / Math.PI * 12 + 24) % 24;
        const minutes = Math.round((hours % 1) * 60);
        
        const intakeId = draggedMarker.dataset.intakeId;
        const intake = caffeineIntakes.find(i => i.id === intakeId);
        if (intake) {
            const newDate = new Date(intake.timestamp);
            newDate.setHours(Math.floor(hours), minutes);
            intake.timestamp = newDate.getTime();
            updateDisplay();
        }
    }

    function stopDragging() {
        if (draggedMarker) {
            draggedMarker.classList.remove('dragging');
        }
        isDragging = false;
        draggedMarker = null;
    }
}

function createDraggableMarker(intake) {
    const marker = document.createElement('div');
    marker.className = 'draggable-marker';
    marker.dataset.intakeId = intake.id;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'marker-tooltip';
    tooltip.textContent = `${intake.amount}mg`;
    
    marker.appendChild(tooltip);
    document.querySelector('.clock-container').appendChild(marker);
    
    // Position marker
    updateMarkerPosition(marker, intake);
}

function updateMarkerPosition(marker, intake) {
    const canvas = document.getElementById('caffeine-clock');
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const radius = Math.min(centerX, centerY) - 60;
    
    const angle = getTimeAngle(new Date(intake.timestamp));
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
}

// Initialize drag and drop
initDragAndDrop();

// Update more frequently for smoother clock movement
setInterval(updateDisplay, 1000); 

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

function drawTotalCaffeineCurve(ctx, padding, graphWidth, graphHeight, timeRange, maxCaffeine) {
    const canvas = document.getElementById('caffeine-clock');
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, padding, 0, canvas.height - padding);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.1)');   
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');  
    
    // Draw filled area
    ctx.beginPath();
    ctx.moveTo(padding, canvas.height - padding);
    
    let firstPoint = true;
    for(let x = 0; x <= graphWidth; x++) {
        const progress = x / graphWidth;
        const timeAtPoint = timeRange.start + (timeRange.duration * progress);
        const pointDate = new Date();
        pointDate.setHours(Math.floor(timeAtPoint));
        pointDate.setMinutes((timeAtPoint % 1) * 60);
        const totalLevel = calculateCaffeineAtTime(pointDate.getTime());
        const y = padding + graphHeight - (totalLevel / maxCaffeine * graphHeight);
        
        if(firstPoint) {
            ctx.moveTo(padding + x, y);
            firstPoint = false;
        } else {
            ctx.lineTo(padding + x, y);
        }
    }
    
    ctx.lineTo(padding + graphWidth, canvas.height - padding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw the line on top
    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    
    firstPoint = true;
    for(let x = 0; x <= graphWidth; x++) {
        const progress = x / graphWidth;
        const timeAtPoint = timeRange.start + (timeRange.duration * progress);
        const pointDate = new Date();
        pointDate.setHours(Math.floor(timeAtPoint));
        pointDate.setMinutes((timeAtPoint % 1) * 60);
        const totalLevel = calculateCaffeineAtTime(pointDate.getTime());
        const y = padding + graphHeight - (totalLevel / maxCaffeine * graphHeight);
        
        if(firstPoint) {
            ctx.moveTo(padding + x, y);
            firstPoint = false;
        } else {
            ctx.lineTo(padding + x, y);
        }
    }
    ctx.stroke();
}

function calculateMaxCaffeineLevel(timeRange) {
    let maxLevel = 0;
    const steps = 100; // Number of points to check
    
    for(let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const timeAtPoint = timeRange.start + (timeRange.duration * progress);
        
        const pointDate = new Date();
        pointDate.setHours(Math.floor(timeAtPoint));
        pointDate.setMinutes((timeAtPoint % 1) * 60);
        
        const level = calculateCaffeineAtTime(pointDate.getTime());
        maxLevel = Math.max(maxLevel, level);
    }
    
    // Set minimum to 200mg, round up to nearest 50 if higher
    return Math.max(200, Math.ceil(maxLevel / 50) * 50);
}

// Add this function to handle canvas resizing
function resizeCanvas() {
    const canvas = document.getElementById('caffeine-clock');
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth;
    
    // Set canvas width to container width minus padding
    canvas.width = containerWidth - 40; // 20px padding on each side
    canvas.height = 600; // Keep height fixed
    
    updateDisplay(); // Redraw everything
}

// Add event listener for window resize
window.addEventListener('resize', resizeCanvas);

// Call on initial load
window.addEventListener('load', resizeCanvas); 

function drawSmoothLine(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length - 2; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    
    // Curve through the last two points
    ctx.quadraticCurveTo(
        points[points.length - 2].x,
        points[points.length - 2].y,
        points[points.length - 1].x,
        points[points.length - 1].y
    );
} 

function drawCurrentTimeLine(ctx, padding, graphWidth, graphHeight, timeRange) {
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const canvas = document.getElementById('caffeine-clock');
    
    if (currentHour >= timeRange.start && currentHour <= timeRange.end) {
        const x = padding + ((currentHour - timeRange.start) / timeRange.duration) * graphWidth;
        
        // Save current context state
        ctx.save();
        
        // Draw time label in red
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'center';
        const timeString = now.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        // Draw label text
        ctx.fillText(timeString, x, canvas.height - padding + 20);
        
        // Draw small red dot above the time
        ctx.beginPath();
        ctx.arc(x, canvas.height - padding + 8, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        
        // Restore context state
        ctx.restore();
    }
}

// Initialize the display when the page loads
window.addEventListener('load', () => {
    resizeCanvas();
    updateDisplay();
});
