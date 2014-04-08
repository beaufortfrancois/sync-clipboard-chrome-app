var NOTIFICATION_ID = 'clipboard-sync-id';
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
            updateClipboardNotification();
          }
        }
        // Truncating it first.
        fileWriter.truncate(0);
      });
    });
  });
};

function showClipboard(update) {
    getClipboard(function(content) {
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
      };
      if (typeof update === Boolean && update) {
        chrome.notifications.update(NOTIFICATION_ID, options, function() {});
      } else {
        // Clear previous notification first to force a full refresh.
        chrome.notifications.clear(NOTIFICATION_ID, function() {
          chrome.notifications.create(NOTIFICATION_ID, options, function() {});
        });
      }
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

function updateClipboardNotification() {
  // Update notification if one exits.
  chrome.notifications.getAll(function(notifications) {
    if (notifications[NOTIFICATION_ID])
      showClipboard(true);
  });
};

// Always update notification on clipboard status change.
chrome.syncFileSystem.onFileStatusChanged.addListener(function(detail) {
  if (detail.direction === 'remote_to_local')
    updateClipboardNotification();
});

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

// TODO: Remove this check when chrome.commands is available on Stable channel.
chrome.commands && chrome.commands.onCommand.addListener(showClipboard);
chrome.app.runtime.onLaunched.addListener(showClipboard);
