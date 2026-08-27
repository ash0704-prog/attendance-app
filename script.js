/* ============================================================
   FIREBASE CONFIG — your real project (Auth + Firestore)
============================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyDjRaqpEMA9PdYMpkTdvo2qeyr0UsyDPi0",
  authDomain: "college-attendance-syste-3ce1d.firebaseapp.com",
  projectId: "college-attendance-syste-3ce1d",
  storageBucket: "college-attendance-syste-3ce1d.firebasestorage.app",
  messagingSenderId: "800122622361",
  appId: "1:800122622361:web:0d96dc4210e919ce84c308",
  measurementId: "G-1WYTCPE2YJ"
};

let firebaseAuth = null;
let db = null;
let firebaseInitError = null;

if(typeof firebase === 'undefined'){
  firebaseInitError = 'The Firebase SDK script did not load (typeof firebase is undefined). Check network access to cdnjs.cloudflare.com.';
}else{
  try{
    firebase.initializeApp(firebaseConfig);
    firebaseAuth = firebase.auth();
    db = firebase.firestore();
  }catch(e){
    firebaseInitError = 'firebase.initializeApp()/auth()/firestore() threw: ' + (e && e.message ? e.message : e);
    console.error('Firebase init failed', e);
  }
}

let currentUser = null;
let students = [];          // [{id, rollNo, name, department, year, section}]
let allAttendance = [];     // [{id, studentId, date, subject, status, facultyId, createdAt}]

function slug(str){
  return String(str).trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'general';
}
const todayStr = () => new Date().toISOString().slice(0,10);

function setSyncBadge(state, text){
  const el = document.getElementById('syncBadge');
  el.className = 'sync-badge' + (state==='err' ? ' err' : '');
  el.textContent = text;
}
function showDiagnosticBanner(html){
  const el = document.getElementById('diagnosticBanner');
  el.className = 'diagnostic-banner';
  el.innerHTML = html;
  el.style.display = 'block';
}
function hideDiagnosticBanner(){
  document.getElementById('diagnosticBanner').style.display = 'none';
}

/* ---------------- LOGIN SCREEN LOGIC ---------------- */
function showLoginAlert(message, kind){
  const el = document.getElementById('loginAlert');
  el.innerHTML = message;
  el.className = 'login-alert show ' + (kind || 'error');
}
function clearLoginAlert(){
  const el = document.getElementById('loginAlert');
  el.className = 'login-alert';
  el.innerHTML = '';
}
function setFieldError(fieldId, msgId, message){
  document.getElementById(fieldId).classList.toggle('field-error', !!message);
  document.getElementById(msgId).textContent = message || '';
}

document.getElementById('pwToggle').addEventListener('click', ()=>{
  const input = document.getElementById('loginPassword');
  const btn = document.getElementById('pwToggle');
  const isPw = input.type === 'password';
  input.type = isPw ? 'text' : 'password';
  btn.textContent = isPw ? 'Hide' : 'Show';
});

if(firebaseInitError){
  showLoginAlert('<b>Firebase failed to initialize.</b><br>' + firebaseInitError.replace(/</g,'&lt;'), 'error');
}

async function attemptLogin(){
  clearLoginAlert();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  let hasError = false;
  if(!email){ setFieldError('loginEmail','loginEmailMsg','Please enter your email or username.'); hasError = true; }
  else setFieldError('loginEmail','loginEmailMsg','');
  if(!password){ setFieldError('loginPassword','loginPasswordMsg','Please enter your password.'); hasError = true; }
  else setFieldError('loginPassword','loginPasswordMsg','');
  if(hasError) return;

  if(!firebaseAuth){
    showLoginAlert('<b>Cannot sign in — Firebase never initialized.</b><br>' + (firebaseInitError ? firebaseInitError.replace(/</g,'&lt;') : ''), 'error');
    return;
  }

  const btn = document.getElementById('loginSubmitBtn');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try{
    const remember = document.getElementById('rememberMe').checked;
    await firebaseAuth.setPersistence(
      remember ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION
    );
    await firebaseAuth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged takes over from here
  }catch(err){
    if(err && err.code === 'auth/network-request-failed'){
      showLoginAlert('<b>Network request to Firebase was blocked.</b> The SDK loaded, but sign-in could not reach Google\u2019s servers.', 'error');
    }else if(err && err.code === 'auth/too-many-requests'){
      showLoginAlert('Too many attempts. Please wait a moment and try again.', 'error');
    }else{
      showLoginAlert('Invalid username or password.', 'error');
    }
    console.error('Login failed', err && err.code, err && err.message);
    btn.disabled = false;
    btn.textContent = original;
  }
}

document.getElementById('loginSubmitBtn').addEventListener('click', attemptLogin);
['loginEmail','loginPassword'].forEach(id=>{
  document.getElementById(id).addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ e.preventDefault(); attemptLogin(); }
  });
});

document.getElementById('forgotPasswordBtn').addEventListener('click', async ()=>{
  const email = document.getElementById('loginEmail').value.trim();
  if(!email){ setFieldError('loginEmail','loginEmailMsg','Enter your email above first, then click "Forgot password?"'); return; }
  setFieldError('loginEmail','loginEmailMsg','');
  if(!firebaseAuth){ showLoginAlert('Firebase is not initialized — cannot send reset email.', 'error'); return; }
  try{ await firebaseAuth.sendPasswordResetEmail(email); }catch(err){ console.error('Password reset error', err.code, err.message); }
  showLoginAlert('If an account exists for that address, a password reset email has been sent.', 'info');
});

document.getElementById('logoutBtn').addEventListener('click', async ()=>{
  if(firebaseAuth){ try{ await firebaseAuth.signOut(); }catch(e){ console.error('Logout error', e); } }
});

function showLoginScreen(){
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('rememberMe').checked = true;
  clearLoginAlert();
  setFieldError('loginEmail','loginEmailMsg','');
  setFieldError('loginPassword','loginPasswordMsg','');
  if(firebaseInitError){
    showLoginAlert('<b>Firebase failed to initialize.</b><br>' + firebaseInitError.replace(/</g,'&lt;'), 'error');
  }
}

async function showDashboard(user){
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('loadingScreen').style.display = 'block';
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('loggedInUserName').textContent = user.email || 'Faculty';
  currentUser = user;
  await ensureFacultyDoc(user);
  await initDashboardApp();
}

if(firebaseAuth){
  firebaseAuth.onAuthStateChanged((user)=>{
    if(user) showDashboard(user); else showLoginScreen();
  });
}else{
  showLoginScreen();
}

/* ---------------- FIRESTORE DATA LAYER ---------------- */
async function ensureFacultyDoc(user){
  try{
    const ref = db.collection('faculty').doc(user.uid);
    const snap = await ref.get();
    if(!snap.exists){
      await ref.set({
        facultyId: user.uid,
        name: user.email.split('@')[0],
        email: user.email,
        department: 'Computer Science',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  }catch(e){
    console.error('ensureFacultyDoc failed', e);
  }
}

async function loadStudents(){
  const snap = await db.collection('students').orderBy('rollNo').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function saveStudent(student){
  await db.collection('students').doc(student.rollNo).set(student);
}

async function deleteStudentDoc(rollNo){
  await db.collection('students').doc(rollNo).delete();
}

async function loadAllAttendance(){
  const snap = await db.collection('attendance').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function saveAttendanceBatch(date, subject, records){
  const batch = db.batch();
  const subjectSlug = slug(subject);
  Object.keys(records).forEach(rollNo=>{
    const status = records[rollNo];
    const docId = `${rollNo}_${date}_${subjectSlug}`;
    const ref = db.collection('attendance').doc(docId);
    batch.set(ref, {
      attendanceId: docId,
      studentId: rollNo,
      date: date,
      subject: subject,
      status: status,
      facultyId: currentUser ? currentUser.uid : null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });
  await batch.commit();
}
/* ============================================================
   TAB NAVIGATION
============================================================ */
document.querySelectorAll('nav button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    ['dashboard','register','students','reports'].forEach(t=>{
      document.getElementById('tab-'+t).style.display = (t===btn.dataset.tab) ? 'block' : 'none';
    });
    if(btn.dataset.tab==='dashboard') renderDashboard();
    if(btn.dataset.tab==='register') renderRegister();
    if(btn.dataset.tab==='students') renderStudents();
    if(btn.dataset.tab==='reports') renderReports();
  });
});

/* ============================================================
   SHARED HELPERS: per-student stats from allAttendance cache
============================================================ */
function computeStudentStats(rollNo, filterFn){
  const records = allAttendance.filter(a => a.studentId === rollNo && (!filterFn || filterFn(a)));
  const held = records.length;
  const present = records.filter(r=>r.status==='P').length;
  const pct = held>0 ? Math.round((present/held)*100) : null;
  return { held, present, absent: held-present, pct };
}

/* ============================================================
   DASHBOARD TAB
============================================================ */
let attendanceChartInstance = null;

async function renderDashboard(){
  document.getElementById('dashTotalStudents').textContent = students.length;

  const today = todayStr();

const todaysRecords = allAttendance.filter(a => a.date === today);

const presentStudentIds = new Set(
  todaysRecords
    .filter(r => r.status === 'P')
    .map(r => r.studentId)
);

const absentStudentIds = new Set(
  todaysRecords
    .filter(r => r.status === 'A')
    .map(r => r.studentId)
);

presentStudentIds.forEach(id => absentStudentIds.delete(id));

const presentToday = presentStudentIds.size;
const absentToday = absentStudentIds.size;
  document.getElementById('dashPresentToday').textContent = presentToday;
  document.getElementById('dashAbsentToday').textContent = absentToday;
 
   // Today's absent students
  const absentStudents = students.filter(s =>
    absentStudentIds.has(s.rollNo)
  );

  document.getElementById('absentCount').textContent =
    `${absentStudents.length} student${absentStudents.length === 1 ? '' : 's'}`;

  const absentWrap = document.getElementById('absentStudentsListWrap');

  if(absentStudents.length === 0){
    absentWrap.innerHTML =
      '<div class="empty">No absent students today.</div>';
  }else{
    absentWrap.innerHTML = absentStudents.map(s => `
      <div class="shortage-card" data-roll="${s.rollNo}">
        <div>
          <div class="name">${s.name}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);">
            Roll No: ${s.rollNo}
          </div>
        </div>
        <div class="pct" style="color:var(--absent);">Absent</div>
      </div>
    `).join('');

    absentWrap.querySelectorAll('.shortage-card').forEach(card => {
      card.addEventListener('click', () =>
        openStudentProfile(card.dataset.roll)
      );
    });
       }
  const perStudent = students.map(s => ({ ...s, stats: computeStudentStats(s.rollNo) }));
  const withPct = perStudent.filter(s => s.stats.pct !== null);
  const overallPct = withPct.length ? Math.round(withPct.reduce((a,s)=>a+s.stats.pct,0)/withPct.length) : null;
  document.getElementById('dashOverallPct').textContent = overallPct===null ? '—' : overallPct + '%';

  // Doughnut chart: today's present vs absent
  const ctx = document.getElementById('attendanceChart').getContext('2d');
  const chartData = {
    labels: ['Present', 'Absent'],
    datasets: [{ data: [presentToday, absentToday], backgroundColor: ['#3F7050', '#A63D40'], borderWidth: 0 }]
  };
  if(attendanceChartInstance){
    attendanceChartInstance.data = chartData;
    attendanceChartInstance.update();
  }else{
    attendanceChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: chartData,
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: "'IBM Plex Mono', monospace", size: 11 } } } }
      }
    });
  }

  // Per-student attendance % table
  const tableWrap = document.getElementById('dashStudentTableWrap');
  if(students.length===0){
    tableWrap.innerHTML = '<div class="empty">No students yet.</div>';
  }else{
    const rows = perStudent.map(s=>{
      const pct = s.stats.pct===null ? '—' : s.stats.pct + '%';
      const pctVal = s.stats.pct===null ? 0 : s.stats.pct;
      const low = s.stats.pct!==null && s.stats.pct<75;
      return `<tr class="dash-student-row" data-roll="${s.rollNo}">
        <td>${s.name}</td>
        <td><span class="pct-bar"><span class="pct-fill ${low?'low':''}" style="width:${pctVal}%"></span></span>
        <span class="stamp ${low?'low':'ok'}">${pct}</span></td>
      </tr>`;
    }).join('');
    tableWrap.innerHTML = `<table><thead><tr><th>Name</th><th style="width:160px;">Attendance %</th></tr></thead><tbody>${rows}</tbody></table>`;
    tableWrap.querySelectorAll('.dash-student-row').forEach(tr=>{
      tr.addEventListener('click', ()=>openStudentProfile(tr.dataset.roll));
    });
  }

  // Shortage section
  const shortageStudents = perStudent.filter(s=>s.stats.pct!==null && s.stats.pct<75);
  document.getElementById('shortageCount').textContent = `${shortageStudents.length} student${shortageStudents.length===1?'':'s'}`;
  const shortageWrap = document.getElementById('shortageListWrap');
  if(shortageStudents.length===0){
    shortageWrap.innerHTML = '<div class="empty">No students currently below 75% attendance.</div>';
  }else{
    shortageWrap.innerHTML = shortageStudents.map(s=>`
      <div class="shortage-card" data-roll="${s.rollNo}">
        <div><div class="name">${s.name}</div><div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);">Attendance is below the required 75%.</div></div>
        <div class="pct">${s.stats.pct}%</div>
      </div>`).join('');
    shortageWrap.querySelectorAll('.shortage-card').forEach(card=>{
      card.addEventListener('click', ()=>openStudentProfile(card.dataset.roll));
    });
  }
}

/* ============================================================
   STUDENT PROFILE MODAL
============================================================ */
function openStudentProfile(rollNo){
  const student = students.find(s=>s.rollNo===rollNo);
  if(!student) return;
  const stats = computeStudentStats(rollNo);
  document.getElementById('profileName').textContent = student.name;
  document.getElementById('profileRoll').textContent = `Roll No. ${student.rollNo}`;
  document.getElementById('profileMeta').innerHTML = `
    <div><span>Department</span>${student.department || '—'}</div>
    <div><span>Year</span>${student.year || '—'}</div>
    <div><span>Section</span>${student.section || '—'}</div>
    <div><span>Roll Number</span>${student.rollNo}</div>
  `;
  const low = stats.pct!==null && stats.pct<75;
  document.getElementById('profileStats').innerHTML = `
    <div class="profile-stat"><div class="n">${stats.held}</div><div class="l">Total Classes</div></div>
    <div class="profile-stat"><div class="n" style="color:var(--present);">${stats.present}</div><div class="l">Attended</div></div>
    <div class="profile-stat"><div class="n" style="color:var(--absent);">${stats.absent}</div><div class="l">Absent</div></div>
    <div class="profile-stat"><div class="n" style="color:${low?'var(--absent)':'var(--present)'};">${stats.pct===null?'—':stats.pct+'%'}</div><div class="l">Attendance %</div></div>
  `;
  const records = allAttendance.filter(a=>a.studentId===rollNo).sort((a,b)=>b.date.localeCompare(a.date));
  const historyWrap = document.getElementById('profileHistoryWrap');
  if(records.length===0){
    historyWrap.innerHTML = '<div class="empty">No attendance history recorded yet.</div>';
  }else{
    const rows = records.map(r=>`
      <tr><td>${r.date}</td><td>${r.subject}</td>
      <td><span class="stamp ${r.status==='P'?'ok':'low'}">${r.status==='P'?'Present':'Absent'}</span></td></tr>`).join('');
    historyWrap.innerHTML = `<table><thead><tr><th>Date</th><th>Subject</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  document.getElementById('profileModal').classList.add('show');
}
document.getElementById('profileClose').addEventListener('click', ()=>{
  document.getElementById('profileModal').classList.remove('show');
});
document.getElementById('profileModal').addEventListener('click', (e)=>{
  if(e.target.id === 'profileModal') document.getElementById('profileModal').classList.remove('show');
});

/* ============================================================
   TAKE ATTENDANCE TAB
============================================================ */
let dirtyBucket = {};

function activeKeyParts(){
  const date = document.getElementById('dateInput').value || todayStr();
  const subject = document.getElementById('subjectInput').value.trim() || 'General';
  return { date, subject };
}

function renderRegister(){
  const wrap = document.getElementById('registerTableWrap');
  const { date, subject } = activeKeyParts();
  const subjectSlug = slug(subject);
  dirtyBucket = {};
  allAttendance
    .filter(a => a.date===date && slug(a.subject)===subjectSlug)
    .forEach(a => dirtyBucket[a.studentId] = a.status);

  if(students.length===0){
    wrap.innerHTML = '<div class="empty">No students yet. Add students in the Students tab.</div>';
    return;
  }
  const rows = students.map(s=>{
    const status = dirtyBucket[s.rollNo];
    return `<tr data-roll="${s.rollNo}">
      <td class="roll">${s.rollNo}</td><td>${s.name}</td>
      <td><div class="toggle-group">
        <button class="toggle present ${status==='P'?'on':''}" data-status="P">Present</button>
        <button class="toggle absent ${status==='A'?'on':''}" data-status="A">Absent</button>
      </div></td></tr>`;
  }).join('');
  wrap.innerHTML = `<table><thead><tr><th style="width:130px;">Roll No.</th><th>Name</th><th style="width:220px;">Status</th></tr></thead><tbody>${rows}</tbody></table>`;

  wrap.querySelectorAll('.toggle').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const roll = btn.closest('tr').dataset.roll;
      const status = btn.dataset.status;
      dirtyBucket[roll] = (dirtyBucket[roll]===status) ? undefined : status;
      if(dirtyBucket[roll]===undefined) delete dirtyBucket[roll];
      btn.closest('tr').querySelectorAll('.toggle').forEach(b=>b.classList.toggle('on', b.dataset.status===dirtyBucket[roll]));
    });
  });
}

document.getElementById('dateInput').addEventListener('change', renderRegister);
document.getElementById('subjectInput').addEventListener('change', renderRegister);

document.getElementById('markAllPresent').addEventListener('click', ()=>{
  students.forEach(s=>dirtyBucket[s.rollNo]='P');
  renderRegister();
  // renderRegister rebuilds dirtyBucket from cache, so re-apply after
  students.forEach(s=>dirtyBucket[s.rollNo]='P');
  document.querySelectorAll('#registerTableWrap tr').forEach(tr=>{
    tr.querySelectorAll('.toggle').forEach(b=>b.classList.toggle('on', b.dataset.status==='P'));
  });
});

document.getElementById('saveAttendance').addEventListener('click', async ()=>{
  const btn = document.getElementById('saveAttendance');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving…';
  const { date, subject } = activeKeyParts();
  try{
    await saveAttendanceBatch(date, subject, dirtyBucket);
    allAttendance = await loadAllAttendance();
    btn.textContent = 'Saved to cloud ✓';
    setSyncBadge('ok','Cloud sync ready');
  }catch(e){
    console.error('Save attendance failed', e);
    btn.textContent = 'Save failed — try again';
    setSyncBadge('err','Save failed');
    showDiagnosticBanner('<b>Attendance save failed.</b><br>' + String(e && e.message ? e.message : e).replace(/</g,'&lt;'));
  }
  btn.disabled = false;
  setTimeout(()=>btn.textContent=original, 1600);
});

/* ============================================================
   STUDENTS TAB
============================================================ */
function renderStudents(){
  const wrap = document.getElementById('studentsTableWrap');
  if(students.length===0){
    wrap.innerHTML = '<div class="empty">No students yet. Add your first student above.</div>';
    return;
  }
  const rows = students.map(s=>`
    <tr data-roll="${s.rollNo}">
      <td class="roll">${s.rollNo}</td><td>${s.name}</td>
      <td>${s.department||'—'}</td><td>${s.year||'—'}</td><td>${s.section||'—'}</td>
      <td class="actions">
        <button class="icon-btn" data-action="view">View</button>
        <button class="icon-btn danger-text" data-action="remove">Remove</button>
      </td>
    </tr>`).join('');
  wrap.innerHTML = `<table><thead><tr>
      <th style="width:120px;">Roll No.</th><th>Name</th><th>Dept</th><th>Year</th><th>Section</th>
      <th class="actions" style="width:130px;">Actions</th>
    </tr></thead><tbody>${rows}</tbody></table>`;

  wrap.querySelectorAll('[data-action="remove"]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const roll = btn.closest('tr').dataset.roll;
      if(!confirm(`Remove student ${roll}? This does not delete their past attendance records.`)) return;
      try{
        await deleteStudentDoc(roll);
        students = students.filter(s=>s.rollNo!==roll);
        renderStudents();
      }catch(e){
        console.error('Remove student failed', e);
        alert('Could not remove student — see console for details.');
      }
    });
  });
  wrap.querySelectorAll('[data-action="view"]').forEach(btn=>{
    btn.addEventListener('click', ()=> openStudentProfile(btn.closest('tr').dataset.roll));
  });
}

document.getElementById('addStudent').addEventListener('click', async ()=>{
  const roll = document.getElementById('newRoll').value.trim();
  const name = document.getElementById('newName').value.trim();
  const department = document.getElementById('newDept').value.trim() || 'CSE';
  const year = document.getElementById('newYear').value.trim();
  const section = document.getElementById('newSection').value.trim();
  if(!roll || !name) return;
  if(students.some(s=>s.rollNo===roll)){ alert('A student with this roll number already exists.'); return; }
  const student = { rollNo: roll, name, department, year, section };
  try{
    await saveStudent(student);
    students.push(student);
    students.sort((a,b)=>a.rollNo.localeCompare(b.rollNo));
    ['newRoll','newName','newDept','newYear','newSection'].forEach(id=>document.getElementById(id).value='');
    renderStudents();
  }catch(e){
    console.error('Add student failed', e);
    alert('Could not save student to the cloud — see console for details.');
  }
});

/* ============================================================
   REPORTS TAB
============================================================ */
function populateReportStudentFilter(){
  const sel = document.getElementById('reportStudentFilter');
  const current = sel.value;
  sel.innerHTML = '<option value="">All students</option>' +
    students.map(s=>`<option value="${s.rollNo}">${s.name} (${s.rollNo})</option>`).join('');
  sel.value = current;
}

function getFilteredAttendance(){
  const rollFilter = document.getElementById('reportStudentFilter').value;
  const subjectFilter = document.getElementById('reportSubjectFilter').value.trim().toLowerCase();
  const from = document.getElementById('reportDateFrom').value;
  const to = document.getElementById('reportDateTo').value;
  return allAttendance.filter(a=>{
    if(rollFilter && a.studentId !== rollFilter) return false;
    if(subjectFilter && !(a.subject||'').toLowerCase().includes(subjectFilter)) return false;
    if(from && a.date < from) return false;
    if(to && a.date > to) return false;
    return true;
  });
}

function renderReports(){
  populateReportStudentFilter();
  const filtered = getFilteredAttendance();
  const rollFilter = document.getElementById('reportStudentFilter').value;

  const relevantStudents = rollFilter ? students.filter(s=>s.rollNo===rollFilter) : students;
  const stats = relevantStudents.map(s=>{
    const records = filtered.filter(a=>a.studentId===s.rollNo);
    const held = records.length;
    const present = records.filter(r=>r.status==='P').length;
    const pct = held>0 ? Math.round((present/held)*100) : null;
    return { ...s, held, present, absent: held-present, pct };
  });

  const summary = document.getElementById('reportSummary');
  const withPct = stats.filter(s=>s.pct!==null);
  const avgPct = withPct.length ? Math.round(withPct.reduce((a,s)=>a+s.pct,0)/withPct.length) : 0;
  summary.innerHTML = `
    <div>Records matched<br><b style="font-size:15px;color:var(--ink);">${filtered.length}</b></div>
    <div>Students shown<br><b style="font-size:15px;color:var(--ink);">${stats.length}</b></div>
    <div>Avg. attendance<br><b style="font-size:15px;color:var(--ink);">${filtered.length? avgPct+'%' : '—'}</b></div>
  `;

  const wrap = document.getElementById('reportsTableWrap');
  if(stats.length===0){
    wrap.innerHTML = '<div class="empty">No students match the current filters.</div>';
    return;
  }
  const rows = stats.map(s=>{
    const pct = s.pct===null ? '—' : s.pct;
    const pctVal = s.pct===null ? 0 : s.pct;
    const low = s.pct!==null && s.pct<75;
    return `<tr>
      <td class="roll">${s.rollNo}</td><td>${s.name}</td><td>${s.held}</td><td>${s.present}</td><td>${s.absent}</td>
      <td><span class="pct-bar"><span class="pct-fill ${low?'low':''}" style="width:${pctVal}%"></span></span>
      <span class="stamp ${low?'low':'ok'}">${pct}${s.pct!==null?'%':''}</span></td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `<table><thead><tr>
      <th style="width:110px;">Roll No.</th><th>Name</th><th style="width:70px;">Held</th>
      <th style="width:80px;">Present</th><th style="width:80px;">Absent</th><th style="width:180px;">Attendance %</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <p style="margin-top:14px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);">Rows below 75% are flagged in red.</p>`;
}

document.getElementById('reportApplyFilter').addEventListener('click', renderReports);
document.getElementById('reportClearFilter').addEventListener('click', ()=>{
  document.getElementById('reportStudentFilter').value = '';
  document.getElementById('reportSubjectFilter').value = '';
  document.getElementById('reportDateFrom').value = '';
  document.getElementById('reportDateTo').value = '';
  renderReports();
});
document.getElementById('reportPrint').addEventListener('click', ()=> window.print());
document.getElementById('reportDownloadCsv').addEventListener('click', ()=>{
  const filtered = getFilteredAttendance();
  const rollFilter = document.getElementById('reportStudentFilter').value;
  const relevantStudents = rollFilter ? students.filter(s=>s.rollNo===rollFilter) : students;
  let csv = 'Roll No,Name,Held,Present,Absent,Attendance %\n';
  relevantStudents.forEach(s=>{
    const records = filtered.filter(a=>a.studentId===s.rollNo);
    const held = records.length;
    const present = records.filter(r=>r.status==='P').length;
    const pct = held>0 ? Math.round((present/held)*100) : '';
    csv += `${s.rollNo},"${s.name}",${held},${present},${held-present},${pct}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `attendance-report-${todayStr()}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

/* ============================================================
   APP INIT (runs after login)
============================================================ */
async function initDashboardApp(){
  document.getElementById('dateInput').value = todayStr();
  hideDiagnosticBanner();
  try{
    students = await loadStudents();
    allAttendance = await loadAllAttendance();
    setSyncBadge('ok','Cloud sync ready');
  }catch(e){
    console.error('Failed to load data from Firestore', e);
    setSyncBadge('err','Load failed');
    showDiagnosticBanner(
      '<b>Could not load data from Firestore.</b><br>' + String(e && e.message ? e.message : e).replace(/</g,'&lt;') +
      '<br>This is often a Firestore Security Rules issue — see the setup instructions.'
    );
  }
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'block';
  renderDashboard();
}
