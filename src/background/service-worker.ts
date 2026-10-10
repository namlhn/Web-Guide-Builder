import type { ExtensionMessage } from '../types';

// State lock to prevent concurrent captures
let isCapturing = false;

// Initialize side panel behavior
chrome.runtime.onInstalled.addListener(async () => {
  try {
    if (chrome.sidePanel?.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch (err) {
    console.error('Error setting panel behavior:', err);
  }
});

// Fallback click listener for action icon (fires if setPanelBehavior is not supported)
chrome.action?.onClicked?.addListener(async (tab) => {
  try {
    if (tab.windowId && chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  } catch (err) {
    console.error('Failed to open side panel on click:', err);
  }
});

// Helper to check if a URL is restricted from screenshotting
function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  const restrictedProtocols = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'data:', 'view-source:', 'devtools:'];
  if (restrictedProtocols.some((proto) => url.startsWith(proto))) {
    return true;
  }
  if (url.includes('chromewebstore.google.com') || url.includes('chrome.google.com/webstore')) {
    return true;
  }
  return false;
}

// Handle messages from Side Panel and Editor
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'CAPTURE_ACTIVE_TAB') {
        if (isCapturing) {
          sendResponse({ success: false, error: 'Đang xử lý một yêu cầu chụp ảnh khác, vui lòng chờ...' });
          return;
        }

        isCapturing = true;
        try {
          // Query active tab in the current or last focused window
          const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

          if (!activeTab || !activeTab.id || !activeTab.windowId) {
            sendResponse({ success: false, error: 'Không tìm thấy tab trang web đang hoạt động.' });
            return;
          }

          if (isRestrictedUrl(activeTab.url)) {
            sendResponse({
              success: false,
              error: `Trình duyệt không cho phép chụp ảnh màn hình các trang nội bộ hoặc cửa hàng tiện ích (${activeTab.url || 'trang hiện tại'}). Vui lòng chuyển sang một website thông thường để chụp bước hướng dẫn.`,
            });
            return;
          }

          // Capture visible area
          const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
            format: 'png',
          });

          if (!dataUrl) {
            sendResponse({ success: false, error: 'Không thể chụp ảnh màn hình từ tab này.' });
            return;
          }

          sendResponse({
            success: true,
            data: {
              dataUrl,
              sourceUrl: activeTab.url,
              tabTitle: activeTab.title,
            },
          });
        } finally {
          isCapturing = false;
        }
        return;
      }

      if (message.type === 'OPEN_EDITOR') {
        const editorUrl = chrome.runtime.getURL(`editor.html?stepId=${message.stepId}`);
        const tab = await chrome.tabs.create({ url: editorUrl });
        sendResponse({ success: true, data: { tabId: tab.id } });
        return;
      }

      if (message.type === 'GET_ACTIVE_TAB_INFO') {
        const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        sendResponse({
          success: true,
          data: {
            title: activeTab?.title,
            url: activeTab?.url,
          },
        });
        return;
      }

      sendResponse({ success: false, error: 'Lệnh không xác định' });
    } catch (err) {
      console.error('Service worker message handling error:', err);
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Đã có lỗi xảy ra trong Service Worker',
      });
    }
  })();

  return true; // Keep message channel open for async response
});
