// File: src/js/setup.js
import { set, get } from 'idb-keyval';
const $ = id => document.getElementById(id);
const show = (...els) => els.forEach(el => el?.classList.remove('hidden'));
const hide = (...els) => els.forEach(el => el?.classList.add('hidden'));

export async function initSetup() {
  const schoolInput   = $('schoolNameInput');
  const addSchoolBtn  = $('addSchoolBtn');
  const schoolSelect  = $('schoolSelect');
  const classInput    = $('classInput');
  const addClassBtn   = $('addClassBtn');
  const classSelect   = $('classSelect');
  const sectionSelect = $('teacherSectionSelect');
  const saveSetupBtn  = $('saveSetup');
  const editSetupBtn  = $('editSetup');
  const setupForm     = $('setupForm');
  const setupDisplay  = $('setupDisplay');
  const setupText     = $('setupText');

  async function loadSetupData() {
    const schools = await get('schools')||[];
    const sc      = await get('teacherSchool')||'';
    const cl      = await get('teacherClass')||'';
    const sec     = await get('teacherSection')||'';

    schoolSelect.innerHTML = `<option value="">-- Select School --</option>` +
      schools.map(s => `<option value="${s.name}"${s.name===sc?' selected':''}>${s.name}</option>`).join('');
    const schObj = schools.find(s=>s.name===sc) || {classes:[]};
    classSelect.innerHTML = `<option value="">-- Select Class --</option>` +
      schObj.classes.map(c=>`<option value="${c}"${c===cl?' selected':''}>${c}</option>`).join('');
    sectionSelect.value = sec;

    if (sc && cl && sec) {
      setupText.textContent = `${sc} | Class: ${cl} | Section: ${sec}`;
      hide(setupForm); show(setupDisplay);
    } else {
      show(setupForm); hide(setupDisplay);
    }
  }

  addSchoolBtn.onclick = async () => {
    const name = schoolInput.value.trim();
    if (!name) return alert('Enter school name');
    const schools = await get('schools')||[];
    if (schools.some(s=>s.name===name)) return alert('School exists');
    schools.push({name,classes:[]});
    await set('schools', schools);
    schoolInput.value=''; await loadSetupData();
  };

  schoolSelect.onchange = () => {
    classSelect.innerHTML = '<option value="">-- Select Class --</option>';
    sectionSelect.value = '';
  };

  addClassBtn.onclick = async () => {
    const cls = classInput.value.trim(), sch = schoolSelect.value;
    if (!sch) return alert('Select a school');
    if (!cls) return alert('Enter class');
    const schools = await get('schools')||[];
    const so = schools.find(s=>s.name===sch);
    if (so.classes.includes(cls)) return alert('Class exists');
    so.classes.push(cls);
    await set('schools', schools);
    classInput.value=''; await loadSetupData();
  };

  saveSetupBtn.onclick = async e => {
    e.preventDefault();
    const sc = schoolSelect.value, cl = classSelect.value, sec = sectionSelect.value;
    if (!sc||!cl||!sec) return alert('Complete all fields');
    await Promise.all([
      set('teacherSchool', sc),
      set('teacherClass', cl),
      set('teacherSection', sec)
    ]);
    await loadSetupData();
  };

  editSetupBtn.onclick = e => {
    e.preventDefault();
    show(setupForm); hide(setupDisplay);
  };

  await loadSetupData();
}
