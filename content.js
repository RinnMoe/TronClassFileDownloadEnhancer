(function() {
  'use strict';

  console.log('[TronClass Downloader] Content script loaded!');
  console.log('[TronClass Downloader] Current URL:', window.location.href);

  let filesData = [];

  // 更新文件列表
  function updateFilesList(files) {
    filesData = Array.isArray(files) ? files : [];
    console.log('[TronClass Downloader] Files list updated (for popup):', filesData.length);
    
    // 更新浏览器扩展图标角标
    chrome.runtime.sendMessage({ 
      type: 'UPDATE_BADGE', 
      count: filesData.length 
    }).catch(() => {});
  }

  // 拦截 fetch 请求
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = args[0];
    const response = await originalFetch.apply(this, args);

    if (typeof url === 'string') {
      const isUploadRef = url.includes('upload_reference') || url.includes('upload-reference');
      const isActivities = url.includes('/api/activities/');
      const hasReference = url.includes('reference');

      if ((isActivities && isUploadRef) || (isActivities && hasReference)) {
        console.log('[TronClass Downloader] ✓ MATCHED upload_references API!');
        const clonedResponse = response.clone();
        clonedResponse.json().then(data => {
          processFilesData(data);
        }).catch(err => {
          console.error('[TronClass Downloader] 解析响应失败:', err);
        });
      }
    }

    return response;
  };

  console.log('[TronClass Downloader] Fetch interceptor installed');

  // 拦截 XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    const self = this;

    this.addEventListener('load', function() {
      if (self._url && typeof self._url === 'string') {
        const isUploadRef = self._url.includes('upload_reference') || self._url.includes('upload-reference');
        const isActivities = self._url.includes('/api/activities/');
        const hasReference = self._url.includes('reference');

        if ((isActivities && isUploadRef) || (isActivities && hasReference)) {
          console.log('[TronClass Downloader] ✓ MATCHED upload_references API via XHR!');
          try {
            const data = JSON.parse(this.responseText);
            processFilesData(data);
          } catch (err) {
            console.error('[TronClass Downloader] 解析响应失败:', err);
          }
        }
      }
    });

    return originalSend.apply(this, args);
  };

  console.log('[TronClass Downloader] XHR interceptor installed');

  // 处理文件数据
  function processFilesData(data) {
    const references = data.referances || data.references || data.value || [];
    console.log('[TronClass Downloader] Found references:', references.length);

    if (references && references.length > 0) {
      const files = references.map(ref => {
        const fileId = ref.id || ref.reference_id;
        const fileName = ref.name || ref.reference_name || ref.title || '未命名文件';
        const fileSize = (ref.upload && ref.upload.size) ? ref.upload.size : 0;
        
        console.log('[TronClass Downloader] File:', fileName, 'Size:', fileSize);
        
        return {
          id: fileId,
          name: fileName,
          size: fileSize
        };
      });
      updateFilesList(files);
    } else {
      updateFilesList([]);
    }
  }

  // 页面加载完成后检查文件
  window.addEventListener('load', () => {
    checkAndFetchFiles();
  });

  // hash变化时检查文件
  window.addEventListener('hashchange', () => {
    checkAndFetchFiles();
  });

  // 检查并获取文件
  function checkAndFetchFiles() {
    const url = window.location.href;
    let activityId = null;

    // 尝试从hash中提取activity ID
    const hashMatch = window.location.hash.match(/#\/(\d+)/);
    if (hashMatch) {
      activityId = hashMatch[1];
    }

    // 尝试从路径中提取activity ID
    if (!activityId) {
      const pathMatch = url.match(/\/activities\/(\d+)/);
      if (pathMatch) {
        activityId = pathMatch[1];
      }
    }

    // 尝试从learning-activity中提取
    if (!activityId) {
      const learningMatch = url.match(/learning-activity\/[^#]*#\/(\d+)/);
      if (learningMatch) {
        activityId = learningMatch[1];
      }
    }

    if (activityId) {
      console.log('[TronClass Downloader] Activity ID:', activityId);
      fetchFilesForActivity(activityId);
    }
  }

  // 获取活动的文件
  function fetchFilesForActivity(activityId) {
    const apiUrl = `${window.location.origin}/api/activities/${activityId}/upload_references`;
    
    fetch(apiUrl, {
      credentials: 'include'
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        processFilesData(data);
      })
      .catch(error => {
        console.error('[TronClass Downloader] Fetch error:', error);
      });
  }

  // 页面开始立即尝试一次主动检测
  checkAndFetchFiles();

  // 供 popup 控制：获取文件、刷新
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request) return;
    
    if (request.type === 'GET_FILES') {
      sendResponse({ files: filesData || [] });
      return true;
    }
    
    if (request.type === 'REFRESH') {
      checkAndFetchFiles();
      sendResponse({ ok: true });
      return true;
    }
  });
})();

