/**
 * AURA-DRAIN: Smart Drainage & Waste Management OS - Application Script
 * Orchestrates real-time physics simulation, canvas animation, telemetry charts, and UI interactivity.
 */

document.addEventListener("DOMContentLoaded", () => {
    
    // ================= STATE MANAGEMENT =================
    const state = {
        waterLevel: 24,       // %
        flowVelocity: 1.2,    // m/s
        wasteLoad: 12,        // %
        batteryLevel: 94,     // %
        solarOutput: 45,      // W
        weather: 'clear',     // clear | rainy | storm | custom
        
        // Sim Sliders
        rainRate: 0,          // mm/hr
        siltLevel: 12,        // %
        wasteGenRate: 1,      // 0: Off, 1: Low, 2: Med, 3: High
        solarRadiation: 540,  // W/m2
        
        // Control switches
        buzzerEnabled: true,
        autoGate: true,
        
        // Cumulative material weights (kg) for pie chart
        materials: {
            plastic: 45.2,
            metal: 28.4,
            paper: 19.1,
            organic: 62.5
        },
        
        // Active alarm flags to prevent duplicate logs
        alarms: {
            waterCritical: false,
            wasteFull: false,
            blockageDetected: false
        }
    };

    // Recycling Recommendations Data
    const recommendations = {
        plastic: {
            title: '<i class="fa-solid fa-bottle-water" style="color: var(--accent-cyan);"></i> PET & HDPE Plastics',
            text: "System detects PET water bottles, laundry detergent tins, and food containers. Highly Recyclable. Segregated into Left Chamber. Processing Recommendation: Shredded, washed, and pelletized into recycled plastic resins to produce composite pipes, construction tiles, and synthetic fibers."
        },
        metal: {
            title: '<i class="fa-solid fa-can-food" style="color: var(--accent-solar);"></i> Aluminum & Tin Cans',
            text: "System detects aluminum soda cans and metallic container parts. 100% Recyclable. Segregated into Left Chamber via electromagnetic sensors. Processing Recommendation: Baled, melted down, and re-cast into secondary aluminum sheets. Saves 95% of energy compared to raw mining."
        },
        paper: {
            title: '<i class="fa-solid fa-file-lines" style="color: #60a5fa;"></i> Cardboard & Mixed Paper',
            text: "System detects cardboard boxes, food wrappers, and newspaper pulp. Highly Recyclable. Segregated into Left Chamber. Processing Recommendation: Slurried with warm water, de-inked, and manufactured into low-grade recycled cardboard cartons, paper bags, or cellulose insulation."
        },
        organic: {
            title: '<i class="fa-solid fa-leaf" style="color: var(--accent-emerald);"></i> Silt, Leaves & Food Waste',
            text: "System filters leaf clusters, twigs, sand sediment, and food remnants. Non-Recyclable (Compostable). Directed to Right Chamber. Processing Recommendation: Discharged to localized anaerobic digestion composting units. Decomposed into rich bio-fertilizer and captured methane biogas for auxiliary local microgrid power."
        }
    };

    // Simulated Waste objects drifting in pipe
    let driftingWaste = [];
    const wasteTypes = [
        { label: 'PET Bottle', category: 'plastic', color: 'var(--accent-cyan)', isRecyclable: true },
        { label: 'Soda Can', category: 'metal', color: 'var(--accent-solar)', isRecyclable: true },
        { label: 'Cardboard Box', category: 'paper', color: '#60a5fa', isRecyclable: true },
        { label: 'Leaf Cluster', category: 'organic', color: 'var(--accent-emerald)', isRecyclable: false },
        { label: 'Plastic Bag', category: 'plastic', color: 'var(--accent-cyan)', isRecyclable: true },
        { label: 'Tree Twig', category: 'organic', color: 'var(--accent-emerald)', isRecyclable: false }
    ];

    // ================= INITIALIZE ELEMENTS =================
    const timeEl = document.getElementById("system-time");
    const weatherPresetSelect = document.getElementById("weather-preset");
    
    // Sliders
    const simRainInput = document.getElementById("sim-rain");
    const simSiltInput = document.getElementById("sim-silt");
    const simWasteGenInput = document.getElementById("sim-waste-gen");
    const simRadiationInput = document.getElementById("sim-radiation");
    
    // Slider labels
    const lblRain = document.getElementById("lbl-rain");
    const lblSilt = document.getElementById("lbl-silt");
    const lblWasteGen = document.getElementById("lbl-waste-gen");
    const lblRadiation = document.getElementById("lbl-radiation");
    
    // Swiches
    const ctrlBuzzer = document.getElementById("ctrl-buzzer");
    const ctrlAutoGate = document.getElementById("ctrl-autogate");
    
    // Telemetry Text
    const valWater = document.getElementById("val-water");
    const valFlow = document.getElementById("val-flow");
    const valWaste = document.getElementById("val-waste");
    const valSolar = document.getElementById("val-solar");
    
    // Gauge rings
    const gaugeWater = document.getElementById("gauge-water");
    const gaugeFlow = document.getElementById("gauge-flow");
    const gaugeWaste = document.getElementById("gauge-waste");
    const gaugeSolar = document.getElementById("gauge-solar");
    const gaugeTextWater = document.getElementById("gauge-text-water");
    const gaugeTextFlow = document.getElementById("gauge-text-flow");
    const gaugeTextWaste = document.getElementById("gauge-text-waste");
    const gaugeTextSolar = document.getElementById("gauge-text-solar");

    // Trends
    const trendWater = document.getElementById("trend-water");
    const trendFlow = document.getElementById("trend-flow");
    const trendWaste = document.getElementById("trend-waste");
    const trendSolar = document.getElementById("trend-solar");

    // AI vision panels
    const canvas = document.getElementById("camera-canvas");
    const ctx = canvas.getContext("2d");
    const lastWasteType = document.getElementById("last-waste-type");
    const lastWasteConf = document.getElementById("last-waste-conf");
    const lastWasteAction = document.getElementById("last-waste-action");
    
    // Servos Indicators
    const servoRecyclable = document.getElementById("servo-recyclable");
    const servoNeutral = document.getElementById("servo-neutral");
    const servoNonrecyclable = document.getElementById("servo-nonrecyclable");

    // Notifications and Logs
    const notificationFeed = document.getElementById("notification-feed");
    const toastContainer = document.getElementById("toast-container");
    const maintenanceTbody = document.getElementById("maintenance-tbody");
    const logTaskInput = document.getElementById("log-task");
    const logOperatorInput = document.getElementById("log-operator");
    const btnAddLog = document.getElementById("btn-add-log");

    // Setup Canvas dimensions
    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    
    // Handle window resize cleanly
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // ================= REAL-TIME SYSTEM CLOCK =================
    function updateClock() {
        const now = new Date();
        timeEl.textContent = now.toTimeString().split(' ')[0];
    }
    setInterval(updateClock, 1000);
    updateClock();

    // ================= PRESET CONFIGURATION SYSTEM =================
    const weatherPresets = {
        clear: { rain: 0, silt: 8, waste: 1, radiation: 780 },
        rainy: { rain: 35, silt: 28, waste: 2, radiation: 120 },
        storm: { rain: 110, silt: 72, waste: 3, radiation: 45 }
    };

    function applyWeatherPreset(presetName) {
        state.weather = presetName;
        if (presetName === 'custom') return;
        
        const config = weatherPresets[presetName];
        simRainInput.value = config.rain;
        simSiltInput.value = config.silt;
        simWasteGenInput.value = config.waste;
        simRadiationInput.value = config.radiation;
        
        // Force state update from UI controls
        syncStateFromSliders();
        addNotification(`Weather preset applied: ${presetName.toUpperCase()}`, 'info');
    }

    function syncStateFromSliders() {
        state.rainRate = parseFloat(simRainInput.value);
        state.siltLevel = parseInt(simSiltInput.value);
        state.wasteGenRate = parseInt(simWasteGenInput.value);
        state.solarRadiation = parseInt(simRadiationInput.value);
        
        // Update Labels
        lblRain.textContent = `${state.rainRate.toFixed(1)} mm/hr`;
        lblSilt.textContent = `${state.siltLevel}%`;
        lblRadiation.textContent = `${state.solarRadiation} W/m²`;
        
        const wasteGenText = ["Muted", "Normal", "Heavy", "Critical"];
        lblWasteGen.textContent = wasteGenText[state.wasteGenRate];
    }

    weatherPresetSelect.addEventListener("change", (e) => {
        applyWeatherPreset(e.target.value);
    });

    [simRainInput, simSiltInput, simWasteGenInput, simRadiationInput].forEach(slider => {
        slider.addEventListener("input", () => {
            weatherPresetSelect.value = "custom";
            state.weather = "custom";
            syncStateFromSliders();
        });
    });

    // Swiches input events
    ctrlBuzzer.addEventListener("change", (e) => {
        state.buzzerEnabled = e.target.checked;
        addNotification(`Hardware Buzzer alert system ${state.buzzerEnabled ? 'ARMED' : 'MUTED'}`, 'info');
    });

    ctrlAutoGate.addEventListener("change", (e) => {
        state.autoGate = e.target.checked;
        addNotification(`Automatic sorting gate control ${state.autoGate ? 'ENABLED' : 'DISABLED'}`, 'info');
    });

    // Initialize inputs state
    syncStateFromSliders();

    // ================= PROGRESS RING GAUGES CONTROLS =================
    // Stroke dash-array circumference = 175.9
    function setGaugePercent(gaugeBar, gaugeText, percent, colorVar) {
        percent = Math.max(0, Math.min(100, percent));
        const circ = 175.9;
        const offset = circ - (percent / 100) * circ;
        gaugeBar.style.strokeDashoffset = offset;
        gaugeText.textContent = `${Math.round(percent)}%`;
        
        if (colorVar) {
            gaugeBar.style.stroke = `var(${colorVar})`;
        }
    }

    // ================= NOTIFICATION AND TOAST ALERTS DISPATCHER =================
    function addNotification(message, type = 'info') {
        const timeStr = new Date().toTimeString().split(' ')[0];
        
        const item = document.createElement("div");
        item.className = `notification-item ${type}`;
        
        let iconHtml = '<i class="fa-solid fa-info"></i>';
        if (type === 'critical') iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>';
        if (type === 'warning') iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>';
        if (type === 'success') iconHtml = '<i class="fa-solid fa-circle-check"></i>';
        
        item.innerHTML = `
            <div class="notification-icon-container">${iconHtml}</div>
            <div class="notification-details">
                <div class="notification-msg">${message}</div>
                <div class="notification-time">${timeStr}</div>
            </div>
        `;
        
        notificationFeed.prepend(item);
        
        // Remove overflowing notifications to keep performance fast
        while (notificationFeed.children.length > 25) {
            notificationFeed.lastChild.remove();
        }

        // Spawn a floating visual toast if it is warning or critical
        if (type === 'critical' || type === 'warning') {
            triggerToast(type === 'critical' ? 'CRITICAL SYSTEM ALERT' : 'SYSTEM WARNING', message, type);
        }
    }

    function triggerToast(title, desc, severity) {
        const toast = document.createElement("div");
        toast.className = `toast ${severity}`;
        
        let iconHtml = '<i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-rose); font-size: 16px;"></i>';
        if (severity === 'warning') {
            iconHtml = '<i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-amber); font-size: 16px;"></i>';
        }

        toast.innerHTML = `
            ${iconHtml}
            <div>
                <div class="toast-title">${title}</div>
                <div class="toast-desc">${desc}</div>
            </div>
            <button class="toast-close">&times;</button>
        `;

        toastContainer.appendChild(toast);
        
        // Auto remove toast
        const timer = setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, 5000);

        toast.querySelector(".toast-close").addEventListener("click", () => {
            clearTimeout(timer);
            toast.remove();
        });
    }

    // ================= INTEGRATED PHYSICS ENGINE SIMULATOR LOOP =================
    let physicsTicks = 0;
    
    function runPhysicsSimulation() {
        physicsTicks++;
        
        // --- Water Level Math ---
        // Rain Rate fuels water input
        const waterInflow = (state.rainRate * 0.45);
        // Drainage exit depends on current level and silt blockage
        const drainageCapacityMultiplier = Math.max(0.1, 1 - (state.siltLevel / 100) - (state.wasteLoad / 150));
        const waterOutflow = Math.min(state.waterLevel, 2.5 + (state.waterLevel * 0.08) * drainageCapacityMultiplier);
        
        // Delta calculation
        let targetWaterLevel = state.waterLevel + (waterInflow - waterOutflow);
        if (state.weather === 'clear') {
            targetWaterLevel = Math.max(5, targetWaterLevel); // baseline puddle
        }
        
        // Clamp levels
        state.waterLevel = Math.max(0, Math.min(100, targetWaterLevel));
        
        // --- Flow Velocity Math ---
        // Velocity scales with water height/pressure, but drops sharply if silt levels or waste load blocks capacity
        let idealVelocity = (state.waterLevel / 20) * (state.rainRate > 0 ? 1.4 : 0.8);
        if (state.waterLevel < 2) idealVelocity = 0.1;
        
        state.flowVelocity = idealVelocity * drainageCapacityMultiplier;
        // Dampen updates slightly
        state.flowVelocity = Math.max(0.1, state.flowVelocity);

        // --- Waste Load Math ---
        // Silt level builds waste. Simulating waste accumulation bins.
        // Waste fills up gradually if flow rate washes trash down the pipe
        if (state.wasteGenRate > 0 && state.flowVelocity > 0.3) {
            state.wasteLoad += (state.wasteGenRate * 0.08) * (state.flowVelocity * 0.5);
        }
        state.wasteLoad = Math.max(0, Math.min(100, state.wasteLoad));

        // --- Solar Panel Output & Battery Math ---
        // Battery level charges under radiation, drains constantly to power NodeMCU/Servos
        const systemConsumption = 4.2 + (state.flowVelocity > 1.5 ? 2.5 : 0) + (state.wasteGenRate > 1 ? 1.5 : 0); // Watts consumed
        const generatedPower = (state.solarRadiation / 1000) * 50; // Max 50W solar panel
        state.solarOutput = generatedPower;

        const batteryDelta = (generatedPower - systemConsumption) * 0.08;
        state.batteryLevel = Math.max(0, Math.min(100, state.batteryLevel + batteryDelta));

        // --- Alarm Checks ---
        // Critical Water Overflow Checks
        if (state.waterLevel > 80 && !state.alarms.waterCritical) {
            state.alarms.waterCritical = true;
            addNotification("CRITICAL OVERFLOW ALERT: Drainage capacity at 80% with extreme backup risk!", "critical");
            document.getElementById("metric-water").classList.add("pulseGlow");
        } else if (state.waterLevel <= 70 && state.alarms.waterCritical) {
            state.alarms.waterCritical = false;
            addNotification("Water levels retracted below risk levels. Status: Nominal.", "success");
            document.getElementById("metric-water").classList.remove("pulseGlow");
        }

        // Critical Blockage Silt checks
        if (state.wasteLoad > 85 && !state.alarms.wasteFull) {
            state.alarms.wasteFull = true;
            addNotification("MAINTENANCE EMERGENCY: Waste filtration bin reaches 85% capacity. Immediate clearing required!", "critical");
            document.getElementById("metric-waste").classList.add("pulseGlow");
        } else if (state.wasteLoad <= 50 && state.alarms.wasteFull) {
            state.alarms.wasteFull = false;
            addNotification("Waste collection bin cleared. System returned to default monitoring mode.", "success");
            document.getElementById("metric-waste").classList.remove("pulseGlow");
        }

        // Flow velocity blockages (velocity drops dangerously during high rainfall)
        if (state.rainRate > 50 && state.flowVelocity < 0.6 && !state.alarms.blockageDetected) {
            state.alarms.blockageDetected = true;
            addNotification("SENSORS WARNING: Flow Velocity drop detected despite Torrential Rain. Internal pipe blockage suspected!", "warning");
        } else if ((state.rainRate <= 50 || state.flowVelocity >= 1.0) && state.alarms.blockageDetected) {
            state.alarms.blockageDetected = false;
        }

        // ================= UPDATE UI INDICATORS =================
        valWater.textContent = state.waterLevel.toFixed(0);
        valFlow.textContent = state.flowVelocity.toFixed(1);
        valWaste.textContent = state.wasteLoad.toFixed(0);
        valSolar.textContent = state.batteryLevel.toFixed(0);

        // Circular Gauge graphics
        let waterColor = "--accent-cyan";
        if (state.waterLevel > 60) waterColor = "--accent-amber";
        if (state.waterLevel > 80) waterColor = "--accent-rose";
        setGaugePercent(gaugeWater, gaugeTextWater, state.waterLevel, waterColor);
        
        let flowPercent = (state.flowVelocity / 5) * 100; // scale 5 m/s as 100%
        setGaugePercent(gaugeFlow, gaugeTextFlow, flowPercent, "--accent-emerald");
        
        let wasteColor = "--accent-emerald";
        if (state.wasteLoad > 50) wasteColor = "--accent-amber";
        if (state.wasteLoad > 80) wasteColor = "--accent-rose";
        setGaugePercent(gaugeWaste, gaugeTextWaste, state.wasteLoad, wasteColor);
        
        setGaugePercent(gaugeSolar, gaugeTextSolar, state.batteryLevel, "--accent-solar");

        // Trends indicator UI mapping
        updateTrendUI(trendWater, state.rainRate > 0 ? 'up' : 'stable', state.rainRate > 0 ? 'Rising' : 'Nominal');
        updateTrendUI(trendFlow, state.flowVelocity > 2.0 ? 'up' : (state.flowVelocity < 0.5 ? 'down' : 'stable'), 
                       state.flowVelocity > 2.0 ? 'Torque' : (state.flowVelocity < 0.5 ? 'Silt Drop' : 'Nominal'));
        updateTrendUI(trendWaste, state.wasteLoad > 75 ? 'down' : 'stable', state.wasteLoad > 75 ? 'Full' : 'Optimal');
        updateTrendUI(trendSolar, state.solarOutput > systemConsumption ? 'up' : 'down', 
                       state.solarOutput > systemConsumption ? `+${state.solarOutput.toFixed(0)}W` : `-${systemConsumption.toFixed(0)}W`);
    }

    function updateTrendUI(element, trend, text) {
        element.className = `metric-trend trend-${trend === 'up' ? 'up' : (trend === 'down' ? 'down' : 'neutral')}`;
        let icon = '<i class="fa-solid fa-arrows-left-right"></i>';
        if (trend === 'up') icon = '<i class="fa-solid fa-arrow-trend-up"></i>';
        if (trend === 'down') icon = '<i class="fa-solid fa-arrow-trend-down"></i>';
        element.innerHTML = `${icon} ${text}`;
    }

    // Set simulator loops
    setInterval(runPhysicsSimulation, 1500);

    // ================= AI VISION AND CANVAS CANVAS ANIMATION =================
    // Waste particle constructor
    class WasteParticle {
        constructor() {
            this.x = 20; // Starts from pipe left
            this.y = 80 + Math.random() * 40; // centered in pipe cross section
            this.speed = 1 + Math.random() * 2;
            const blueprint = wasteTypes[Math.floor(Math.random() * wasteTypes.length)];
            this.label = blueprint.label;
            this.category = blueprint.category;
            this.color = blueprint.color;
            this.isRecyclable = blueprint.isRecyclable;
            this.radius = 12 + Math.random() * 6;
            
            this.status = 'drifting'; // drifting | scanning | sorting | sorted
            this.scanProgress = 0;
            this.confidence = 88 + Math.random() * 11;
            
            // Physics attributes
            this.targetX = 0;
            this.targetY = 0;
        }

        update() {
            // Flow velocity accelerates particle
            const flowSpeedFactor = Math.max(0.2, state.flowVelocity * 0.8);
            
            if (this.status === 'drifting') {
                this.x += this.speed * flowSpeedFactor;
                // Move towards center-right sensor gate at X = 320
                if (this.x >= 280) {
                    this.status = 'scanning';
                }
            } else if (this.status === 'scanning') {
                this.scanProgress += 4;
                if (this.scanProgress >= 100) {
                    this.status = 'sorting';
                    // Trigger physical gate motion and record segregation telemetry
                    activateGate(this.isRecyclable, this.label, this.category, this.confidence);
                }
            } else if (this.status === 'sorting') {
                // If recyclable, head left-down, else head right-down
                this.targetX = this.isRecyclable ? 220 : 440;
                this.targetY = 240;
                
                this.x += (this.targetX - this.x) * 0.1;
                this.y += (this.targetY - this.y) * 0.1;
                
                if (this.y >= 210) {
                    this.status = 'sorted';
                    // Add weight to cumulative metrics
                    const weightDelta = 0.5 + Math.random() * 1.5;
                    state.materials[this.category] += weightDelta;
                    // Update pie chart
                    wastePieChart.data.datasets[0].data = [
                        state.materials.plastic,
                        state.materials.metal,
                        state.materials.paper,
                        state.materials.organic
                    ];
                    wastePieChart.update();
                }
            }
        }

        draw(ctx) {
            ctx.save();
            
            // Glowing border
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            ctx.fillStyle = this.color;
            ctx.strokeStyle = this.color;
            
            // Draw circle representing trash
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // Text tag for objects drifting or scanning
            if (this.status === 'scanning') {
                ctx.shadowBlur = 15;
                ctx.strokeStyle = 'var(--accent-cyan)';
                ctx.lineWidth = 2;
                
                // Draw digital scanning frame
                ctx.strokeRect(this.x - this.radius - 6, this.y - this.radius - 6, this.radius * 2 + 12, this.radius * 2 + 12);
                
                // AI label text overlay
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 9px "JetBrains Mono"';
                ctx.fillText(`AI: ${this.label}`, this.x - this.radius - 4, this.y - this.radius - 12);
                ctx.fillStyle = 'var(--accent-cyan)';
                ctx.fillText(`CONF: ${this.confidence.toFixed(0)}%`, this.x - this.radius - 4, this.y - this.radius - 2);
            }
            
            ctx.restore();
        }
    }

    // Auto trigger waste items based on generation rate slider
    let spawnTicks = 0;
    function runSpawnLogic() {
        if (state.wasteGenRate === 0) return;
        
        spawnTicks++;
        const spawnInterval = [99999, 120, 60, 25][state.wasteGenRate];
        
        if (spawnTicks >= spawnInterval) {
            spawnTicks = 0;
            driftingWaste.push(new WasteParticle());
        }
    }

    // Trigger physical servo motor gate action in dashboard
    function activateGate(isRecyclable, label, category, confidence) {
        // Toggle Active visual class for active gate indicator
        servoNeutral.classList.remove("active");
        
        if (isRecyclable) {
            servoRecyclable.classList.add("active");
            servoNonrecyclable.classList.remove("active");
            
            lastWasteType.innerHTML = `${label} <span style="color: var(--accent-cyan)">(Recyclable)</span>`;
            lastWasteAction.textContent = "Recycling Bin (Left)";
            lastWasteAction.style.color = "var(--accent-cyan)";
            
            // Update recommendation focus tab automatically
            focusRecommenderTab(category);
        } else {
            servoRecyclable.classList.remove("active");
            servoNonrecyclable.classList.add("active");
            
            lastWasteType.innerHTML = `${label} <span style="color: var(--accent-rose)">(Non-Recyclable)</span>`;
            lastWasteAction.textContent = "Organic Chute (Right)";
            lastWasteAction.style.color = "var(--accent-rose)";
            
            focusRecommenderTab('organic');
        }

        lastWasteConf.textContent = `${confidence.toFixed(1)}%`;
        
        // Dispatch alert log
        const alertType = isRecyclable ? 'success' : 'warning';
        addNotification(`AI CAMERA: Classified ${label} [Conf: ${confidence.toFixed(1)}%] - Routed via Servo Motor Sorting Gate`, alertType);

        // Turn gate off after 2.5 seconds
        setTimeout(() => {
            if (state.autoGate) {
                servoRecyclable.classList.remove("active");
                servoNonrecyclable.classList.remove("active");
                servoNeutral.classList.add("active");
            }
        }, 2500);
    }

    // Set initial active gate
    servoNeutral.classList.add("active");

    // Camera Canvas Painting Frame loop
    function renderCameraLoop() {
        // Clear canvas
        ctx.fillStyle = '#060812';
        ctx.fillRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
        
        const cw = canvas.width / window.devicePixelRatio;
        const ch = canvas.height / window.devicePixelRatio;
        
        // --- DRAW SIMULATED PIPE CHANNEL GEOMETRY ---
        // Bottom sediment layout
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(0, 70, cw, 100);
        
        // Pipe borders
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 70);
        ctx.lineTo(340, 70);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 170);
        ctx.lineTo(260, 170);
        ctx.moveTo(420, 170);
        ctx.lineTo(cw, 170);
        ctx.stroke();

        // Drainage water line overlay inside the pipe channel
        const waterHeightPixels = (state.waterLevel / 100) * 100;
        ctx.fillStyle = 'rgba(0, 242, 254, 0.12)';
        ctx.fillRect(0, 170 - waterHeightPixels, 340, waterHeightPixels);

        // Water currents details lines
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.2)';
        ctx.lineWidth = 1;
        const currentSpeed = (Date.now() / 40) * (state.flowVelocity + 0.1);
        for (let i = 0; i < 4; i++) {
            const lineX = (currentSpeed + i * 100) % 340;
            ctx.beginPath();
            ctx.moveTo(lineX, 110 + i * 15);
            ctx.lineTo(lineX + 40, 110 + i * 15);
            ctx.stroke();
        }

        // Draw sorting gates selectors
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(340, 60, 80, 120);

        // Laser scan boundary line for AI Cam
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'var(--accent-cyan)';
        ctx.beginPath();
        ctx.moveTo(280, 70);
        ctx.lineTo(280, 170);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw bins graphic text
        ctx.fillStyle = 'var(--text-muted)';
        ctx.font = '700 9px "Outfit"';
        ctx.fillText("RECYCLABLE BIN", 160, 230);
        ctx.fillText("ORGANIC DISPOSAL", 390, 230);

        // Update and draw particles
        runSpawnLogic();
        
        driftingWaste = driftingWaste.filter(p => p.status !== 'sorted');
        driftingWaste.forEach(particle => {
            particle.update();
            particle.draw(ctx);
        });

        // Loop animation frame
        requestAnimationFrame(renderCameraLoop);
    }

    // Launch camera loop
    driftingWaste.push(new WasteParticle());
    driftingWaste.push(new WasteParticle());
    setTimeout(() => requestAnimationFrame(renderCameraLoop), 100);

    // ================= DYNAMIC ANALYTICS CHART.JS INTEGRATION =================
    // Chart 1: Water level and flow rates line graphs
    const chartWaterCtx = document.getElementById("chart-water-level").getContext("2d");
    
    // Seed initial historical records
    const historicalTimeLabels = [];
    const seedWater = [];
    const seedFlow = [];
    for (let i = 12; i > 0; i--) {
        const d = new Date(Date.now() - i * 10000);
        historicalTimeLabels.push(d.toTimeString().split(' ')[0]);
        seedWater.push(20 + Math.random() * 15);
        seedFlow.push(0.8 + Math.random() * 0.6);
    }

    const waterLineChart = new Chart(chartWaterCtx, {
        type: 'line',
        data: {
            labels: historicalTimeLabels,
            datasets: [
                {
                    label: 'Water Depth (%)',
                    data: seedWater,
                    borderColor: '#00f2fe',
                    backgroundColor: 'rgba(0, 242, 254, 0.05)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Flow velocity (m/s)',
                    data: seedFlow,
                    borderColor: '#10b981',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Outfit', size: 11, weight: '600' }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 9 } }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } },
                    min: 0,
                    max: 100
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } },
                    min: 0,
                    max: 6
                }
            }
        }
    });

    // Chart 2: Cumulative materials segregation pie-chart
    const chartWasteCtx = document.getElementById("chart-waste-pie").getContext("2d");
    const wastePieChart = new Chart(chartWasteCtx, {
        type: 'doughnut',
        data: {
            labels: ['Plastics', 'Metals', 'Paper', 'Organics'],
            datasets: [{
                data: [
                    state.materials.plastic,
                    state.materials.metal,
                    state.materials.paper,
                    state.materials.organic
                ],
                backgroundColor: [
                    '#00f2fe',  // Plastic
                    '#fbbf24',  // Metal
                    '#60a5fa',  // Paper
                    '#10b981'   // Organic
                ],
                borderColor: '#0d1124',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Outfit', size: 11, weight: '600' },
                        boxWidth: 12
                    }
                }
            },
            cutout: '60%'
        }
    });

    // Chart tick update loop (adds latest telemetry to rolling chart every 4.5 seconds)
    setInterval(() => {
        const timeStr = new Date().toTimeString().split(' ')[0];
        
        waterLineChart.data.labels.push(timeStr);
        waterLineChart.data.datasets[0].data.push(state.waterLevel);
        waterLineChart.data.datasets[1].data.push(state.flowVelocity);
        
        if (waterLineChart.data.labels.length > 15) {
            waterLineChart.data.labels.shift();
            waterLineChart.data.datasets[0].data.shift();
            waterLineChart.data.datasets[1].data.shift();
        }
        
        waterLineChart.update();
    }, 4500);

    // ================= SMART RECYCLING MODULE TABS CONTROLLERS =================
    const recommenderPills = document.querySelectorAll(".recommender-pill");
    const recommenderTitle = document.getElementById("recommender-title");
    const recommenderText = document.getElementById("recommender-text");

    function focusRecommenderTab(category) {
        recommenderPills.forEach(pill => {
            if (pill.getAttribute("data-type") === category) {
                pill.classList.add("active");
            } else {
                pill.classList.remove("active");
            }
        });
        
        const data = recommendations[category];
        if (data) {
            recommenderTitle.innerHTML = data.title;
            recommenderText.textContent = data.text;
        }
    }

    recommenderPills.forEach(pill => {
        pill.addEventListener("click", () => {
            const type = pill.getAttribute("data-type");
            focusRecommenderTab(type);
        });
    });

    // ================= MAINTENANCE LOG SYSTEM & LOCAL STORAGE =================
    const defaultLogs = [
        { time: "2026-06-02 11:20:14", task: "Cleared sediment blockage at Sector C storm intake filter", operator: "John Doe" },
        { time: "2026-06-02 09:45:00", task: "Re-calibrated ultrasonic distance sensor (HC-SR04) on NodeMCU Node-01", operator: "Sarah Connor" },
        { time: "2026-06-01 16:30:25", task: "Solar battery cells inspect - structural integrity nominal", operator: "Alex Mercer" }
    ];

    function saveLogsToStorage(logs) {
        localStorage.setItem("drainage_logs", JSON.stringify(logs));
    }

    function getLogsFromStorage() {
        const stored = localStorage.getItem("drainage_logs");
        if (stored) {
            return JSON.parse(stored);
        }
        return defaultLogs;
    }

    function renderLogsTable() {
        const logs = getLogsFromStorage();
        maintenanceTbody.innerHTML = "";
        logs.forEach(log => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td style="font-family: 'JetBrains Mono', monospace; color: var(--text-muted);">${log.time}</td>
                <td style="font-weight: 500;">${log.task}</td>
                <td style="color: var(--accent-cyan); font-weight: 600;">${log.operator}</td>
            `;
            maintenanceTbody.appendChild(row);
        });
    }

    btnAddLog.addEventListener("click", () => {
        const task = logTaskInput.value.trim();
        const operator = logOperatorInput.value.trim();
        
        if (!task || !operator) {
            alert("Please complete both task description and operator inputs.");
            return;
        }

        const date = new Date();
        const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
        
        const logs = getLogsFromStorage();
        logs.unshift({ time: timestamp, task: task, operator: operator });
        
        saveLogsToStorage(logs);
        renderLogsTable();
        
        logTaskInput.value = "";
        logOperatorInput.value = "";
        
        addNotification(`Sanitation entry added: "${task}" by ${operator}`, 'success');
    });

    // Initial render
    renderLogsTable();

    // Spawn greetings alert
    addNotification("AURA-DRAIN Operating System initiated. Connecting to ESP32 node...", 'info');
    setTimeout(() => {
        addNotification("Connected successfully to ESP32 Smart Node! Wi-Fi: RSSI -58dBm.", 'success');
    }, 1200);

});
