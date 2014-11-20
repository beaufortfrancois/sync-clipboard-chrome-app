var SAVED_NOTIFICATION_ID = 'saved-notification-id';
var CLIPBOARD_NOTIFICATION_ID = 'clipboard-notification-id';
var CLIPBOARD_FILE_NAME = 'clipboard.txt';

var lastContent = null;
getClipboard(function(content) {
  lastContent = content;
});

function getClipboard(callback) {
  chrome.syncFileSystem.requestFileSystem(function(fileSystem) {
    fileSystem.root.getFile(CLIPBOARD_FILE_NAME, {create: false},
        function(fileEntry) {
      fileEntry.file(function(file) {
         var reader = new FileReader();
         reader.onloadend = function(e) {
           callback(this.result);
         };
         reader.readAsText(file);
      });
    });
  });
};

function setClipboard(content) {
  // Don't set clipboard if it has already been done once with the same content.
  if (content === lastContent)
    return;

  // Write to clipboard file.
  chrome.syncFileSystem.requestFileSystem(function(fileSystem) {
    fileSystem.root.getFile(CLIPBOARD_FILE_NAME, {create: true},
        function(fileEntry) {   
      fileEntry.createWriter(function(fileWriter) {
        var blob = new Blob([content], {type: 'text/plain'});
        fileWriter.onwriteend = function() {
          if (fileWriter.length === 0) {
            fileWriter.write(blob);
          } else {
            fileWriter.onwriteeend = null;
            // We keep a reference of the content so that we can check later.
            lastContent = content;
            // Show saved notification.
            showSavedNotification(content);
          }
        }
        // Truncating it first.
        fileWriter.truncate(0);
      });
    });
  });
};

function getNotificationOptions(content) {
  var options = {
    title: 'Sync Clipboard',
    iconUrl: chrome.runtime.getURL('80.png'),
  };
  if (hasImageInClipboard(content)) {
    options.type = 'image';
    options.message = '';
    options.imageUrl = content;
  } else {
    options.type = 'basic';
    options.message = content.trim();
  }
  return options;
}

var savedTimeoutId = null;

function showSavedNotification(content) {
  clearTimeout(savedTimeoutId);
  // Clear previous notification first to force a full refresh.
  chrome.notifications.clear(SAVED_NOTIFICATION_ID, function() {
    var options = getNotificationOptions(content);
    options.title = 'Clipboard saved';
    chrome.notifications.create(SAVED_NOTIFICATION_ID, options, function() {
      // Clear automatically the saved notification after 4 seconds.
      savedTimeoutId = setTimeout(function() {
        chrome.notifications.clear(SAVED_NOTIFICATION_ID, function() {});
      }, 4000);
    });
  });
};

function showClipboardNotification() {
  // Clear previous notification first to force a full refresh.
  chrome.notifications.clear(CLIPBOARD_NOTIFICATION_ID, function() {
    getClipboard(function(content) {
      var options = getNotificationOptions(content);
      options.title = 'Clipboard updated';
      chrome.notifications.create(CLIPBOARD_NOTIFICATION_ID, options,
          function() {});
    });
  });
};

function saveImage(dataUrl) {
  var blob = dataURLtoBlob(dataUrl);
  
  // This intermediary dummy page is needed because I can't call
  // `chrome.fileSystem` from a background page.
  chrome.app.window.create('dummy.html', {hidden: true}, function(appWindow) {

    // Prompt user where to save the image.
    var options = {type: 'saveFile', suggestedName: 'sync-clipboard.png'};
    appWindow.contentWindow.chrome.fileSystem.chooseEntry(options,
        function(fileEntry) {
                
      // Close the dummy page window first.
      appWindow.close();

      if (!fileEntry)
        return;
      
      // Write to disk.
      fileEntry.createWriter(function(fileWriter) {
        fileWriter.write(blob);
      });
    });
  });
};

function hasImageInClipboard(content) {
  return (content.indexOf('data:image/') === 0);
};

chrome.notifications.onClicked.addListener(function(id) {
  // Clear notification first.
  chrome.notifications.clear(id, function() {

    // Retrieve clipboard item.
    getClipboard(function(content) {      

      if (hasImageInClipboard(content))
        // Save image locally.
        saveImage(content);
      else
        // Copy in the user clipboard.
        copyTextInUserClipboard(content);
    });
  });
});

chrome.syncFileSystem.onFileStatusChanged.addListener(function(detail) {
  if (detail.direction === 'remote_to_local')
    // Show clipboard notification on sync clipboard status change.
    showClipboardNotification();
});
