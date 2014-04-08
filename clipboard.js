function onPaste(event) {
  var items = event.clipboardData.items;
  if (items.length === 0)
    return;

  var index = null;
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      index = i;
      // Stop if it's an image
      break;
    } else if (items[i].type === 'text/plain') {
      index = i;
    }
  }
  
  if (index === null)
    return;
  
  if (items[index].type.indexOf('image') !== -1) {      
    var reader = new FileReader();
    reader.onload = function(e) {
      setClipboard(e.target.result);
    };
    reader.readAsDataURL(items[index].getAsFile());
  } else {
    items[index].getAsString(function(text) { 
      setClipboard(text);
    });
  }
}

function setClipboardText(text) {
  var buffer = document.createElement('textarea');
  document.body.appendChild(buffer);
  buffer.style.position = 'absolute';
  buffer.value = text;
  buffer.select();
  
  document.execCommand('copy');
  buffer.remove();
}

var buffer = document.createElement('div');
buffer.contentEditable = true;

setInterval(function() { document.execCommand('paste'); }, 1000);

window.addEventListener('paste', onPaste);