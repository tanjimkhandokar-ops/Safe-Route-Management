document.addEventListener("DOMContentLoaded", () => {
    // States
    let isAdminLoggedIn = false;
    let currentUser = null;
    let map = null;

    let currentRouteLine = null, startMarker = null, destMarker = null, liveMarker = null;
    let animationInterval = null;
    let activePathCoordinates = [];
    let currentActiveTripLog = null;

    // Load Data from LocalStorage
    let students = JSON.parse(localStorage.getItem("routeguard_users")) || [];
    let adminUsers = JSON.parse(localStorage.getItem("routeguard_admins")) || [
        { name: "System Admin", user: "admin", pass: "1234" }
    ];
    let systemLogs = JSON.parse(localStorage.getItem("routeguard_logs")) || [];
    let travelHistory = JSON.parse(localStorage.getItem("routeguard_travel_history")) || [];
    let safetyFeedbacks = JSON.parse(localStorage.getItem("routeguard_feedbacks")) || [];

    // Storage Save Helpers
    function saveStudentsToStorage() { localStorage.setItem("routeguard_users", JSON.stringify(students)); }
    function saveAdminsToStorage() { localStorage.setItem("routeguard_admins", JSON.stringify(adminUsers)); }
    function saveLogsToStorage() { localStorage.setItem("routeguard_logs", JSON.stringify(systemLogs)); }
    function saveTravelHistoryToStorage() { localStorage.setItem("routeguard_travel_history", JSON.stringify(travelHistory)); }
    function saveFeedbacksToStorage() { localStorage.setItem("routeguard_feedbacks", JSON.stringify(safetyFeedbacks)); }

    // Browser Notification Function
    function sendBrowserNotification(title, bodyText) {
        if (!("Notification" in window)) return;
        if (Notification.permission === "granted") {
            new Notification(title, { body: bodyText, icon: "https://cdn-icons-png.flaticon.com/512/1063/1063376.png" });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                    new Notification(title, { body: bodyText, icon: "https://cdn-icons-png.flaticon.com/512/1063/1063376.png" });
                }
            });
        }
    }
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }

    // System Logging Helper
    function addSystemLog(userName, phone, eventType, details) {
        const logEntry = {
            timestamp: new Date().toLocaleString(),
            userName: userName || "Unknown",
            phone: phone || "N/A",
            eventType: eventType,
            details: details
        };
        systemLogs.unshift(logEntry);
        saveLogsToStorage();
        renderSystemLogs();
    }

    // UI Elements
    const authLanding = document.getElementById("auth-landing");
    const mainDashboard = document.getElementById("main-dashboard");
    
    const roleUserBtn = document.getElementById("role-user-btn");
    const roleAdminBtn = document.getElementById("role-admin-btn");
    const userAuthBox = document.getElementById("user-auth-box");
    const adminAuthBox = document.getElementById("admin-auth-box");

    const tabUserLogin = document.getElementById("tab-user-login");
    const tabUserRegister = document.getElementById("tab-user-register");
    const userLoginForm = document.getElementById("user-login-form");
    const userRegisterForm = document.getElementById("user-register-form");

    const tabAdminLogin = document.getElementById("tab-admin-login");
    const tabAdminRegister = document.getElementById("tab-admin-register");
    const adminLoginForm = document.getElementById("admin-login-form");
    const adminRegisterForm = document.getElementById("admin-register-form");

    const profileModal = document.getElementById("profile-modal");
    const sosContactsModal = document.getElementById("sos-contacts-modal");
    const profileUpdateForm = document.getElementById("profile-update-form");

    const viewMyProfileBtn = document.getElementById("view-my-profile-btn");
    const userLogoutBtn = document.getElementById("user-logout-btn");
    const sosBtn = document.getElementById("sos-btn");

    const tableBody = document.getElementById("student-table-body");
    const travelHistoryTableBody = document.getElementById("travel-history-table-body");
    const logsTableBody = document.getElementById("logs-table-body");
    const feedbackTableBody = document.getElementById("feedback-table-body");
    
    const alertText = document.getElementById("alert-text");
    const modeIndicator = document.getElementById("mode-indicator");
    const directoryTitle = document.getElementById("directory-title");

    const tabMembersView = document.getElementById("tab-members-view");
    const tabTravelHistoryView = document.getElementById("tab-travel-history-view");
    const tabAlertsView = document.getElementById("tab-alerts-view");
    const tabReportsView = document.getElementById("tab-reports-view");

    const sectionMembers = document.getElementById("section-members");
    const sectionTravelHistory = document.getElementById("section-travel-history");
    const sectionAlerts = document.getElementById("section-alerts");
    const sectionReports = document.getElementById("section-reports");

    // Role Switch Logic
    roleUserBtn.addEventListener("click", () => {
        roleUserBtn.classList.add("active");
        roleAdminBtn.classList.remove("active");
        userAuthBox.classList.remove("hidden");
        adminAuthBox.classList.add("hidden");
    });

    roleAdminBtn.addEventListener("click", () => {
        roleAdminBtn.classList.add("active");
        roleUserBtn.classList.remove("active");
        adminAuthBox.classList.remove("hidden");
        userAuthBox.classList.add("hidden");
    });

    tabUserLogin.addEventListener("click", () => {
        tabUserLogin.classList.add("active");
        tabUserRegister.classList.remove("active");
        userLoginForm.classList.remove("hidden");
        userRegisterForm.classList.add("hidden");
    });
    tabUserRegister.addEventListener("click", () => {
        tabUserRegister.classList.add("active");
        tabUserLogin.classList.remove("active");
        userRegisterForm.classList.remove("hidden");
        userLoginForm.classList.add("hidden");
    });

    tabAdminLogin.addEventListener("click", () => {
        tabAdminLogin.classList.add("active");
        tabAdminRegister.classList.remove("active");
        adminLoginForm.classList.remove("hidden");
        adminRegisterForm.classList.add("hidden");
    });
    tabAdminRegister.addEventListener("click", () => {
        tabAdminRegister.classList.add("active");
        tabAdminLogin.classList.remove("active");
        adminRegisterForm.classList.remove("hidden");
        adminLoginForm.classList.add("hidden");
    });

    // MAP INITIALIZATION
    function initMap() {
        if (!map) {
            map = L.map('map').setView([23.8103, 90.4125], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);
        }
        setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    }

    // Dashboard Entry
    function enterDashboard(user, isSystemAdmin = false) {
        currentUser = user;
        isAdminLoggedIn = isSystemAdmin;
        authLanding.classList.add("hidden");
        mainDashboard.classList.remove("hidden");
        sosBtn.style.display = isSystemAdmin ? "none" : "inline-block";
        userLogoutBtn.style.display = "inline-block";

        updateActiveUserDisplay();
        toggleAdminElements(isSystemAdmin);
        initMap();
        renderStudents(students);
        renderTravelHistory();
        renderSystemLogs();
        renderReports();
    }

    function toggleAdminElements(show) {
        document.querySelectorAll(".admin-only-element").forEach(el => {
            if (show) el.classList.remove("hidden"); else el.classList.add("hidden");
        });
        if (show) {
            modeIndicator.innerText = "Mode: Admin Full Access";
            directoryTitle.innerHTML = `<i class="fa-solid fa-users-gear"></i> Admin Directory Control`;
        } else {
            modeIndicator.innerText = "Mode: Member View";
            directoryTitle.innerHTML = `<i class="fa-solid fa-users"></i> Registered Members Directory`;
            switchTab(sectionMembers, tabMembersView);
        }
    }

    function updateActiveUserDisplay() {
        if (currentUser) {
            document.getElementById("dash-user-name").innerText = currentUser.name || "N/A";
            document.getElementById("dash-user-phone").innerText = currentUser.phone || "N/A";
            document.getElementById("dash-user-email").innerText = currentUser.email || "N/A";
            document.getElementById("dash-user-occupation").innerText = currentUser.occupation || "N/A";
            document.getElementById("dash-user-blood").innerText = currentUser.blood || "N/A";
        }
    }

    // User Login
    userLoginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const cred = document.getElementById("login-credential").value.trim().toLowerCase();
        const found = students.find(s => (s.phone && s.phone.toLowerCase() === cred) || (s.email && s.email.toLowerCase() === cred));
        if (found) {
            enterDashboard(found, false);
            addSystemLog(found.name, found.phone, "User Login", "Logged into User Portal.");
        } else { alert("Account not found! Register first."); }
    });

    // User Register
    userRegisterForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const phone = document.getElementById("reg-phone").value.trim();
        const email = document.getElementById("reg-email").value.trim().toLowerCase();

        if (students.some(s => s.phone === phone || s.email === email)) {
            alert("Account with this Mobile or Email already exists!"); return;
        }

        const newUser = {
            name: document.getElementById("reg-name").value.trim(),
            phone: phone, email: email,
            occupation: document.getElementById("reg-occupation").value,
            blood: document.getElementById("reg-blood").value,
            emergency: document.getElementById("reg-emergency").value.trim(),
            nid: document.getElementById("reg-nid").value.trim(),
            address: document.getElementById("reg-address").value.trim(),
            start: 'Not Set', dest: 'Not Set', status: "Registered"
        };
        students.push(newUser);
        saveStudentsToStorage();
        addSystemLog(newUser.name, newUser.phone, "User Registration", "Registered new user profile.");
        alert("Registration Successful!");
        enterDashboard(newUser, false);
    });

    // Admin Login
    adminLoginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const u = document.getElementById("admin-user").value.trim();
        const p = document.getElementById("admin-pass").value.trim();

        const validAdmin = adminUsers.find(a => (a.user === u || a.email === u) && a.pass === p);
        if (validAdmin) {
            enterDashboard({ name: validAdmin.name, phone: "ADMIN", email: validAdmin.user, occupation: "System Admin", blood: "ALL" }, true);
            addSystemLog(validAdmin.name, "ADMIN", "Admin Login", "Admin authenticated successfully.");
            alert("Admin Login Successful!");
        } else { alert("Invalid Admin Credentials!"); }
    });

    // Admin Registration
    adminRegisterForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("admin-reg-name").value.trim();
        const user = document.getElementById("admin-reg-user").value.trim();
        const pass = document.getElementById("admin-reg-pass").value.trim();
        const key = document.getElementById("admin-secret-key").value.trim();

        if (key !== "admin123") {
            alert("Invalid Security Passcode Key! Cannot register admin."); return;
        }

        if (adminUsers.some(a => a.user === user)) {
            alert("Admin username already taken!"); return;
        }

        const newAdmin = { name, user, pass };
        adminUsers.push(newAdmin);
        saveAdminsToStorage();
        addSystemLog(name, "ADMIN", "Admin Register", "New Administrator registered.");
        alert("Admin Account Created! Logging into console...");
        enterDashboard({ name: name, phone: "ADMIN", email: user, occupation: "System Admin", blood: "ALL" }, true);
    });

    // Profile Modal Edit
    document.getElementById("view-my-profile-btn").addEventListener("click", () => {
        if (!currentUser) return;
        document.getElementById("prof-name").value = currentUser.name || "";
        document.getElementById("prof-phone").value = currentUser.phone || "";
        document.getElementById("prof-email").value = currentUser.email || "";
        document.getElementById("prof-occupation").value = currentUser.occupation || "Student";
        document.getElementById("prof-blood").value = currentUser.blood || "A+";
        document.getElementById("prof-emergency").value = currentUser.emergency || "";
        document.getElementById("prof-nid").value = currentUser.nid || "";
        document.getElementById("prof-address").value = currentUser.address || "";
        profileModal.style.display = "flex";
    });

    document.getElementById("close-profile-btn").addEventListener("click", () => profileModal.style.display = "none");

    profileUpdateForm.addEventListener("submit", (e) => {
        e.preventDefault();
        currentUser.name = document.getElementById("prof-name").value.trim();
        currentUser.phone = document.getElementById("prof-phone").value.trim();
        currentUser.email = document.getElementById("prof-email").value.trim();
        currentUser.occupation = document.getElementById("prof-occupation").value;
        currentUser.blood = document.getElementById("prof-blood").value;
        currentUser.emergency = document.getElementById("prof-emergency").value.trim();
        currentUser.nid = document.getElementById("prof-nid").value.trim();
        currentUser.address = document.getElementById("prof-address").value.trim();

        saveStudentsToStorage();
        updateActiveUserDisplay();
        renderStudents(students);
        profileModal.style.display = "none";
        alert("Profile Updated!");
    });

    // Logout
    userLogoutBtn.addEventListener("click", () => {
        if (currentUser) addSystemLog(currentUser.name, currentUser.phone, "Logout", "Session ended.");
        currentUser = null; isAdminLoggedIn = false;
        mainDashboard.classList.add("hidden");
        authLanding.classList.remove("hidden");
        sosBtn.style.display = "none";
        userLogoutBtn.style.display = "none";
        toggleAdminElements(false);
    });

    // Dashboard View Switchers
    function switchTab(targetSection, targetBtn) {
        [sectionMembers, sectionTravelHistory, sectionAlerts, sectionReports].forEach(s => s.classList.add("hidden"));
        [tabMembersView, tabTravelHistoryView, tabAlertsView, tabReportsView].forEach(b => b.classList.remove("active"));
        targetSection.classList.remove("hidden");
        targetBtn.classList.add("active");
        if (map) setTimeout(() => map.invalidateSize(), 200);
    }

    tabMembersView.addEventListener("click", () => switchTab(sectionMembers, tabMembersView));
    tabTravelHistoryView.addEventListener("click", () => { switchTab(sectionTravelHistory, tabTravelHistoryView); renderTravelHistory(); });
    tabAlertsView.addEventListener("click", () => { switchTab(sectionAlerts, tabAlertsView); renderSystemLogs(); });
    tabReportsView.addEventListener("click", () => { switchTab(sectionReports, tabReportsView); renderReports(); });

    // SOS Action
    sosBtn.addEventListener("click", () => {
        if (currentUser && currentUser.emergency) {
            document.getElementById("sos-guardian-num").innerText = currentUser.emergency;
            document.getElementById("sos-guardian-link").href = `tel:${currentUser.emergency}`;
            document.getElementById("sos-guardian-name").innerText = `Emergency Contact (${currentUser.name})`;
        }
        sosContactsModal.style.display = "flex";
        document.getElementById("alert-box").className = "alert-box alert-danger";
        alertText.innerText = `EMERGENCY SOS ACTIVE!`;

        addSystemLog(currentUser ? currentUser.name : "User", currentUser ? currentUser.phone : "N/A", "EMERGENCY SOS", "SOS triggered broadcast!");
        sendBrowserNotification("EMERGENCY SOS ALERT", `${currentUser ? currentUser.name : 'Member'} triggered emergency alert!`);
    });

    document.getElementById("close-sos-modal").addEventListener("click", () => sosContactsModal.style.display = "none");

    // FIXED GEOCODING FUNCTION WITH FALLBACK COORDINATES (Prevents Alert Block)
    async function geocodeLocation(query) {
        if (!query) return [23.8103, 90.4125];
        
        try {
            let cleanQuery = query.trim();
            let searchQuery = cleanQuery.toLowerCase().includes("dhaka") || cleanQuery.toLowerCase().includes("bangladesh") 
                ? cleanQuery 
                : `${cleanQuery}, Dhaka, Bangladesh`;
                
            let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`;
            
            let res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
            let data = await res.json();
            
            if (data && data.length > 0) {
                return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            } 
            
            let fallbackRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&limit=1`);
            let fallbackData = await fallbackRes.json();
            
            if (fallbackData && fallbackData.length > 0) {
                return [parseFloat(fallbackData[0].lat), parseFloat(fallbackData[0].lon)];
            }

            // Fallback: Default to Dhaka Center Coordinates if API search returns empty
            return [23.8103, 90.4125]; 

        } catch (e) { 
            console.error("Geocoding Error:", e);
            return [23.8103, 90.4125]; 
        }
    }

    function generatePathPoints(s, d, steps = 15) {
        let pts = [];
        for (let i = 0; i <= steps; i++) pts.push([s[0] + (d[0] - s[0]) * (i / steps), s[1] + (d[1] - s[1]) * (i / steps)]);
        return pts;
    }

    async function plotRoute(startLoc, destLoc) {
        if (!startLoc || !destLoc) { alert("Please enter Start and Destination!"); return false; }
        
        alertText.innerText = "Searching location coordinates...";
        const sCoords = await geocodeLocation(startLoc);
        const dCoords = await geocodeLocation(destLoc);

        if (currentRouteLine) map.removeLayer(currentRouteLine);
        if (startMarker) map.removeLayer(startMarker);
        if (destMarker) map.removeLayer(destMarker);
        if (liveMarker) map.removeLayer(liveMarker);

        activePathCoordinates = generatePathPoints(sCoords, dCoords, 15);
        currentRouteLine = L.polyline(activePathCoordinates, { color: '#2563eb', weight: 5, dashArray: '6, 10' }).addTo(map);
        startMarker = L.marker(sCoords).addTo(map).bindPopup(`<b>Start:</b> ${startLoc}`).openPopup();
        destMarker = L.marker(dCoords).addTo(map).bindPopup(`<b>Dest:</b> ${destLoc}`);
        
        map.fitBounds(currentRouteLine.getBounds(), { padding: [50, 50] });
        setTimeout(() => map.invalidateSize(), 200);

        document.getElementById("alert-box").className = "alert-box alert-normal";
        alertText.innerText = `Route active: ${startLoc} to ${destLoc}`;
        return true;
    }

    function startMovement() {
        if (activePathCoordinates.length === 0) { alert("Plot a route first!"); return; }
        if (animationInterval) clearInterval(animationInterval);
        if (liveMarker) map.removeLayer(liveMarker);

        const icon = L.divIcon({ html: '<i class="fa-solid fa-person-walking" style="color: #22c55e; font-size: 26px;"></i>', iconAnchor: [13, 26] });
        let step = 0;
        liveMarker = L.marker(activePathCoordinates[0], { icon }).addTo(map);

        if (currentUser) {
            currentUser.status = "Moving";
            renderStudents(students);
            
            currentActiveTripLog = {
                startTime: new Date().toLocaleString(),
                userName: currentUser.name,
                phone: currentUser.phone,
                start: currentUser.start || document.getElementById("start-input").value,
                dest: currentUser.dest || document.getElementById("dest-input").value,
                status: "In Transit",
                completeTime: "In Progress"
            };
            travelHistory.unshift(currentActiveTripLog);
            saveTravelHistoryToStorage();
            addSystemLog(currentUser.name, currentUser.phone, "Travel Started", `Journey started towards ${currentActiveTripLog.dest}`);
        }

        animationInterval = setInterval(() => {
            step++;
            if (step < activePathCoordinates.length) {
                liveMarker.setLatLng(activePathCoordinates[step]);
                map.panTo(activePathCoordinates[step]);
            } else {
                clearInterval(animationInterval);
                if (currentUser && currentActiveTripLog) {
                    currentUser.status = "Arrived Safely";
                    currentActiveTripLog.status = "Arrived Safely";
                    currentActiveTripLog.completeTime = new Date().toLocaleTimeString();
                    saveStudentsToStorage();
                    saveTravelHistoryToStorage();
                    renderStudents(students);
                    addSystemLog(currentUser.name, currentUser.phone, "Travel Completed", "Reached destination safely.");
                    sendBrowserNotification("Arrival Alert", `${currentUser.name} reached destination safely.`);
                }
                alertText.innerText = "Destination reached safely.";
            }
        }, 1200);
    }

    document.getElementById("show-route-btn").addEventListener("click", () => {
        const s = document.getElementById("start-input").value.trim();
        const d = document.getElementById("dest-input").value.trim();
        if(currentUser) { currentUser.start = s; currentUser.dest = d; saveStudentsToStorage(); renderStudents(students); }
        plotRoute(s, d);
    });

    document.getElementById("start-movement-btn").addEventListener("click", () => startMovement());

    // Mark Safe Button Action
    document.getElementById("mark-safe-btn").addEventListener("click", () => {
        if (!currentUser) return;
        if (animationInterval) clearInterval(animationInterval);

        currentUser.status = "Arrived Safely";
        if (currentActiveTripLog) {
            currentActiveTripLog.status = "Manually Marked Safe";
            currentActiveTripLog.completeTime = new Date().toLocaleTimeString();
        }

        saveStudentsToStorage();
        saveTravelHistoryToStorage();
        renderStudents(students);
        renderTravelHistory();

        alertText.innerText = `${currentUser.name} marked SAFE!`;
        sendBrowserNotification("Safety Notification", `${currentUser.name} manually marked safe.`);
        addSystemLog(currentUser.name, currentUser.phone, "Marked Safe", `Manually marked safe.`);
        alert("Safe status registered!");
    });

    // Safety Feedback
    document.getElementById("safety-feedback-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const rating = document.getElementById("feedback-rating").value;
        const text = document.getElementById("feedback-text").value.trim();

        safetyFeedbacks.unshift({ user: currentUser ? currentUser.name : "User", rating, text, date: new Date().toLocaleDateString() });
        saveFeedbacksToStorage();
        document.getElementById("feedback-text").value = "";
        alert("Feedback Submitted!");
        renderReports();
    });

    // Render Data Tables
    function renderStudents(data) {
        tableBody.innerHTML = "";
        if (!data || data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: #94a3b8;">No registered members found.</td></tr>`;
            return;
        }

        data.forEach((student, index) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${student.name}</strong></td>
                <td><a href="tel:${student.phone}" style="color: #60a5fa;">${student.phone}</a></td>
                <td>${student.email}</td>
                <td><span style="background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 4px;">${student.occupation || 'N/A'}</span></td>
                <td><span class="status-badge badge-active">${student.blood || '--'}</span></td>
                <td><a href="tel:${student.emergency}" style="color: #f87171;"><i class="fa-solid fa-phone text-xs"></i> ${student.emergency || '--'}</a></td>
                <td><span class="status-badge ${student.status === 'Moving' ? 'badge-moving' : 'badge-active'}">${student.status}</span></td>
                <td>
                    <div class="btn-action-group">
                        <button class="btn-tbl-view" onclick="viewStudentFullProfile(${index})"><i class="fa-solid fa-address-card"></i> Profile</button>
                        ${isAdminLoggedIn ? `<button class="btn-delete" onclick="deleteStudent(${index})"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    function renderTravelHistory() {
        travelHistoryTableBody.innerHTML = "";
        if (travelHistory.length === 0) {
            travelHistoryTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 1.5rem; color: #94a3b8;">No travel history recorded yet.</td></tr>`;
            return;
        }

        travelHistory.forEach(t => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><small>${t.startTime}</small></td>
                <td><strong>${t.userName}</strong></td>
                <td>${t.phone}</td>
                <td>${t.start}</td>
                <td>${t.dest}</td>
                <td><span class="status-badge badge-moving">${t.status}</span></td>
                <td><small>${t.completeTime}</small></td>
            `;
            travelHistoryTableBody.appendChild(row);
        });
    }

    function renderSystemLogs() {
        logsTableBody.innerHTML = "";
        if (systemLogs.length === 0) {
            logsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 1.5rem; color: #94a3b8;">No logs recorded yet.</td></tr>`;
            return;
        }

        systemLogs.forEach(log => {
            const isSos = log.eventType.includes("SOS");
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><small>${log.timestamp}</small></td>
                <td><strong>${log.userName}</strong></td>
                <td>${log.phone}</td>
                <td><span class="status-badge ${isSos ? 'badge-danger' : 'badge-active'}">${log.eventType}</span></td>
                <td>${log.details}</td>
            `;
            logsTableBody.appendChild(row);
        });
    }

    function renderReports() {
        document.getElementById("stat-total-users").innerText = students.length;
        document.getElementById("stat-active-sos").innerText = systemLogs.filter(l => l.eventType.includes("SOS")).length;
        document.getElementById("stat-total-trips").innerText = travelHistory.length;

        feedbackTableBody.innerHTML = "";
        if (safetyFeedbacks.length === 0) {
            feedbackTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 1rem; color: #94a3b8;">No feedback submitted yet.</td></tr>`;
            return;
        }

        safetyFeedbacks.forEach(fb => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${fb.user}</strong></td>
                <td><span class="status-badge badge-active">${fb.rating}</span></td>
                <td>${fb.text}</td>
                <td><small>${fb.date}</small></td>
            `;
            feedbackTableBody.appendChild(row);
        });
    }

    document.getElementById("clear-logs-btn").addEventListener("click", () => {
        if (confirm("Clear all recorded system logs?")) {
            systemLogs = []; saveLogsToStorage(); renderSystemLogs();
        }
    });

    // CSV Download Helpers
    document.getElementById("download-csv-btn").addEventListener("click", () => {
        if (students.length === 0) return alert("No members data to export!");
        let csv = "data:text/csv;charset=utf-8,Name,Phone,Email,Occupation,Blood,Emergency,Status\n";
        students.forEach(s => { csv += `"${s.name}","${s.phone}","${s.email}","${s.occupation}","${s.blood}","${s.emergency}","${s.status}"\n`; });
        downloadCSVFile(csv, "RouteGuard_Members_List.csv");
    });

    document.getElementById("download-travel-history-csv").addEventListener("click", () => {
        if (travelHistory.length === 0) return alert("No travel history to export!");
        let csv = "data:text/csv;charset=utf-8,Start Time,User Name,Phone,Start Location,Destination,Status,Completion Time\n";
        travelHistory.forEach(t => { csv += `"${t.startTime}","${t.userName}","${t.phone}","${t.start}","${t.dest}","${t.status}","${t.completeTime}"\n`; });
        downloadCSVFile(csv, "RouteGuard_Travel_History_Report.csv");
    });

    function downloadCSVFile(csvContent, filename) {
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    window.viewStudentFullProfile = (index) => {
        const student = students[index];
        if (student) {
            document.getElementById("prof-name").value = student.name;
            document.getElementById("prof-phone").value = student.phone;
            document.getElementById("prof-email").value = student.email;
            document.getElementById("prof-occupation").value = student.occupation || "Student";
            document.getElementById("prof-blood").value = student.blood || "A+";
            document.getElementById("prof-emergency").value = student.emergency;
            document.getElementById("prof-nid").value = student.nid;
            document.getElementById("prof-address").value = student.address;
            profileModal.style.display = "flex";
        }
    };

    window.deleteStudent = (idx) => {
        if (confirm("Delete this user?")) {
            const deleted = students.splice(idx, 1)[0];
            saveStudentsToStorage(); renderStudents(students);
            addSystemLog("Admin", "ADMIN", "User Deleted", `Deleted ${deleted ? deleted.name : 'User'}`);
        }
    };

    document.getElementById("search-input").addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase();
        renderStudents(students.filter(s => 
            s.name.toLowerCase().includes(q) || (s.phone && s.phone.toLowerCase().includes(q)) ||
            (s.email && s.email.toLowerCase().includes(q)) || (s.occupation && s.occupation.toLowerCase().includes(q))
        ));
    });
});