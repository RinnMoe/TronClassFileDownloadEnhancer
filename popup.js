(async function(){
  const $ = (s)=>document.querySelector(s);
  const status = $('#dl-status');
  const list = $('#dl-list');
  const dlAllBtn = $('#dl-all');
  const aboutBtn = $('#about');
  const githubBtn = $('#github');
  const footer = $('#footer');
  const emptyState = $('#empty-state');
  const emptyMessage = $('#empty-message');
  const tutorialLink = $('#tutorial-link');
  const refreshLink = $('#refresh-link');

  let currentOrigin = null;

  // 格式化文件大小
  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '未知大小';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return size.toFixed(unitIndex === 0 ? 0 : 2) + ' ' + units[unitIndex];
  }

  function renderFiles(files){
    list.innerHTML = '';
    if (!files || !files.length) {
      status.style.display = 'none';
      list.style.display = 'none';
      footer.style.display = 'none';
      emptyState.style.display = 'flex';
      emptyMessage.textContent = '未检测到可下载的文件';
      return;
    }
    status.style.display = 'block';
    list.style.display = 'block';
    footer.style.display = files.length > 1 ? 'block' : 'none';
    emptyState.style.display = 'none';
    status.textContent = `检测到 ${files.length} 个文件`;
    status.className = 'status success';
    dlAllBtn.style.display = files.length>1 ? 'block' : 'none';

    files.forEach(f=>{
      const row = document.createElement('div');
      row.className = 'file-item';
      row.innerHTML = `
        <div class="file-info">
          <div class="file-name" title="${f.name}">${f.name}</div>
          <div class="file-size">${formatFileSize(f.size)}</div>
        </div>
      `;
      const btn = document.createElement('button');
      btn.className = 'primary';
      btn.textContent = '下载';
      btn.addEventListener('click', async ()=>{
        if (!currentOrigin) return;
        chrome.runtime.sendMessage({ type:'DOWNLOAD_FILE', fileId: f.id, fileName: f.name, baseUrl: currentOrigin });
      });
      row.appendChild(btn);
      list.appendChild(row);
    });

    dlAllBtn.onclick = async ()=>{
      if (!currentOrigin) return;
      for (let i=0;i<files.length;i++){
        chrome.runtime.sendMessage({ type:'DOWNLOAD_FILE', fileId: files[i].id, fileName: files[i].name, baseUrl: currentOrigin });
        await new Promise(r=>setTimeout(r, 400));
      }
    };
  }

  // 加载文件列表
  async function loadFiles(){
    emptyState.style.display = 'none';
    status.style.display = 'block';
    list.style.display = 'block';
    status.textContent = '正在读取当前页面的文件...';
    status.className = 'status';
    list.innerHTML = '';
    footer.style.display = 'none';
    const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
    if (!tab || !tab.id) { 
      status.style.display = 'none';
      list.style.display = 'none';
      footer.style.display = 'none';
      emptyState.style.display = 'flex';
      emptyMessage.textContent = '未找到活动页面';
      return;
    }
    try {
      const url = new URL(tab.url);
      currentOrigin = url.origin;
    } catch { currentOrigin = null; }
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_FILES' });
      renderFiles(resp && resp.files || []);
    } catch (e) {
      status.style.display = 'none';
      list.style.display = 'none';
      footer.style.display = 'none';
      emptyState.style.display = 'flex';
      emptyMessage.textContent = '不支持当前页面';
    }
  }

  aboutBtn.addEventListener('click', ()=>{
    chrome.tabs.create({ url: 'https://toys.rinn.moe/tcde' });
  });

  githubBtn.addEventListener('click', ()=>{
    chrome.tabs.create({ url: 'https://github.com/RinnMoe/TronClassFileDownloadEnhancer' });
  });

  tutorialLink.addEventListener('click', (e)=>{
    e.preventDefault();
    chrome.tabs.create({ url: 'https://toys.rinn.moe/tcde/tutorial.html' });
  });

  refreshLink.addEventListener('click', async (e)=>{
    e.preventDefault();
    const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
    if (tab && tab.id) {
      await chrome.tabs.reload(tab.id);
      setTimeout(() => loadFiles(), 500);
    }
  });

  // 初始加载
  await loadFiles();
})();
