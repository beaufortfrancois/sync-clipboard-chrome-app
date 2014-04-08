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
}

function setClipboard(content) {
  console.log(content, lastContent);
  // Don't set clipboard if it has already been done once with the same content.
  if (content === lastContent)
    return;

  // Always clear notification on clipboard change.
  chrome.notifications.clear(NOTIFICATION_ID, function() {});
  
  // Write to clipboard.
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
            lastContent = content;
          }
        };  
        fileWriter.truncate(0);
      });
    });
  });
}

function showClipboard() {
  // Clear previous notification first.
  chrome.notifications.clear(NOTIFICATION_ID, function() {
    getClipboard(function(content) {
      var options = {
        title: 'Sync Clipboard',
        iconUrl: chrome.runtime.getURL('128.png')
      }
      if (hasImageInClipboard(content)) {
        options.type = 'image';
        options.message = '';
        options.imageUrl = content;
      } else {
        options.type = 'basic',
        options.message = content.trim()
      };
      chrome.notifications.create(NOTIFICATION_ID, options, function() {});
    });
  });
}

function saveImage(dataUrl) {
  var blob = dataURLtoBlob(dataUrl);
  
  // This intermediary dummy page is needed because 
  // I can't call chrome.fileSystem from a background page.
  chrome.app.window.create('dummy.html', {hidden: true}, function(appWindow) {

    // Prompt user where to save the image.
    var options = {type: 'saveFile', suggestedName: 'clipboard.png'};
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
}

function hasImageInClipboard(content) {
  return (content.indexOf('data:image/') === 0);
}

// Always clear notification on clipboard status change.
chrome.syncFileSystem.onFileStatusChanged.addListener(function(detail) {
  if (detail.direction === 'remote_to_local')
    chrome.notifications.clear(NOTIFICATION_ID, function() {});
})

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
        setClipboardText(content);
    });
  });
});

chrome.commands && chrome.commands.onCommand.addListener(showClipboard);
chrome.app.runtime.onLaunched.addListener(showClipboard);
